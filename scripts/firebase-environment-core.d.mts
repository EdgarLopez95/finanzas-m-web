export const FIREBASE_KEYS: readonly string[];
export function parseEnvFile(contents: string): Record<string, string>;
export function validateQaValues(
  values: Record<string, string>,
): Record<string, string>;
export function createFirebaseChildEnvironment(
  runtime: "EMULATOR" | "QA_REAL",
  inheritedEnvironment: Record<string, string | undefined>,
  qaValues?: Record<string, string>,
): Record<string, string | undefined>;
