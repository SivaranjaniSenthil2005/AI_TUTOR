"use client";

import React, { useEffect } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastProps {
  id?: string;
  type?: ToastType;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
  durationMs?: number;
}

export function Toast({
  id = "floating-toast",
  type = "info",
  message,
  actionLabel,
  onAction,
  onClose,
  durationMs = 6000,
}: ToastProps) {
  useEffect(() => {
    if (!durationMs || !onClose) return;
    const timer = setTimeout(() => {
      onClose();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onClose]);

  const typeConfig = {
    info: {
      bg: "bg-[#0d1527]",
      border: "border-slate-700",
      text: "text-slate-100",
      icon: <Info className="w-5 h-5 text-cyan-400" />,
    },
    success: {
      bg: "bg-[#0a231b]",
      border: "border-emerald-600/60",
      text: "text-emerald-100",
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    },
    warning: {
      bg: "bg-[var(--warning-soft)]",
      border: "border-[var(--warning)]/40",
      text: "text-[var(--text-primary)]",
      icon: <AlertCircle className="w-5 h-5 text-[var(--warning)]" />,
    },
    error: {
      bg: "bg-[var(--error-soft)]",
      border: "border-[var(--error)]/40",
      text: "text-[var(--text-primary)]",
      icon: <AlertCircle className="w-5 h-5 text-[var(--error)]" />,
    },
  }[type];

  return (
    <div
      id={id}
      role="status"
      aria-live="polite"
      className="fixed bottom-32 right-6 z-[9970] max-w-md pointer-events-auto shadow-2xl rounded-2xl"
    >
      <div
        className={`px-4 py-3.5 rounded-2xl border flex items-center gap-3 ${typeConfig.bg} ${typeConfig.border} ${typeConfig.text} calm-fade`}
      >
        <span className="flex-shrink-0" aria-hidden="true">{typeConfig.icon}</span>
        <p className="text-sm font-semibold flex-1 leading-snug">{message}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.focus({ preventScroll: true });
              onAction();
            }}
            className="px-3 py-1 bg-[var(--primary)] text-white font-semibold text-xs rounded-lg hover:bg-[var(--primary-hover)] cursor-pointer flex-shrink-0"
          >
            {actionLabel}
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.focus({ preventScroll: true });
              onClose();
            }}
            aria-label="Dismiss Notification"
            className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
