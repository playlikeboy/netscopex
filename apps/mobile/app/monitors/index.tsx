import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { mobileApi } from "../../src/lib/api";

export default function MonitorsListScreen() {
  const router = useRouter();
  const { data, refetch, isRefetching } = useQuery({
    queryKey: ["mobile-monitors"],
    queryFn: mobileApi.getMonitors,
  });

  const monitors = data?.data || [];
  const isFromCache = data?.isFromCache;

  return (
    <View style={styles.container}>
      {isFromCache && (
        <View style={styles.cacheWarning}>
          <Text style={styles.cacheWarningText}>Showing cached monitors</Text>
        </View>
      )}

      <FlatList
        data={monitors}
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
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/monitors/${item.id}`)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{item.name}</Text>
              <Text
                style={[
                  styles.badge,
                  {
                    color:
                      item.state === "active"
                        ? "#34d399"
                        : item.state === "degraded"
                        ? "#fbbf24"
                        : item.state === "down"
                        ? "#f87171"
                        : "#94a3b8",
                  },
                ]}
              >
                {item.state.toUpperCase()}
              </Text>
            </View>

            <Text style={styles.url}>{item.url}</Text>

            <View style={styles.cardFooter}>
              <Text style={styles.meta}>
                Method: {item.method} · {item.intervalSeconds}s
              </Text>
              <Text style={styles.tapText}>Inspect Details →</Text>
            </View>
          </TouchableOpacity>
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
  cacheWarning: {
    backgroundColor: "#1e1b4b",
    padding: 8,
    alignItems: "center",
  },
  cacheWarningText: {
    color: "#a5b4fc",
    fontSize: 11,
    fontWeight: "bold",
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
    alignItems: "center",
  },
  name: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "bold",
  },
  badge: {
    fontSize: 11,
    fontWeight: "bold",
  },
  url: {
    color: "#64748b",
    fontSize: 11,
    fontFamily: "monospace",
    marginTop: 4,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  meta: {
    color: "#94a3b8",
    fontSize: 11,
  },
  tapText: {
    color: "#60a5fa",
    fontSize: 11,
    fontWeight: "600",
  },
});
