/**
 * Resilient wrapper around `fetch` for external services (Claude, OpenAI,
 * Mapbox, Stripe, etc.). Adds:
 *
 *  - per-call timeout via AbortController (default 30s; configurable)
 *  - retries with exponential backoff on 429 / 5xx / network error
 *  - jitter so a thundering herd doesn't pile in lockstep
 *  - User-Agent header so we're identifiable in supplier logs
 *
 * Use `fetchWithRetry(input, init, opts)` everywhere we call an external
 * provider. Do NOT use it for internal calls (cheaper to fail fast there).
 */

export type FetchRetryOptions = {
  /** Hard cap on a single attempt, ms. Defaults to 30_000. */
  timeoutMs?: number;
  /** Maximum attempts including the first. Defaults to 3. */
  retries?: number;
  /** Initial backoff in ms. Defaults to 400. */
  backoffMs?: number;
  /** Status codes that should be retried. Defaults to 408, 429, 500-599. */
  retryOn?: (status: number) => boolean;
  /** AbortSignal to chain into the per-attempt signal. */
  signal?: AbortSignal;
};

const DEFAULT_USER_AGENT = "Workstream/1.0 (+https://workstream-api.fly.dev)";

const defaultRetryOn = (status: number): boolean =>
  status === 408 || status === 429 || (status >= 500 && status <= 599);

function jitteredDelay(baseMs: number, attempt: number): number {
  const exp = baseMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * baseMs;
  return Math.min(exp + jitter, 15_000);
}

export async function fetchWithRetry(
  input: string | URL,
  init: RequestInit = {},
  opts: FetchRetryOptions = {},
): Promise<Response> {
  const {
    timeoutMs = 30_000,
    retries = 3,
    backoffMs = 400,
    retryOn = defaultRetryOn,
    signal: outerSignal,
  } = opts;

  const headers = new Headers(init.headers);
  if (!headers.has("user-agent")) headers.set("user-agent", DEFAULT_USER_AGENT);

  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new Error("timeout")), timeoutMs);

    /* If the caller passed their own signal, abort our inner controller
     * if theirs trips. */
    const onOuterAbort = () => ctrl.abort(outerSignal?.reason);
    if (outerSignal) {
      if (outerSignal.aborted) ctrl.abort(outerSignal.reason);
      else outerSignal.addEventListener("abort", onOuterAbort, { once: true });
    }

    try {
      const res = await fetch(input, {
        ...init,
        headers,
        signal: ctrl.signal,
      });

      if (!res.ok && retryOn(res.status) && attempt < retries) {
        /* Throw to land in catch so we backoff. Consume body to free
         * the connection. */
        try {
          await res.text();
        } catch {
          /* ignore */
        }
        throw new Error(`HTTP ${res.status}`);
      }

      return res;
    } catch (err) {
      lastErr = err;
      if (attempt >= retries) break;
      await new Promise((r) => setTimeout(r, jitteredDelay(backoffMs, attempt)));
    } finally {
      clearTimeout(timer);
      if (outerSignal) outerSignal.removeEventListener("abort", onOuterAbort);
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(`fetch failed after ${retries} attempts`);
}
