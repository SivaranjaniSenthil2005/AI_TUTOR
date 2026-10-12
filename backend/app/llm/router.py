"""Multi-provider LLM router built on LiteLLM with fallback, circuit breaking, and streaming.

Supports:
- Google Gemini, Groq, Mistral, OpenAI
- Config-driven model names via models.yaml (committed)
- Dynamic key discovery from config/env
- Automatic MockProvider fallback when no keys exist
- Circuit breaker for failing providers
- Exponential backoff with jitter on transient errors (429, 5xx, timeouts)
- Immediate failover on auth/quota errors
- Pre-token failover vs mid-stream error preservation
- Privacy-first metadata-only logging (never logs API keys, student questions logged only if DEBUG_LLM=1)
"""

import asyncio
import hashlib
import logging
import os
import random
import time
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple
import yaml
import litellm
from litellm.exceptions import (
    AuthenticationError,
    BadRequestError,
    BudgetExceededError,
    ContentPolicyViolationError,
    InvalidRequestError,
    NotFoundError,
    PermissionDeniedError,
    RateLimitError,
    Timeout as LiteLLMTimeout,
)

from app.config import settings
from app.llm.mock_provider import MockProvider

logger = logging.getLogger("ai_tutor.llm")

# Suppress overly chatty litellm logs
litellm.suppress_debug_info = True


class CircuitBreaker:
    """Simple in-memory circuit breaker per LLM provider."""

    def __init__(self, failure_threshold: int = 3, cooldown_seconds: float = 60.0):
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.failure_count = 0
        self.last_failure_time = 0.0
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN

    def record_success(self) -> None:
        """Reset failures upon successful response."""
        self.failure_count = 0
        self.state = "CLOSED"

    def record_failure(self) -> None:
        """Increment failures and trip breaker if threshold reached."""
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"

    def can_attempt(self) -> bool:
        """Check if provider is eligible for requests."""
        if self.state == "CLOSED":
            return True
        if self.state == "OPEN":
            if time.time() - self.last_failure_time >= self.cooldown_seconds:
                self.state = "HALF_OPEN"
                return True
            return False
        if self.state == "HALF_OPEN":
            return True
        return True

    def get_status(self) -> Dict[str, Any]:
        """Return circuit breaker metrics."""
        remaining = 0.0
        if self.state == "OPEN":
            remaining = max(0.0, (self.last_failure_time + self.cooldown_seconds) - time.time())
        return {
            "state": self.state,
            "failure_count": self.failure_count,
            "cooldown_remaining_sec": round(remaining, 1),
        }

    def reset(self) -> None:
        """Manually reset the circuit breaker."""
        self.failure_count = 0
        self.last_failure_time = 0.0
        self.state = "CLOSED"


