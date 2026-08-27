export type SubscriptionScope = "personal" | "household";

type Unsubscribe = () => void;

class SubscriptionRegistry {
  private scopes = new Map<SubscriptionScope, Map<string, Unsubscribe>>();

  constructor() {
    this.scopes.set("personal", new Map());
    this.scopes.set("household", new Map());
  }

  register(scope: SubscriptionScope, key: string, unsubscribeFn: Unsubscribe): void {
    const scopeMap = this.scopes.get(scope);
    if (!scopeMap) return;

    // Desuscribir la anterior si existe la misma key en este scope (evita duplicados)
    const existingUnsubscribe = scopeMap.get(key);
    if (existingUnsubscribe) {
      try {
        existingUnsubscribe();
      } catch (err) {
        console.error(`Error desuscribiendo key "${key}" en el scope "${scope}":`, err);
      }
    }

    scopeMap.set(key, unsubscribeFn);
  }

  unregister(scope: SubscriptionScope, key?: string): void {
    const scopeMap = this.scopes.get(scope);
    if (!scopeMap) return;

    if (key) {
      const unsubscribeFn = scopeMap.get(key);
      if (unsubscribeFn) {
        try {
          unsubscribeFn();
        } catch (err) {
          console.error(`Error desuscribiendo key "${key}" en el scope "${scope}":`, err);
        }
        scopeMap.delete(key);
      }
    } else {
      for (const [k, unsubscribeFn] of scopeMap.entries()) {
        try {
          unsubscribeFn();
        } catch (err) {
          console.error(`Error desuscribiendo key "${k}" en el scope "${scope}":`, err);
        }
      }
      scopeMap.clear();
    }
  }

  unregisterAll(): void {
    this.unregister("personal");
    this.unregister("household");
  }

  has(scope: SubscriptionScope, key: string): boolean {
    const scopeMap = this.scopes.get(scope);
    return scopeMap ? scopeMap.has(key) : false;
  }

  getActiveKeys(scope: SubscriptionScope): string[] {
    const scopeMap = this.scopes.get(scope);
    return scopeMap ? Array.from(scopeMap.keys()) : [];
  }

  getActiveCount(scope?: SubscriptionScope): number {
    if (scope) {
      const scopeMap = this.scopes.get(scope);
      return scopeMap ? scopeMap.size : 0;
    }

    let total = 0;
    for (const scopeMap of this.scopes.values()) {
      total += scopeMap.size;
    }
    return total;
  }
}

export { SubscriptionRegistry };
export const subscriptionRegistry = new SubscriptionRegistry();
