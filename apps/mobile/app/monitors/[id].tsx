import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mobileApi } from "../../src/lib/api";

export default function MonitorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: monitorData, refetch, isRefetching } = useQuery({
    queryKey: ["mobile-monitor", id],
    queryFn: () => mobileApi.getMonitor(id!),
    enabled: !!id,
  });

  const { data: resultsData } = useQuery({
    queryKey: ["mobile-monitor-results", id],
    queryFn: () => mobileApi.getMonitorResults(id!),
    enabled: !!id,
  });

  const triggerMutation = useMutation({
    mutationFn: () => mobileApi.triggerCheck(id!),
    onSuccess: () => {
      Alert.alert("Success", "Probe check dispatched to distributed workers");
      queryClient.invalidateQueries({ queryKey: ["mobile-monitor", id] });
      queryClient.invalidateQueries({ queryKey: ["mobile-monitor-results", id] });
    },
  });

  const monitor = monitorData?.data;
  const results = resultsData?.data || [];
  const latestResult = results[0];

  if (!monitor) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Loading monitor details...</Text>
      </View>
    );
  }

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
      {/* Header Info */}
      <View style={styles.headerCard}>
        <View style={styles.row}>
          <Text style={styles.name}>{monitor.name}</Text>
          <Text
            style={[
              styles.stateText,
              {
                color:
                  monitor.state === "active"
                    ? "#34d399"
                    : monitor.state === "degraded"
                    ? "#fbbf24"
                    : monitor.state === "down"
                    ? "#f87171"
                    : "#94a3b8",
              },
            ]}
          >
            {monitor.state.toUpperCase()}
          </Text>
        </View>

        <Text style={styles.url}>{monitor.url}</Text>

        {monitor.stateReason && (
          <Text style={styles.reason}>{monitor.stateReason}</Text>
        )}

        <TouchableOpacity
          style={styles.triggerButton}
          onPress={() => triggerMutation.mutate()}
          disabled={triggerMutation.isPending}
        >
          <Text style={styles.triggerText}>
            {triggerMutation.isPending ? "Scheduling..." : "Run Probe Check Now"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Latest Timing Breakdown */}
      {latestResult && (
        <View style={styles.timingCard}>
          <Text style={styles.sectionHeader}>Latest Network Timing (ms)</Text>
          <Text style={styles.totalDuration}>
            Total: {latestResult.timing?.totalDurationMs?.toFixed(1)} ms
          </Text>

          <View style={styles.timingGrid}>
            <View style={styles.timingItem}>
              <Text style={styles.timingLabel}>DNS</Text>
              <Text style={styles.timingValue}>
                {latestResult.timing?.dnsLookupMs?.toFixed(1)}
              </Text>
            </View>

            <View style={styles.timingItem}>
              <Text style={styles.timingLabel}>TCP</Text>
              <Text style={styles.timingValue}>
                {latestResult.timing?.tcpConnectionMs?.toFixed(1)}
              </Text>
            </View>

            <View style={styles.timingItem}>
              <Text style={styles.timingLabel}>TLS</Text>
              <Text style={styles.timingValue}>
                {latestResult.timing?.tlsHandshakeMs?.toFixed(1)}
              </Text>
            </View>

            <View style={styles.timingItem}>
              <Text style={styles.timingLabel}>TTFB</Text>
              <Text style={styles.timingValue}>
                {latestResult.timing?.ttfbMs?.toFixed(1)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Recent History */}
      <View style={styles.historyCard}>
        <Text style={styles.sectionHeader}>Recent Check History</Text>
        {results.length === 0 ? (
          <Text style={styles.text}>No checks recorded yet.</Text>
        ) : (
          results.map((r: any) => (
            <View key={r.id} style={styles.historyRow}>
              <Text
                style={[
                  styles.historyStatus,
                  { color: r.success ? "#34d399" : "#f87171" },
                ]}
              >
                {r.statusCode || "ERR"}
              </Text>
              <Text style={styles.historyDuration}>
                {r.timing?.totalDurationMs?.toFixed(0)} ms
              </Text>
              <Text style={styles.historyRegion}>{r.probeRegion}</Text>
              <Text style={styles.historyTime}>
                {new Date(r.executedAt).toLocaleTimeString()}
              </Text>
            </View>
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
  center: {
    flex: 1,
    backgroundColor: "#090d16",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "#94a3b8",
    fontSize: 12,
  },
  headerCard: {
    backgroundColor: "#111726",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#232e4a",
    padding: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
  stateText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  url: {
    color: "#64748b",
    fontSize: 11,
    fontFamily: "monospace",
    marginTop: 4,
  },
  reason: {
    color: "#cbd5e1",
    fontSize: 12,
    marginTop: 8,
    fontStyle: "italic",
  },
  triggerButton: {
    backgroundColor: "#2563eb",
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 14,
  },
  triggerText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 12,
  },
  timingCard: {
    backgroundColor: "#111726",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#232e4a",
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 8,
  },
  totalDuration: {
    color: "#60a5fa",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  timingGrid: {
    flexDirection: "row",
    gap: 8,
  },
  timingItem: {
    flex: 1,
    backgroundColor: "#1a233a",
    padding: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  timingLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "bold",
  },
  timingValue: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 2,
  },
  historyCard: {
    backgroundColor: "#111726",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#232e4a",
    padding: 16,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  historyStatus: {
    fontSize: 12,
    fontWeight: "bold",
    width: 45,
  },
  historyDuration: {
    color: "#ffffff",
    fontSize: 12,
    width: 60,
  },
  historyRegion: {
    color: "#94a3b8",
    fontSize: 11,
    width: 90,
  },
  historyTime: {
    color: "#64748b",
    fontSize: 11,
  },
});
