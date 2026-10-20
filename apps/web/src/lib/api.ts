const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const errorBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorBody.error || `HTTP error ${res.status}`);
  }
  return (await res.json()) as T;
}

export const api = {
  getMonitors: () => fetchJson<any[]>("/api/v1/monitors"),
  getMonitor: (id: string) => fetchJson<any>(`/api/v1/monitors/${id}`),
  createMonitor: (data: any) =>
    fetchJson<any>("/api/v1/monitors", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  triggerCheck: (id: string) =>
    fetchJson<{ success: boolean; jobId: string }>(`/api/v1/monitors/${id}/trigger`, {
      method: "POST",
    }),
  getMonitorResults: (id: string, limit = 50) =>
    fetchJson<any[]>(`/api/v1/monitors/${id}/results?limit=${limit}`),
  getMonitorRegression: (id: string, metric = "p95_latency") =>
    fetchJson<any>(`/api/v1/monitors/${id}/regression?metric=${metric}`),
  diagnoseMonitor: (id: string) =>
    fetchJson<any>(`/api/v1/monitors/${id}/diagnose`),

  getIncidents: () => fetchJson<any[]>("/api/v1/incidents"),
  getIncident: (id: string) => fetchJson<any>(`/api/v1/incidents/${id}`),
  acknowledgeIncident: (id: string, user = "SRE On-Call") =>
    fetchJson<any>(`/api/v1/incidents/${id}/acknowledge`, {
      method: "POST",
      body: JSON.stringify({ user }),
    }),
  resolveIncident: (id: string, user = "SRE On-Call", reason = "Issue resolved") =>
    fetchJson<any>(`/api/v1/incidents/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ user, reason }),
    }),
  getIncidentTimeline: (id: string) =>
    fetchJson<any[]>(`/api/v1/incidents/${id}/timeline`),
  getIncidentReplay: (id: string) =>
    fetchJson<any>(`/api/v1/incidents/${id}/replay`),
  getIncidentReport: async (id: string) => {
    const res = await fetch(`${API_BASE}/api/v1/incidents/${id}/report`);
    return res.text();
  },

  getSlos: () => fetchJson<any[]>("/api/v1/slos"),
  evaluateSlo: (id: string) => fetchJson<any>(`/api/v1/slos/${id}/evaluate`),

  runLoadTest: (config: any) =>
    fetchJson<any>("/api/v1/load-tests/run", {
      method: "POST",
      body: JSON.stringify(config),
    }),

  runSyntheticJourney: (journey: any) =>
    fetchJson<any>("/api/v1/journeys/run", {
      method: "POST",
      body: JSON.stringify(journey),
    }),

  getWorkers: () => fetchJson<any[]>("/api/v1/workers"),
  getHealth: () => fetchJson<any>("/ready"),
};
