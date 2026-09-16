# Personal realtime read safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent a failed Personal Firestore listener from being hidden as an empty successful dashboard, and prevent Personal writes until the required data listeners have recovered.

**Architecture:** Keep an independent status for each of the five Personal realtime sources, deriving the existing aggregate status/error only from those source states. Map malformed movement documents into a document-ID-only listener error and gate the Personal composer on a successful aggregate read.

**Tech Stack:** Next.js, React, TypeScript, Zustand, Firebase Web SDK, Node `assert` tests through `tsx`.

---

### Task 1: Lock listener-error preservation with a failing test

**Files:**
- Create: `tests/unit/mplus-personal-read-safety.test.ts`
- Modify: `src/stores/mplus-personal-store.ts`
- Modify: `tests/unit/run-all.ts`

- [ ] Write a test with four successful subscriber callbacks and a failing `subscribeMonthMovements` callback. Assert the final store state stays `error` and retains the movement error message.
- [ ] Run `npx tsx tests/unit/mplus-personal-read-safety.test.ts`; it must fail because any unrelated success callback clears the shared error.
- [ ] Add a `profile|accounts|categories|movements|trashed` source-status record and derive aggregate `loading`, `success`, or `error`. A source success clears only its own error.
- [ ] Re-run the focused test and confirm it passes.
- [ ] Stage only these scoped files if a commit is requested; never include pre-existing WIP.

### Task 2: Make malformed movement reads actionable

**Files:**
- Modify: `src/features/movements/services/read-personal-movements.ts`
- Modify: `tests/unit/mplus-personal-derived-read-consistency.test.ts`

- [ ] Add a failing test that feeds a malformed document with ID `m-bad` to an exported document mapper and asserts its error contains `m-bad`, not document contents.
- [ ] Run `npx tsx tests/unit/mplus-personal-derived-read-consistency.test.ts`; it must fail because the mapper does not exist.
- [ ] Extract the snapshot-document mapping to the exported mapper, wrapping converter failures as `No se pudo leer el movimiento <id>`. Use it for direct reads and both realtime callbacks; map failures must call `onError` rather than escape from `onSnapshot`.
- [ ] Preserve the existing WIP filter that excludes `household_expense` from Personal trash.
- [ ] Re-run the focused test and confirm it passes.

### Task 3: Block Personal writes while read state is not successful

**Files:**
- Modify: `src/components/layout/dashboard-shell.tsx`
- Modify: `tests/unit/mplus-personal-read-safety.test.ts`

- [ ] Add a failing source-contract test that expects the Personal creation guard and composer mount to require `mplusStatus === "success"`.
- [ ] Run `npx tsx tests/unit/mplus-personal-read-safety.test.ts`; it must fail because Personal “Nuevo” and the composer are currently available on an error state.
- [ ] Require successful Personal load in `openCreatePanel`, hide Personal top-bar creation controls until then, and only mount `MovementComposerDialog` for a successful Personal state. Leave Household actions and retry UI unchanged.
- [ ] Re-run the focused test and confirm it passes.

### Task 4: Verify and document

**Files:**
- Modify: `docs/11_WEB_DEV_LOG.md` (append-only, preserving its current WIP)

- [ ] Run `npx tsx tests/unit/mplus-personal-read-safety.test.ts`, `npx tsx tests/unit/mplus-realtime-sync.test.ts`, and `npx tsx tests/unit/mplus-personal-derived-read-consistency.test.ts`.
- [ ] Run `npm test`, `npm run build`, and `git diff --check`.
- [ ] Append a dated log entry describing the masked-listener root cause, document-ID-only diagnostic, Personal write gate, and the fact that no Firestore schema, Rules, or financial data was changed.
- [ ] Inspect `git diff` and `git status --short --branch`; report all pre-existing WIP separately and confirm no orchestrator, `main`, or snapshot files changed.