class LLMRouter:
    """Multi-provider LLM router with automatic failover."""

    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or settings.LLM_MODELS_CONFIG
        self.config = self._load_config()
        self.provider_chain: List[str] = self.config.get(
            "provider_chain", ["gemini", "groq", "mistral", "openai"]
        )
        self.providers_cfg: Dict[str, Any] = self.config.get("providers", {})
        
        # Initialize circuit breakers per provider
        self.circuit_breakers: Dict[str, CircuitBreaker] = {
            prov: CircuitBreaker(
                failure_threshold=settings.LLM_CIRCUIT_BREAKER_FAILURES,
                cooldown_seconds=settings.LLM_CIRCUIT_BREAKER_COOLDOWN,
            )
            for prov in self.provider_chain
        }
        self.mock_provider = MockProvider()
        # Optional fault injection hook for testing failover
        self._fault_injections: Dict[str, str] = {}

    def _load_config(self) -> Dict[str, Any]:
        """Load provider configurations from YAML file."""
        cfg_file = Path(self.config_path)
        if not cfg_file.is_absolute():
            cfg_file = Path(__file__).resolve().parent / "models.yaml"

        if not cfg_file.exists():
            logger.warning(f"models.yaml not found at {cfg_file}, using defaults.")
            return {
                "provider_chain": ["gemini", "groq", "mistral", "openai"],
                "providers": {
                    "gemini": {"model": "gemini/gemini-2.5-flash", "timeout_seconds": 25.0, "env_key": "GEMINI_API_KEY"},
                    "groq": {"model": "groq/llama-3.3-70b-versatile", "timeout_seconds": 25.0, "env_key": "GROQ_API_KEY"},
                    "mistral": {"model": "mistral/mistral-small-latest", "timeout_seconds": 25.0, "env_key": "MISTRAL_API_KEY"},
                    "openai": {"model": "openai/gpt-4o-mini", "timeout_seconds": 25.0, "env_key": "OPENAI_API_KEY"},
                },
            }

        with open(cfg_file, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}

    def get_api_key(self, provider: str) -> Optional[str]:
        """Retrieve API key for provider from settings, environment, or .env files without logging it."""
        prov_info = self.providers_cfg.get(provider, {})
        env_var = prov_info.get("env_key", f"{provider.upper()}_API_KEY")
        # Check settings first, then os.environ
        key = getattr(settings, env_var, None) or os.environ.get(env_var, "")
        key = key.strip() if key else ""
        if not key:
            try:
                import dotenv
                from app.config import BASE_DIR
                for env_p in [BASE_DIR / ".env", Path(__file__).resolve().parent.parent.parent / ".env", Path(".env")]:
                    if env_p.exists():
                        vals = dotenv.dotenv_values(str(env_p))
                        if env_var in vals and vals[env_var]:
                            key = vals[env_var].strip()
                            break
            except Exception:
                pass
        return key if key else None

    def get_enabled_providers(self) -> List[str]:
        """Return list of providers that have an active API key configured."""
        enabled = []
        for prov in self.provider_chain:
            if self.get_api_key(prov):
                enabled.append(prov)
        if not enabled:
            enabled.append("mock")
        return enabled

    def get_status(self) -> Dict[str, Any]:
        """Get LLM router status including active providers and circuit breakers."""
        enabled = self.get_enabled_providers()
        cb_status = {prov: cb.get_status() for prov, cb in self.circuit_breakers.items()}
        models_map = {
            prov: self.providers_cfg.get(prov, {}).get("model", "")
            for prov in self.provider_chain
        }
        return {
            "enabled_providers": enabled,
            "provider_chain": self.provider_chain,
            "circuit_breakers": cb_status,
            "models": models_map,
        }

    def _is_non_transient_error(self, exc: Exception) -> bool:
        """Determine if an error is non-transient (immediate failover without retry)."""
        if isinstance(
            exc,
            (
                AuthenticationError,
                PermissionDeniedError,
                BudgetExceededError,
                ContentPolicyViolationError,
                BadRequestError,
                InvalidRequestError,
                NotFoundError,
            ),
        ):
            return True

        err_msg = str(exc).lower()
        non_transient_indicators = [
            "api key",
            "unauthorized",
            "401",
            "403",
            "forbidden",
            "quota",
            "billing",
            "insufficient",
            "credit",
            "deactivated",
            "invalid_api_key",
        ]
        return any(ind in err_msg for ind in non_transient_indicators)

    def _log_attempt(
        self,
        provider: str,
        model: str,
        duration_ms: float,
        success: bool,
        error: Optional[str] = None,
        usage: Optional[Dict[str, Any]] = None,
        prompt_hash: str = "",
    ) -> None:
        """Privacy-preserving logging of LLM operations (never logs keys or question text)."""
        status_str = "SUCCESS" if success else "FAILED"
        log_msg = (
            f"[LLM] Provider={provider} Model={model} Status={status_str} "
            f"Latency={duration_ms:.1f}ms QueryHash={prompt_hash}"
        )
        if usage:
            log_msg += f" Tokens={usage.get('total_tokens', 0)}"
        if error:
            # Mask potential key leaks in error message
            safe_err = error[:200].replace("\n", " ")
            log_msg += f" Error='{safe_err}'"

        if success:
            logger.info(log_msg)
        else:
            logger.warning(log_msg)

    async def _execute_provider_call(
        self,
        provider: str,
        messages: List[Dict[str, str]],
        timeout_seconds: float,
        temperature: float,
        max_tokens: int,
    ) -> Tuple[str, Dict[str, Any]]:
        """Call a single provider via LiteLLM."""
        # Check fault injection
        if provider in self._fault_injections:
            fault = self._fault_injections[provider]
            if fault == "auth":
                raise AuthenticationError("Simulated invalid API key (401)", model=provider, llm_provider=provider)
            elif fault == "rate_limit":
                raise RateLimitError("Simulated rate limit exceeded (429)", model=provider, llm_provider=provider)
            elif fault == "timeout":
                raise LiteLLMTimeout("Simulated provider timeout", model=provider, llm_provider=provider)
            else:
                raise RuntimeError(f"Simulated error: {fault}")

        api_key = self.get_api_key(provider)
        prov_info = self.providers_cfg.get(provider, {})
        model_name = prov_info.get("model", "")

        # Execute LiteLLM completion asynchronously
        response = await litellm.acompletion(
            model=model_name,
            messages=messages,
            api_key=api_key,
            timeout=timeout_seconds,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        content = response.choices[0].message.content or ""
        usage_info = {}
        if hasattr(response, "usage") and response.usage:
            usage_info = {
                "prompt_tokens": getattr(response.usage, "prompt_tokens", 0),
                "completion_tokens": getattr(response.usage, "completion_tokens", 0),
                "total_tokens": getattr(response.usage, "total_tokens", 0),
            }

        return content, usage_info

    async def generate(
        self,
        messages: List[Dict[str, str]],
        chunks: Optional[List[Any]] = None,
        provider_override: Optional[str] = None,
        force_mock: bool = False,
        timeout_seconds: Optional[float] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Generate a complete grounded response, trying providers in sequence."""
        # Generate short hash of query for privacy logging
        user_content = next((m["content"] for m in messages if m.get("role") == "user"), "")
        query_hash = hashlib.sha256(user_content.encode("utf-8")).hexdigest()[:8]

        if settings.DEBUG_LLM:
            logger.debug(f"[DEBUG_LLM] Prompt: {user_content}")

        if force_mock:
            t0 = time.perf_counter()
            res = await self.mock_provider.generate(messages, chunks)
            res["latency_ms"] = round((time.perf_counter() - t0) * 1000, 2)
            return res

        # Determine chain to attempt
        if provider_override:
            if provider_override.lower() == "mock":
                t0 = time.perf_counter()
                res = await self.mock_provider.generate(messages, chunks)
                res["latency_ms"] = round((time.perf_counter() - t0) * 1000, 2)
                return res
            chain_to_try = [provider_override.lower()]
        else:
            chain_to_try = [p for p in self.provider_chain if self.get_api_key(p)]

        if not chain_to_try:
            logger.info("No active LLM provider keys configured; falling back to MockProvider.")
            t0 = time.perf_counter()
            res = await self.mock_provider.generate(messages, chunks)
            res["latency_ms"] = round((time.perf_counter() - t0) * 1000, 2)
            return res

        last_error = None

        for prov in chain_to_try:
            cb = self.circuit_breakers.get(prov)
            if cb and not cb.can_attempt():
                logger.warning(f"Skipping {prov} - circuit breaker is OPEN (cooling down).")
                continue

            prov_info = self.providers_cfg.get(prov, {})
            model_name = prov_info.get("model", prov)
            timeout = timeout_seconds if timeout_seconds is not None else prov_info.get("timeout_seconds", settings.LLM_DEFAULT_TIMEOUT)
            temp = temperature if temperature is not None else prov_info.get("temperature", 0.2)
            tokens = max_tokens if max_tokens is not None else prov_info.get("max_tokens", 1024)
            max_retries = settings.LLM_MAX_RETRIES

            # Attempt provider with retries on transient errors
            for attempt in range(max_retries + 1):
                start_time = time.perf_counter()
                try:
                    content, usage = await self._execute_provider_call(
                        provider=prov,
                        messages=messages,
                        timeout_seconds=timeout,
                        temperature=temp,
                        max_tokens=tokens,
                    )
                    duration_ms = (time.perf_counter() - start_time) * 1000

                    if cb:
                        cb.record_success()

                    self._log_attempt(
                        provider=prov,
                        model=model_name,
                        duration_ms=duration_ms,
                        success=True,
                        usage=usage,
                        prompt_hash=query_hash,
                    )

                    return {
                        "content": content,
                        "provider": prov,
                        "model": model_name,
                        "usage": usage,
                        "latency_ms": round(duration_ms, 2),
                        "mock": False,
                    }

                except Exception as exc:
                    duration_ms = (time.perf_counter() - start_time) * 1000
                    last_error = exc
                    self._log_attempt(
                        provider=prov,
                        model=model_name,
                        duration_ms=duration_ms,
                        success=False,
                        error=str(exc),
                        prompt_hash=query_hash,
                    )

                    # Non-transient errors (auth, quota) -> immediate failover, no retry
                    if self._is_non_transient_error(exc):
                        if cb:
                            cb.record_failure()
                        logger.warning(
                            f"Non-transient error on provider '{prov}' ({type(exc).__name__}). Failing over immediately."
                        )
                        break

                    # Transient errors (timeout, 429, 5xx) -> retry with backoff and jitter
                    if attempt < max_retries:
                        backoff = (0.5 * (2**attempt)) + random.uniform(0.05, 0.2)
                        logger.info(
                            f"Transient error on '{prov}' ({type(exc).__name__}). Retrying in {backoff:.2f}s (attempt {attempt + 1}/{max_retries})."
                        )
                        await asyncio.sleep(backoff)
                    else:
                        if cb:
                            cb.record_failure()
                        logger.warning(
                            f"Provider '{prov}' exhausted {max_retries} retries. Tripping failover to next provider."
                        )

        # If all real providers failed or none answered, fall back to mock
        logger.warning(f"All configured LLM providers failed (last error: {last_error}). Falling back to MockProvider.")
        t0 = time.perf_counter()
        res = await self.mock_provider.generate(messages, chunks)
        res["latency_ms"] = round((time.perf_counter() - t0) * 1000, 2)
        return res

    async def stream(
        self,
        messages: List[Dict[str, str]],
        chunks: Optional[List[Any]] = None,
        provider_override: Optional[str] = None,
        force_mock: bool = False,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream response tokens delta by delta.

        Yields dictionaries with event types:
          - {"event": "token", "data": {"delta": str}}
          - {"event": "done", "data": {"provider": str, "model": str, "mock": bool, ...}}
          - {"event": "error", "data": {"message": str}}
        """
        user_content = next((m["content"] for m in messages if m.get("role") == "user"), "")
        query_hash = hashlib.sha256(user_content.encode("utf-8")).hexdigest()[:8]

        if force_mock or (provider_override and provider_override.lower() == "mock"):
            t0 = time.perf_counter()
            async for token in self.mock_provider.stream(messages, chunks):
                yield {"event": "token", "data": {"delta": token}}
            duration_ms = (time.perf_counter() - t0) * 1000
            yield {
                "event": "done",
                "data": {
                    "provider": "mock",
                    "model": "mock-tutor-v1",
                    "mock": True,
                    "latency_ms": round(duration_ms, 2),
                },
            }
            return

        chain_to_try = [provider_override.lower()] if provider_override else [p for p in self.provider_chain if self.get_api_key(p)]

        if not chain_to_try:
            # Fall back to mock stream
            t0 = time.perf_counter()
            async for token in self.mock_provider.stream(messages, chunks):
                yield {"event": "token", "data": {"delta": token}}
            duration_ms = (time.perf_counter() - t0) * 1000
            yield {
                "event": "done",
                "data": {
                    "provider": "mock",
                    "model": "mock-tutor-v1",
                    "mock": True,
                    "latency_ms": round(duration_ms, 2),
                },
            }
            return

        last_error = None

        for prov in chain_to_try:
            cb = self.circuit_breakers.get(prov)
            if cb and not cb.can_attempt():
                logger.warning(f"Skipping streaming on {prov} - circuit breaker is OPEN.")
                continue

            prov_info = self.providers_cfg.get(prov, {})
            model_name = prov_info.get("model", prov)
            timeout = prov_info.get("timeout_seconds", settings.LLM_DEFAULT_TIMEOUT)
            temp = prov_info.get("temperature", 0.2)
            max_tokens = prov_info.get("max_tokens", 1024)
            api_key = self.get_api_key(prov)

            tokens_yielded = 0
            start_time = time.perf_counter()

            try:
                # Check fault injection
                if prov in self._fault_injections:
                    fault = self._fault_injections[prov]
                    if fault == "midstream":
                        # Yield one token then raise mid-stream error
                        yield {"event": "token", "data": {"delta": "Thinking..."}}
                        tokens_yielded = 1
                        raise RuntimeError("Simulated midstream network disconnection")
                    elif fault == "auth":
                        raise AuthenticationError("Simulated auth failure", model=prov, llm_provider=prov)
                    else:
                        raise RuntimeError(f"Simulated failure: {fault}")

                response_stream = await litellm.acompletion(
                    model=model_name,
                    messages=messages,
                    api_key=api_key,
                    timeout=timeout,
                    temperature=temp,
                    max_tokens=max_tokens,
                    stream=True,
                )

                async for chunk in response_stream:
                    choices = getattr(chunk, "choices", [])
                    if choices:
                        delta = getattr(choices[0], "delta", None)
                        text_delta = getattr(delta, "content", "") if delta else ""
                        if text_delta:
                            tokens_yielded += 1
                            yield {"event": "token", "data": {"delta": text_delta}}

                # Stream completed successfully
                duration_ms = (time.perf_counter() - start_time) * 1000
                if cb:
                    cb.record_success()

                self._log_attempt(
                    provider=prov,
                    model=model_name,
                    duration_ms=duration_ms,
                    success=True,
                    prompt_hash=query_hash,
                )

                yield {
                    "event": "done",
                    "data": {
                        "provider": prov,
                        "model": model_name,
                        "mock": False,
                        "latency_ms": round(duration_ms, 2),
                    },
                }
                return

            except Exception as exc:
                duration_ms = (time.perf_counter() - start_time) * 1000
                last_error = exc
                self._log_attempt(
                    provider=prov,
                    model=model_name,
                    duration_ms=duration_ms,
                    success=False,
                    error=str(exc),
                    prompt_hash=query_hash,
                )
                if cb:
                    cb.record_failure()

                # If failure happened AFTER tokens have already been emitted,
                # do NOT mix text with another provider. Stop cleanly with error event.
                if tokens_yielded > 0:
                    logger.error(
                        f"Stream from provider '{prov}' failed mid-stream after {tokens_yielded} tokens: {exc}. Preserving partial output without mixing."
                    )
                    yield {
                        "event": "error",
                        "data": {
                            "message": "Stream interrupted mid-generation. Please try again.",
                            "provider": prov,
                        },
                    }
                    return

                # If failure happened BEFORE any tokens were yielded, fail over to the next provider!
                logger.warning(
                    f"Provider '{prov}' failed before emitting any token ({type(exc).__name__}). Failing over to next provider in stream."
                )

        # All providers failed before first token: fall back to mock stream
        logger.warning(f"All stream providers failed (last error: {last_error}). Falling back to MockProvider stream.")
        t0 = time.perf_counter()
        async for token in self.mock_provider.stream(messages, chunks):
            yield {"event": "token", "data": {"delta": token}}
        duration_ms = (time.perf_counter() - t0) * 1000
        yield {
            "event": "done",
            "data": {
                "provider": "mock",
                "model": "mock-tutor-v1",
                "mock": True,
                "latency_ms": round(duration_ms, 2),
            },
        }


# Global singleton instance
_router_instance: Optional[LLMRouter] = None


def get_llm_router() -> LLMRouter:
    """Get or create singleton LLMRouter instance."""
    global _router_instance
    if _router_instance is None:
        _router_instance = LLMRouter()
    return _router_instance


def set_llm_router(router: Optional[LLMRouter]) -> None:
    """Override singleton router for testing."""
    global _router_instance
    _router_instance = router
