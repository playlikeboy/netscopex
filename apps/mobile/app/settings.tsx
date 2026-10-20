import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { getItem, setItem, removeItem } from "../src/lib/storage";

export default function SettingsScreen() {
  const [apiUrl, setApiUrl] = useState("http://localhost:4000");

  useEffect(() => {
    getItem("custom_api_url").then((saved) => {
      if (saved) setApiUrl(saved);
    });
  }, []);

  const handleSave = async () => {
    await setItem("custom_api_url", apiUrl);
    Alert.alert("Saved", "API Endpoint configuration updated");
  };

  const handleClearCache = async () => {
    await removeItem("cache_monitors");
    await removeItem("cache_incidents");
    await removeItem("cache_slos");
    Alert.alert("Cache Cleared", "Local offline cache has been purged");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Settings & Local Storage</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Control Plane API URL</Text>
        <TextInput
          style={styles.input}
          value={apiUrl}
          onChangeText={setApiUrl}
          autoCapitalize="none"
        />

        <TouchableOpacity style={styles.btn} onPress={handleSave}>
          <Text style={styles.btnText}>Save Endpoint</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Offline Persistence</Text>
        <Text style={styles.infoText}>
          NetScope X caches monitor states and incidents locally so that network
          hiccups on your mobile device do not misrepresent target service uptime.
        </Text>

        <TouchableOpacity
          style={[styles.btn, styles.clearBtn]}
          onPress={handleClearCache}
        >
          <Text style={styles.btnText}>Purge Local Cache</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#090d16",
    padding: 16,
  },
  header: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#111726",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#232e4a",
    padding: 14,
    marginBottom: 16,
  },
  label: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#090d16",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#232e4a",
    padding: 10,
    color: "#ffffff",
    fontSize: 12,
    fontFamily: "monospace",
    marginBottom: 12,
  },
  infoText: {
    color: "#94a3b8",
    fontSize: 11,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: "#2563eb",
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
  },
  clearBtn: {
    backgroundColor: "#475569",
  },
  btnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
});
