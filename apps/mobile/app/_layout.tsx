import React, { useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 5000,
          },
        },
      })
  );

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: "#111726",
            },
            headerTintColor: "#e2e8f0",
            headerTitleStyle: {
              fontWeight: "bold",
              fontSize: 16,
            },
            contentStyle: {
              backgroundColor: "#090d16",
            },
          }}
        >
          <Stack.Screen name="index" options={{ title: "NetScope X" }} />
          <Stack.Screen name="monitors/index" options={{ title: "Monitors" }} />
          <Stack.Screen name="monitors/[id]" options={{ title: "Monitor Telemetry" }} />
          <Stack.Screen name="incidents/index" options={{ title: "Incidents" }} />
          <Stack.Screen name="diagnostics" options={{ title: "HTTP Diagnostics" }} />
          <Stack.Screen name="settings" options={{ title: "Settings & Offline" }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
