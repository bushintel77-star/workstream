import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { getStore, initStore, type Store } from "@workstream/db";

declare module "fastify" {
  interface FastifyInstance {
    store: Store;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const store = await initStore();
  fastify.decorate("store", store);
  fastify.log.info("Store initialized (in-memory)");

  /* Integration tokens are deliberately NOT mirrored into process.env:
   * owner-secrets.ts scopes them per request/job via AsyncLocalStorage, and
   * a process-level mirror would let one workspace read another workspace's
   * connector credentials. */
});

export { getStore };
