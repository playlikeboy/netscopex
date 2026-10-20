import { EventEmitter } from "node:events";
import { FastifyReply, FastifyRequest } from "fastify";
import { logger } from "@netscopex/observability";

export interface TelemetryStreamEvent {
  type: "probe_result" | "monitor_state" | "incident" | "slo_evaluated" | "heartbeat";
  data: Record<string, unknown>;
  timestamp: string;
}

class TelemetryEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
  }

  broadcast(type: TelemetryStreamEvent["type"], data: Record<string, unknown>) {
    const event: TelemetryStreamEvent = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };
    this.emit("telemetry", event);
  }
}

export const telemetryBus = new TelemetryEventBus();

/**
 * Fastify SSE stream handler for streaming telemetry to connected web and mobile clients.
 */
export function handleSseSubscription(req: FastifyRequest, reply: FastifyReply) {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  // Initial handshake
  reply.raw.write(
    `event: handshake\ndata: ${JSON.stringify({
      status: "connected",
      clientId: req.id,
      timestamp: new Date().toISOString(),
    })}\n\n`
  );

  const onTelemetry = (event: TelemetryStreamEvent) => {
    try {
      reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    } catch (err) {
      logger.debug({ err }, "Error writing SSE event to client");
    }
  };

  telemetryBus.on("telemetry", onTelemetry);

  // Keep connection alive with periodic heartbeats
  const heartbeatInterval = setInterval(() => {
    try {
      reply.raw.write(`:keepalive ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeatInterval);
    }
  }, 15000);

  req.raw.on("close", () => {
    clearInterval(heartbeatInterval);
    telemetryBus.off("telemetry", onTelemetry);
  });
}
