import { test } from "node:test";
import assert from "node:assert/strict";

test("Ask Confirmation Step: Yes, Try Again, and Cancel actions", () => {
  let askedQuestion: string | null = null;
  let retryTriggered = false;
  let cancelled = false;

  let pendingConfirmation: string | null = "Explain photosynthesis";

  const confirmYes = () => {
    if (pendingConfirmation) {
      askedQuestion = pendingConfirmation;
      pendingConfirmation = null;
    }
  };

  const confirmRetry = () => {
    pendingConfirmation = null;
    retryTriggered = true;
  };

  const confirmCancel = () => {
    pendingConfirmation = null;
    cancelled = true;
  };

  // Test 1: Confirm YES submits the question
  confirmYes();
  assert.equal(askedQuestion, "Explain photosynthesis");
  assert.equal(pendingConfirmation, null);

  // Test 2: Retry clears pending and flags retry
  pendingConfirmation = "Misheard question";
  confirmRetry();
  assert.equal(retryTriggered, true);
  assert.equal(pendingConfirmation, null);

  // Test 3: Cancel discards without asking
  pendingConfirmation = "Accidental query";
  confirmCancel();
  assert.equal(cancelled, true);
  assert.equal(pendingConfirmation, null);
});

test("Typed Fallback: validates and submits typed question", () => {
  let submittedQuery = "";

  const handleTypedSubmit = (input: string) => {
    if (input.trim()) {
      submittedQuery = input.trim();
    }
  };

  // Empty string does not submit
  handleTypedSubmit("   ");
  assert.equal(submittedQuery, "");

  // Valid string submits
  handleTypedSubmit("What is gravity?");
  assert.equal(submittedQuery, "What is gravity?");
});
