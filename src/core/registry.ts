/**
 * KVJ Analytics — Dependency Injection registry
 * Layer: Core. Wires service/repository INTERFACES to IMPLEMENTATIONS at boot.
 * See docs/18-architecture-specification.md §3 (DI) and §20 (Migration).
 *
 * This is the seam that makes the two-phase strategy work:
 *   Phase 1 boot → registers Mock* implementations (dummy data)
 *   Phase 2 boot → registers Supabase / Google implementations
 * Nothing above the Repository layer changes — only what's registered here.
 */

export type Token<T> = symbol & { __type?: T };

/** Create a typed DI token. */
export function createToken<T>(name: string): Token<T> {
  return Symbol(name) as Token<T>;
}

type Factory<T> = () => T;

class Container {
  private factories = new Map<symbol, Factory<unknown>>();
  private singletons = new Map<symbol, unknown>();

  /** Register a lazily-constructed singleton implementation for a token. */
  register<T>(token: Token<T>, factory: Factory<T>): void {
    this.factories.set(token, factory);
    this.singletons.delete(token); // allow re-registration (e.g. Phase 1 → Phase 2)
  }

  /** Resolve the implementation registered for a token. */
  resolve<T>(token: Token<T>): T {
    if (this.singletons.has(token)) return this.singletons.get(token) as T;
    const factory = this.factories.get(token);
    if (!factory) throw new Error(`No implementation registered for token: ${String(token.description)}`);
    const instance = factory();
    this.singletons.set(token, instance);
    return instance as T;
  }

  has<T>(token: Token<T>): boolean {
    return this.factories.has(token);
  }

  /** Test/reset helper. */
  reset(): void {
    this.factories.clear();
    this.singletons.clear();
  }
}

/** The single application container. Bootstrapped in the app entry (Phase 1: mocks). */
export const container = new Container();
