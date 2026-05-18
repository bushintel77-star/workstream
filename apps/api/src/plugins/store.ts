import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { getStore, initStore, type Store } from "@construct/db";

declare module "fastify" {
  interface FastifyInstance {
    store: Store;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const store = await initStore();
  fastify.decorate("store", store);
  fastify.log.info("Store initialized (in-memory)");
});

export { getStore };
