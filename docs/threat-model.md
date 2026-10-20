# NetScope X Threat Model & Security Engineering

## 1. System Assets & Security Objectives
- **Target Endpoints:** External client APIs and web services being monitored.
- **Probe Worker Sockets:** Raw network egress from distributed workers.
- **Internal Infrastructure:** PostgreSQL database, control plane API, cloud metadata services, and internal VPC subnets.
- **Operational Data:** Monitor configurations, custom headers, tokens, and probe results.

---

## 2. Trust Boundaries & Attack Vectors

```
[ Untrusted Client / Mobile App ]
             │
      (1) HTTPS / JWT Auth
             ▼
[ NetScope X API Gateway ]
             │
      (2) Database Pooling (ACID)
             ▼
[ PostgreSQL 16 Storage ] ◄── (3) Durable Lease Queue
                                      │
                                      ▼
                        [ Distributed Probe Workers ]
                                      │
                               (4) Outbound HTTP Probes
                                      ▼
                        [ External Destination Services ]
```

---

## 3. Threat Analysis & Mitigations

### Threat A: Server-Side Request Forgery (SSRF)
- **Risk:** Malicious or compromised users configure monitors to query internal VPC services (e.g., PostgreSQL on `10.0.0.5:5432`), loopback services (`127.0.0.1`), or cloud provider instance metadata (`http://169.254.169.254/latest/meta-data/`).
- **Mitigations Implemented:**
  1. **Strict Protocol Whitelist:** Only `http:` and `https:` protocols are accepted. `file:`, `ftp:`, `gopher:`, `ldap:`, etc. are rejected at parse time.
  2. **Comprehensive Subnet Blacklisting:** Every destination hostname is resolved to IPv4 and IPv6 addresses and checked against prohibited CIDRs:
     - Loopback (`127.0.0.0/8`, `::1`)
     - Private RFC1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`)
     - Link-Local (`169.254.0.0/16`, `fe80::/10`)
     - Cloud Metadata (`169.254.169.254`, `metadata.google.internal`)
     - Carrier-Grade NAT (`100.64.0.0/10`)
     - IPv4-Mapped IPv6 variants (e.g. `::ffff:127.0.0.1`, `::ffff:10.0.0.1`)
  3. **DNS Rebinding Defense:** Address validation is enforced not just at pre-flight, but at the socket connection level (`socket.on('lookup')`). If a DNS server returns a benign IP during pre-flight but resolves to an internal IP at connect time, the socket is immediately aborted.
  4. **Per-Redirect Hop Re-validation:** Every redirect destination (HTTP 301, 302, 307, 308) is re-validated through the full SSRF pipeline before following.
  5. **TLS Integrity:** TLS validation is never disabled (`rejectUnauthorized: true`). Self-signed or expired certificates are classified strictly as `TLS_ERROR` and never silently bypassed.

### Threat B: Denial of Service via Synthetic Probes or Load Testing
- **Risk:** Excessive concurrency or malicious load testing floods external targets.
- **Mitigations Implemented:**
  1. Hard concurrency ceiling: Maximum 50 Virtual Users (VUs) and 60 seconds duration for load tests.
  2. Automatic Safety Circuit Breaker: If target error rate exceeds 50% or latency exceeds 5,000ms after 20 samples, the test immediately aborts.
  3. Bounded probe responses: Body previews are strictly capped at 16 KB to protect worker memory.

### Threat C: Credential & Secret Leakage
- **Risk:** Sensitive authentication headers (`Authorization`, `Cookie`, `X-Api-Key`) captured during probes are exposed in logs or database tables.
- **Mitigations Implemented:**
  1. `redactHeaders()` utility intercepts and replaces sensitive headers with `[REDACTED]` prior to database persistence and structured log emission.

### Threat D: Insecure Webhook Delivery
- **Risk:** Malicious actors spoof webhook alert notifications.
- **Mitigations Implemented:**
  1. Signed webhooks: Payloads include HMAC-SHA256 signatures in `X-NetScope-Signature` calculated with the customer's shared secret.
