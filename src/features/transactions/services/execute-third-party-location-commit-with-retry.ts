const CONFLICT = "La versión del ledger cambió; se requiere reproyección.";
export const executeThirdPartyLocationCommitWithRetry = async <T>(
  rebuildPlan: () => Promise<T>,
  commit: (plan: T) => Promise<void>,
  maxAttempts = 3,
): Promise<T> => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const plan = await rebuildPlan();
    try { await commit(plan); return plan; } catch (error) {
      if (!(error instanceof Error) || error.message !== CONFLICT || attempt === maxAttempts - 1) throw error;
    }
  }
  throw new Error(CONFLICT);
};
