import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { getStore, initStore, type Store } from "@construct/db";
import { hydrateEnvFromStore } from "../lib/runtime-secrets";

declare module "fastify" {
  interface FastifyInstance {
    store: Store;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const store = await initStore();
  fastify.decorate("store", store);
  fastify.log.info("Store initialized (in-memory)");

  /* Mirror saved integration tokens into process.env so the existing
   * runtime libs (claude.ts, mapbox.ts, stripe.ts, transcribe.ts) pick
   * them up without each lib needing to be store-aware. */
  const defaultOwner = process.env.DEV_USER_ID ?? "dev-user";
  try {
    await hydrateEnvFromStore(store, defaultOwner);
    fastify.log.info("Integration tokens hydrated into process.env");
  } catch (err) {
    fastify.log.error(err, "Could not hydrate integration tokens");
  }
});

export { getStore };
