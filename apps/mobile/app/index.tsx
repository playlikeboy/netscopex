import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { mobileApi } from "../src/lib/api";

export default function MobileOverviewScreen() {
  const router = useRouter();

  const {
    data: monitorData,
    isLoading: monitorsLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["mobile-monitors"],
    queryFn: mobileApi.getMonitors,
  });

  const { data: incidentData } = useQuery({
    queryKey: ["mobile-incidents"],
    queryFn: mobileApi.getIncidents,
  });

  const monitors = monitorData?.data || [];
  const isFromCache = monitorData?.isFromCache || false;
  const lastUpdated = monitorData?.lastUpdated;

  const incidents = incidentData?.data || [];
  const openIncidents = incidents.filter((i) => i.status !== "RESOLVED").length;

  const activeCount = monitors.filter((m) => m.state === "active").length;
  const degradedCount = monitors.filter((m) => m.state === "degraded").length;
  const downCount = monitors.filter((m) => m.state === "down").length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor="#3b82f6"
        />
      }
    >
      {/* Offline Cache Indicator Banner */}
      {isFromCache && (
        <View style={styles.cacheBanner}>
          <Text style={styles.cacheBannerText}>
            OFFLINE MODE: Displaying locally cached telemetry.
          </Text>
          {lastUpdated && (
            <Text style={styles.cacheBannerSubtext}>
              Cached at: {new Date(lastUpdated).toLocaleTimeString()}
            </Text>
          )}
        </View>
      )}

      {/* Hero Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { borderLeftColor: "#3b82f6" }]}>
          <Text style={styles.statLabel}>MONITORS</Text>
          <Text style={styles.statNumber}>{monitors.length}</Text>
          <Text style={styles.statMeta}>{activeCount} active</Text>
        </View>

        <View
          style={[
            styles.statBox,
            { borderLeftColor: openIncidents > 0 ? "#ef4444" : "#10b981" },
          ]}
        >
          <Text style={styles.statLabel}>INCIDENTS</Text>
          <Text
            style={[
              styles.statNumber,
              { color: openIncidents > 0 ? "#ef4444" : "#10b981" },
            ]}
          >
            {openIncidents}
          </Text>
          <Text style={styles.statMeta}>
            {openIncidents === 0 ? "All healthy" : "Active outage"}
          </Text>
        </View>
      </View>

      {/* Navigation Quick Links */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push("/monitors")}
        >
          <Text style={styles.navButtonText}>All Monitors ({monitors.length})</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push("/incidents")}
        >
          <Text style={styles.navButtonText}>Incidents ({openIncidents})</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push("/diagnostics")}
        >
          <Text style={styles.navButtonText}>Diagnostics Tool</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push("/settings")}
        >
          <Text style={styles.navButtonText}>Settings & Offline</Text>
        </TouchableOpacity>
      </View>

      {/* Target Status Snapshot */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Target Endpoints</Text>

        {monitorsLoading && monitors.length === 0 ? (
          <Text style={styles.loadingText}>Fetching target statuses...</Text>
        ) : monitors.length === 0 ? (
          <Text style={styles.loadingText}>No monitors found.</Text>
        ) : (
          monitors.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={styles.monitorCard}
              onPress={() => router.push(`/monitors/${m.id}`)}
            >
              <View style={styles.monitorHeader}>
                <View style={styles.titleRow}>
                  <View
                    style={[
                      styles.stateDot,
                      {
                        backgroundColor:
                          m.state === "active"
                            ? "#10b981"
                            : m.state === "degraded"
                            ? "#f59e0b"
                            : m.state === "down"
                            ? "#ef4444"
                            : "#64748b",
                      },
                    ]}
                  />
                  <Text style={styles.monitorName}>{m.name}</Text>
                </View>

                <Text
                  style={[
                    styles.stateBadge,
                    {
                      color:
                        m.state === "active"
                          ? "#34d399"
                          : m.state === "degraded"
                          ? "#fbbf24"
                          : m.state === "down"
                          ? "#f87171"
                          : "#94a3b8",
                    },
                  ]}
                >
                  {m.state.toUpperCase()}
                </Text>
              </View>

              <Text style={styles.monitorUrl}>{m.url}</Text>
              {m.stateReason && (
                <Text style={styles.monitorReason}>{m.stateReason}</Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#090d16",
  },
  content: {
    padding: 16,
  },
  cacheBanner: {
    backgroundColor: "#1e1b4b",
    borderColor: "#4338ca",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  cacheBannerText: {
    color: "#a5b4fc",
    fontWeight: "bold",
    fontSize: 12,
  },
  cacheBannerSubtext: {
    color: "#818cf8",
    fontSize: 10,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#111726",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#232e4a",
    borderLeftWidth: 4,
    padding: 14,
  },
  statLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  statNumber: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "bold",
    marginTop: 4,
  },
  statMeta: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  navButton: {
    flex: 1,
    backgroundColor: "#1a233a",
    borderColor: "#232e4a",
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
  },
  navButtonText: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
  },
  section: {
    marginTop: 14,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 10,
  },
  loadingText: {
    color: "#64748b",
    fontSize: 12,
  },
  monitorCard: {
    backgroundColor: "#111726",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#232e4a",
    padding: 12,
    marginBottom: 10,
  },
  monitorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  monitorName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  stateBadge: {
    fontSize: 10,
    fontWeight: "bold",
  },
  monitorUrl: {
    color: "#64748b",
    fontSize: 11,
    fontFamily: "monospace",
    marginTop: 4,
  },
  monitorReason: {
    color: "#cbd5e1",
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 4,
  },
});
