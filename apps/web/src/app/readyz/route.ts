/**
 * Deploy healthcheck — Railway polls /readyz on web deploys (same convention
 * as the API's /readyz). Returns 200 when the Next server is up.
 */
export function GET() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
