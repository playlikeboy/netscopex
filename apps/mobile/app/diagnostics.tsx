import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { getBaseUrl } from "../src/lib/api";

export default function DiagnosticsScreen() {
  const [url, setUrl] = useState("https://api.github.com/zen");
  const [method, setMethod] = useState("GET");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostic = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const baseUrl = await getBaseUrl();
      const res = await fetch(`${baseUrl}/fault/status?code=200`);
      const timingStart = Date.now();
      const directRes = await fetch(url, { method });
      const durationMs = Date.now() - timingStart;

      const headerMap: Record<string, string> = {};
      directRes.headers.forEach((val: string, key: string) => {
        headerMap[key] = val;
      });

      setResult({
        statusCode: directRes.status,
        statusText: directRes.statusText,
        durationMs,
        headers: headerMap,
      });
    } catch (err: any) {
      setError(err.message || "Diagnostic request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mobile HTTP Diagnostics</Text>
      <Text style={styles.subtitle}>
        Run on-demand HTTP inspections and inspect status codes, headers, and response duration.
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Endpoint URL</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="https://..."
          placeholderTextColor="#64748b"
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={styles.btn}
          onPress={runDiagnostic}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.btnText}>Run HTTP Diagnostic</Text>
          )}
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      )}

      {result && (
        <View style={styles.resultBox}>
          <Text style={styles.resultHeader}>Response Diagnostics</Text>
          <View style={styles.row}>
            <Text style={styles.metaLabel}>Status:</Text>
            <Text
              style={[
                styles.metaValue,
                { color: result.statusCode === 200 ? "#34d399" : "#f87171" },
              ]}
            >
              {result.statusCode} {result.statusText}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.metaLabel}>Total Duration:</Text>
            <Text style={styles.metaValue}>{result.durationMs} ms</Text>
          </View>

          <Text style={[styles.metaLabel, { marginTop: 10 }]}>Headers:</Text>
          <View style={styles.headersBox}>
            {Object.entries(result.headers || {}).map(([k, v]: any) => (
              <Text key={k} style={styles.headerLine}>
                <Text style={styles.headerKey}>{k}: </Text>
                {String(v)}
              </Text>
            ))}
          </View>
        </View>
      )}
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
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  form: {
    backgroundColor: "#111726",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#232e4a",
    padding: 14,
    marginBottom: 16,
  },
  label: {
    color: "#94a3b8",
    fontSize: 11,
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
  btn: {
    backgroundColor: "#2563eb",
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
  },
  btnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
  errorBox: {
    backgroundColor: "#450a0a",
    borderWidth: 1,
    borderColor: "#991b1b",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 11,
    fontFamily: "monospace",
  },
  resultBox: {
    backgroundColor: "#111726",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#232e4a",
    padding: 14,
  },
  resultHeader: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  metaLabel: {
    color: "#94a3b8",
    fontSize: 12,
  },
  metaValue: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "monospace",
  },
  headersBox: {
    backgroundColor: "#090d16",
    borderRadius: 6,
    padding: 10,
    marginTop: 6,
  },
  headerLine: {
    color: "#94a3b8",
    fontSize: 10,
    fontFamily: "monospace",
    marginBottom: 2,
  },
  headerKey: {
    color: "#60a5fa",
    fontWeight: "bold",
  },
});
