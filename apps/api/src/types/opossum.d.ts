declare module "opossum" {
  interface CircuitBreakerOptions {
    failureThreshold?: number;
    resetTimeout?: number;
    timeout?: number;
  }

  interface CircuitBreakerStats {
    failures: number;
    successes: number;
    rejects: number;
    fires: number;
    timeouts: number;
  }

  export default class CircuitBreaker<TArgs extends unknown[], TReturn> {
    constructor(action: (...args: TArgs) => Promise<TReturn>, options?: CircuitBreakerOptions);
    opened: boolean;
    halfOpen: boolean;
    stats: CircuitBreakerStats;
    on(event: "open" | "halfOpen" | "close" | "fallback", listener: (err?: unknown) => void): void;
    fire(...args: TArgs): Promise<TReturn>;
  }
}
