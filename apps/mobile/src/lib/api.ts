import { getItem, saveToOfflineCache, loadFromOfflineCache, CachedData } from "./storage";

export const DEFAULT_API_URL = "http://10.0.2.2:4000"; // Default Android emulator host loopback or localhost

export async function getBaseUrl(): Promise<string> {
  const custom = await getItem("custom_api_url");
  return custom || "http://localhost:4000";
}

export async function fetchWithCache<T>(
  endpoint: string,
  cacheKey: string
): Promise<{ data: T; isFromCache: boolean; lastUpdated: string }> {
  const baseUrl = await getBaseUrl();
  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      const json = (await res.json()) as T;
      const now = new Date().toISOString();
      await saveToOfflineCache(cacheKey, json);
      return { data: json, isFromCache: false, lastUpdated: now };
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (networkError) {
    // Graceful offline fallback: read from local cache
    const cached = await loadFromOfflineCache<T>(cacheKey);
    if (cached) {
      return {
        data: cached.data,
        isFromCache: true,
        lastUpdated: cached.cachedAt,
      };
    }
    throw networkError;
  }
}

export const mobileApi = {
  getMonitors: () => fetchWithCache<any[]>("/api/v1/monitors", "monitors"),
  getMonitor: (id: string) =>
    fetchWithCache<any>(`/api/v1/monitors/${id}`, `monitor_${id}`),
  getMonitorResults: (id: string) =>
    fetchWithCache<any[]>(`/api/v1/monitors/${id}/results?limit=15`, `results_${id}`),
  triggerCheck: async (id: string) => {
    const baseUrl = await getBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/monitors/${id}/trigger`, {
      method: "POST",
    });
    return res.json();
  },
  getIncidents: () => fetchWithCache<any[]>("/api/v1/incidents", "incidents"),
  getIncident: (id: string) =>
    fetchWithCache<any>(`/api/v1/incidents/${id}`, `incident_${id}`),
  acknowledgeIncident: async (id: string, user: string) => {
    const baseUrl = await getBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/incidents/${id}/acknowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user }),
    });
    return res.json();
  },
  resolveIncident: async (id: string, user: string, reason: string) => {
    const baseUrl = await getBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/incidents/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, reason }),
    });
    return res.json();
  },
  getSlos: () => fetchWithCache<any[]>("/api/v1/slos", "slos"),
};
