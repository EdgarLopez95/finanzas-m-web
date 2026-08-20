export const FIREBASE_KEYS: readonly string[];
export function parseEnvFile(contents: string): Record<string, string>;
export function validateFirebaseValues(
  values: Record<string, string>,
): Record<string, string>;
export function createFirebaseChildEnvironment(
  inheritedEnvironment: Record<string, string | undefined>,
  values?: Record<string, string>,
): Record<string, string | undefined>;
