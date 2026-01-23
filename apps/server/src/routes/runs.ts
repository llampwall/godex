import { FastifyInstance } from "fastify";
import { RunManager } from "../run_manager.js";
import { Store } from "../store.js";

const writeEvent = (res: NodeJS.WritableStream, event: string, data: unknown) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

export const registerRunRoutes = (app: FastifyInstance, store: Store, runManager: RunManager) => {
  app.get("/runs/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const run = store.getRun(id);
    if (!run) {
      return reply.code(404).send({ ok: false, error: "run not found" });
    }
    const events = store.getRunEvents(id, 500);
    return { ok: true, run, events };
  });

  app.get("/runs/:id/stream", async (req, reply) => {
    const { id } = req.params as { id: string };
    const run = store.getRun(id);
    if (!run) {
      return reply.code(404).send({ ok: false, error: "run not found" });
    }

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*"
    });

    const events = store.getRunEvents(id, 500);
    for (const event of events) {
      writeEvent(reply.raw, "chunk", event);
    }

    const unsubscribe = runManager.subscribe(id, (event) => {
      if (event.type === "chunk") {
        writeEvent(reply.raw, "chunk", event.data);
      } else {
        writeEvent(reply.raw, "final", event.data);
      }
    });

    const ping = setInterval(() => {
      reply.raw.write("event: ping\ndata: {}\n\n");
    }, 15000);

    req.raw.on("close", () => {
      clearInterval(ping);
      unsubscribe();
    });
  });
};
