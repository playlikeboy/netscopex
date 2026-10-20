import { trace, context, SpanStatusCode, Span, propagation } from "@opentelemetry/api";
import pino from "pino";

// Tracer instance
export const TRACER_NAME = "netscopex-tracer";
export const tracer = trace.getTracer(TRACER_NAME, "1.0.0");

// Base Logger
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level(label) {
      return { level: label };
    },
    log(obj) {
      const activeSpan = trace.getActiveSpan();
      if (activeSpan) {
        const spanContext = activeSpan.spanContext();
        return {
          ...obj,
          traceId: spanContext.traceId,
          spanId: spanContext.spanId,
        };
      }
      return obj;
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Trace context propagation helpers
export function injectTraceContext(carrier: Record<string, string>): void {
  propagation.inject(context.active(), carrier);
}

export function extractTraceContext(carrier: Record<string, string>) {
  return propagation.extract(context.active(), carrier);
}

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes: Record<string, string | number | boolean> = {}
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

// In-Memory Prometheus-compatible Metrics Registry for Self-Observability
export interface MetricDataPoint {
  labels: Record<string, string>;
  value: number;
  timestamp: number;
}

class MetricsRegistry {
  private counters = new Map<string, Map<string, number>>();
  private gauges = new Map<string, Map<string, number>>();
  private histograms = new Map<string, { count: number; sum: number; buckets: Map<number, number> }>();

  private serializeLabels(labels: Record<string, string>): string {
    const keys = Object.keys(labels).sort();
    if (keys.length === 0) return "";
    return "{" + keys.map((k) => `${k}="${labels[k]}"`).join(",") + "}";
  }

  incCounter(name: string, value = 1, labels: Record<string, string> = {}): void {
    if (!this.counters.has(name)) {
      this.counters.set(name, new Map());
    }
    const map = this.counters.get(name)!;
    const key = this.serializeLabels(labels);
    map.set(key, (map.get(key) || 0) + value);
  }

  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, new Map());
    }
    const map = this.gauges.get(name)!;
    const key = this.serializeLabels(labels);
    map.set(key, value);
  }

  observeHistogram(name: string, value: number, buckets = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]): void {
    if (!this.histograms.has(name)) {
      const bucketMap = new Map<number, number>();
      for (const b of buckets) bucketMap.set(b, 0);
      this.histograms.set(name, { count: 0, sum: 0, buckets: bucketMap });
    }
    const hist = this.histograms.get(name)!;
    hist.count++;
    hist.sum += value;
    for (const b of buckets) {
      if (value <= b) {
        hist.buckets.set(b, (hist.buckets.get(b) || 0) + 1);
      }
    }
  }

  toPrometheusFormat(): string {
    const lines: string[] = [];

    // Counters
    for (const [name, map] of this.counters.entries()) {
      lines.push(`# TYPE ${name} counter`);
      for (const [labels, val] of map.entries()) {
        lines.push(`${name}${labels} ${val}`);
      }
    }

    // Gauges
    for (const [name, map] of this.gauges.entries()) {
      lines.push(`# TYPE ${name} gauge`);
      for (const [labels, val] of map.entries()) {
        lines.push(`${name}${labels} ${val}`);
      }
    }

    // Histograms
    for (const [name, hist] of this.histograms.entries()) {
      lines.push(`# TYPE ${name} histogram`);
      for (const [le, count] of hist.buckets.entries()) {
        lines.push(`${name}_bucket{le="${le}"} ${count}`);
      }
      lines.push(`${name}_bucket{le="+Inf"} ${hist.count}`);
      lines.push(`${name}_sum ${hist.sum.toFixed(4)}`);
      lines.push(`${name}_count ${hist.count}`);
    }

    return lines.join("\n") + "\n";
  }
}

export const metrics = new MetricsRegistry();
