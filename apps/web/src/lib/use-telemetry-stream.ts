"use client";

import { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface StreamEvent {
  type: string;
  data: Record<string, any>;
  timestamp: string;
}

export function useTelemetryStream() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<StreamEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let active = true;

    function connect() {
      if (!active) return;

      try {
        const es = new EventSource(`${API_BASE}/api/v1/stream/events`);
        eventSourceRef.current = es;

        es.onopen = () => {
          if (active) setIsConnected(true);
        };

        es.addEventListener("handshake", (e) => {
          try {
            const data = JSON.parse(e.data);
            if (active) {
              setIsConnected(true);
              setLastEvent({ type: "handshake", data, timestamp: new Date().toISOString() });
            }
          } catch {}
        });

        es.addEventListener("probe_result", (e) => {
          try {
            const parsed = JSON.parse(e.data);
            if (active) {
              setLastEvent(parsed);
              queryClient.invalidateQueries({ queryKey: ["monitors"] });
              queryClient.invalidateQueries({ queryKey: ["monitor-results"] });
            }
          } catch {}
        });

        es.addEventListener("monitor_state", (e) => {
          try {
            const parsed = JSON.parse(e.data);
            if (active) {
              setLastEvent(parsed);
              queryClient.invalidateQueries({ queryKey: ["monitors"] });
            }
          } catch {}
        });

        es.addEventListener("incident", (e) => {
          try {
            const parsed = JSON.parse(e.data);
            if (active) {
              setLastEvent(parsed);
              queryClient.invalidateQueries({ queryKey: ["incidents"] });
            }
          } catch {}
        });

        es.addEventListener("slo_evaluated", (e) => {
          try {
            const parsed = JSON.parse(e.data);
            if (active) {
              setLastEvent(parsed);
              queryClient.invalidateQueries({ queryKey: ["slos"] });
              queryClient.invalidateQueries({ queryKey: ["slo-eval"] });
            }
          } catch {}
        });

        es.onerror = () => {
          if (active) setIsConnected(false);
          es.close();
          // Reconnect with backoff
          if (active) {
            setTimeout(connect, 3000);
          }
        };
      } catch (err) {
        if (active) {
          setIsConnected(false);
          setTimeout(connect, 5000);
        }
      }
    }

    connect();

    return () => {
      active = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [queryClient]);

  return { isConnected, lastEvent };
}
