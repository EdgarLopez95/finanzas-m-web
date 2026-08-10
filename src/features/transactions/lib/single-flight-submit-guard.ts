export type SingleFlightSubmitGuard = {
  /** Returns true if the lock was acquired, false if already in flight */
  tryAcquire: () => boolean;
  /** Releases the lock, allowing future submits */
  release: () => void;
};

/**
 * Creates a simple guard to prevent concurrent identical submit calls.
 */
export function createSingleFlightSubmitGuard(): SingleFlightSubmitGuard {
  let inFlight = false;

  return {
    tryAcquire: () => {
      if (inFlight) {
        return false;
      }
      inFlight = true;
      return true;
    },
    release: () => {
      inFlight = false;
    },
  };
}
