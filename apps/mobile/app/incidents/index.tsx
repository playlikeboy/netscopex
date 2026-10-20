import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mobileApi } from "../../src/lib/api";

export default function IncidentsListScreen() {
  const queryClient = useQueryClient();
  const { data, refetch, isRefetching } = useQuery({
    queryKey: ["mobile-incidents"],
    queryFn: mobileApi.getIncidents,
  });

  const ackMutation = useMutation({
    mutationFn: (id: string) => mobileApi.acknowledgeIncident(id, "Mobile SRE On-Call"),
    onSuccess: () => {
      Alert.alert("Success", "Incident acknowledged");
      queryClient.invalidateQueries({ queryKey: ["mobile-incidents"] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) =>
      mobileApi.resolveIncident(id, "Mobile SRE On-Call", "Resolved via mobile console"),
    onSuccess: () => {
      Alert.alert("Success", "Incident marked as resolved");
      queryClient.invalidateQueries({ queryKey: ["mobile-incidents"] });
    },
  });

  const incidents = data?.data || [];

  return (
    <View style={styles.container}>
      <FlatList
        data={incidents}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#3b82f6"
          />
        }
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text
                style={[
                  styles.severity,
                  {
                    color: item.severity === "CRITICAL" ? "#f87171" : "#fbbf24",
                  },
                ]}
              >
                {item.severity}
              </Text>
              <Text
                style={[
                  styles.status,
                  {
                    color:
                      item.status === "TRIGGERED"
                        ? "#f87171"
                        : item.status === "ACKNOWLEDGED"
                        ? "#fbbf24"
                        : "#34d399",
                  },
                ]}
              >
                {item.status}
              </Text>
            </View>

            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.time}>
              Triggered: {new Date(item.triggeredAt).toLocaleString()}
            </Text>

            {item.rootCauseSummary && (
              <Text style={styles.summary}>{item.rootCauseSummary}</Text>
            )}

            {/* Action buttons */}
            <View style={styles.actions}>
              {item.status === "TRIGGERED" && (
                <TouchableOpacity
                  style={[styles.btn, styles.ackBtn]}
                  onPress={() => ackMutation.mutate(item.id)}
                >
                  <Text style={styles.btnText}>Acknowledge</Text>
                </TouchableOpacity>
              )}

              {item.status !== "RESOLVED" && (
                <TouchableOpacity
                  style={[styles.btn, styles.resolveBtn]}
                  onPress={() => resolveMutation.mutate(item.id)}
                >
                  <Text style={styles.btnText}>Resolve</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#090d16",
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: "#111726",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#232e4a",
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  severity: {
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  status: {
    fontSize: 10,
    fontWeight: "bold",
  },
  title: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "bold",
    marginTop: 6,
  },
  time: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 4,
    fontFamily: "monospace",
  },
  summary: {
    color: "#cbd5e1",
    fontSize: 11,
    marginTop: 8,
    backgroundColor: "#1a233a",
    padding: 8,
    borderRadius: 6,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  ackBtn: {
    backgroundColor: "#d97706",
  },
  resolveBtn: {
    backgroundColor: "#059669",
  },
  btnText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 11,
  },
});
