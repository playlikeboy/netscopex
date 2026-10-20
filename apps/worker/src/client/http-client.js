import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import { validateTargetUrl, isIpSafe } from "./ssrf-validator.js";
const SENSITIVE_HEADERS = new Set([
    "authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "apikey",
    "x-auth-token",
    "proxy-authorization",
]);
function redactHeaders(rawHeaders) {
    const result = {};
    for (const [key, value] of Object.entries(rawHeaders)) {
        if (!value)
            continue;
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_HEADERS.has(lowerKey)) {
            result[key] = "[REDACTED]";
        }
        else {
            result[key] = Array.isArray(value) ? value.join(", ") : value;
        }
    }
    return result;
}
export async function executeProbeRequest(options) {
    const { url: targetUrl, method = "GET", headers = {}, body, timeoutMs = 5000, expectedStatusCodes = [200], maxRedirects = 5, allowLocalTest = false, } = options;
    let currentUrl = targetUrl;
    let redirectsFollowed = 0;
    while (redirectsFollowed <= maxRedirects) {
        // 1. SSRF Pre-flight Validation
        const ssrfCheck = await validateTargetUrl(currentUrl, allowLocalTest);
        if (!ssrfCheck.valid) {
            return {
                statusCode: null,
                headers: {},
                timing: {
                    dnsLookupMs: 0,
                    tcpConnectionMs: 0,
                    tlsHandshakeMs: 0,
                    ttfbMs: 0,
                    contentDownloadMs: 0,
                    totalDurationMs: 0,
                },
                success: false,
                redirectCount: redirectsFollowed,
                error: {
                    classification: "SSRF_BLOCKED",
                    message: ssrfCheck.errorReason || "SSRF validation failed",
                },
            };
        }
        const parsedUrl = new URL(currentUrl);
        const isHttps = parsedUrl.protocol === "https:";
        const transport = isHttps ? https : http;
        const result = await new Promise((resolve) => {
            const startTime = process.hrtime.bigint();
            let dnsStart = null;
            let dnsLookupMs = 0;
            let tcpStart = null;
            let tcpConnectionMs = 0;
            let tlsStart = null;
            let tlsHandshakeMs = 0;
            let ttfbMs = 0;
            let contentDownloadMs = 0;
            let totalDurationMs = 0;
            let resolvedIp = ssrfCheck.resolvedIp;
            let isCompleted = false;
            const calcMs = (start, end) => Number((end - start) / 1000000n) + Number((end - start) % 1000000n) / 1000000;
            const reqOptions = {
                protocol: parsedUrl.protocol,
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (isHttps ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method,
                headers: {
                    "User-Agent": "NetScopeX-Probe/1.0",
                    Accept: "*/*",
                    ...headers,
                },
                timeout: timeoutMs,
            };
            if (isHttps) {
                // Enforce strict TLS certificate verification
                reqOptions.rejectUnauthorized = true;
            }
            const req = transport.request(reqOptions, (res) => {
                const ttfbTime = process.hrtime.bigint();
                ttfbMs = calcMs(startTime, ttfbTime);
                const chunks = [];
                let totalBytes = 0;
                const maxPreviewSize = 16384; // 16 KB max preview
                res.on("data", (chunk) => {
                    if (totalBytes < maxPreviewSize) {
                        chunks.push(chunk);
                    }
                    totalBytes += chunk.length;
                });
                res.on("end", () => {
                    if (isCompleted)
                        return;
                    isCompleted = true;
                    const endTime = process.hrtime.bigint();
                    totalDurationMs = calcMs(startTime, endTime);
                    contentDownloadMs = Math.max(0, totalDurationMs - ttfbMs);
                    const statusCode = res.statusCode || 0;
                    const isExpected = expectedStatusCodes.includes(statusCode);
                    // Handle Redirects
                    if ([301, 302, 303, 307, 308].includes(statusCode) &&
                        res.headers.location &&
                        redirectsFollowed < maxRedirects) {
                        const nextUrl = new URL(res.headers.location, currentUrl).toString();
                        resolve({
                            statusCode,
                            headers: redactHeaders(res.headers),
                            timing: {
                                dnsLookupMs,
                                tcpConnectionMs,
                                tlsHandshakeMs,
                                ttfbMs,
                                contentDownloadMs,
                                totalDurationMs,
                            },
                            success: isExpected,
                            redirectCount: redirectsFollowed,
                            resolvedIp,
                            bodyPreview: `REDIRECT to ${nextUrl}`,
                        });
                        return;
                    }
                    const bodyBuffer = Buffer.concat(chunks);
                    const bodyPreview = bodyBuffer.toString("utf-8", 0, Math.min(bodyBuffer.length, maxPreviewSize));
                    const responseDiag = {
                        statusCode,
                        statusMessage: res.statusMessage,
                        headers: redactHeaders(res.headers),
                        bodyPreview,
                        timing: {
                            dnsLookupMs,
                            tcpConnectionMs,
                            tlsHandshakeMs,
                            ttfbMs,
                            contentDownloadMs,
                            totalDurationMs,
                        },
                        success: isExpected,
                        redirectCount: redirectsFollowed,
                        resolvedIp,
                    };
                    if (!isExpected) {
                        responseDiag.error = {
                            classification: "HTTP_ERROR",
                            message: `Unexpected HTTP status code: ${statusCode} (expected ${expectedStatusCodes.join(", ")})`,
                            details: { statusCode, statusMessage: res.statusMessage },
                        };
                    }
                    resolve(responseDiag);
                });
            });
            // Socket lifecycle listeners for detailed network breakdown
            req.on("socket", (socket) => {
                dnsStart = process.hrtime.bigint();
                socket.on("lookup", (err, address) => {
                    const dnsEnd = process.hrtime.bigint();
                    if (dnsStart) {
                        dnsLookupMs = calcMs(dnsStart, dnsEnd);
                    }
                    resolvedIp = address;
                    // Connection-time SSRF verification (DNS Rebinding Defense)
                    if (!err && address && !allowLocalTest && !isIpSafe(address)) {
                        socket.destroy(new Error(`SSRF Block: Resolved IP ${address} is prohibited`));
                    }
                    tcpStart = process.hrtime.bigint();
                });
                socket.on("connect", () => {
                    const tcpEnd = process.hrtime.bigint();
                    if (tcpStart) {
                        tcpConnectionMs = calcMs(tcpStart, tcpEnd);
                    }
                    tlsStart = process.hrtime.bigint();
                });
                socket.on("secureConnect", () => {
                    const tlsEnd = process.hrtime.bigint();
                    if (tlsStart) {
                        tlsHandshakeMs = calcMs(tlsStart, tlsEnd);
                    }
                });
            });
            req.on("timeout", () => {
                req.destroy(new Error("ETIMEDOUT"));
            });
            req.on("error", (err) => {
                if (isCompleted)
                    return;
                isCompleted = true;
                const endTime = process.hrtime.bigint();
                totalDurationMs = calcMs(startTime, endTime);
                let classification = "CLIENT_NETWORK_ERROR";
                const code = err.code || "";
                const msg = err.message || "";
                if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
                    classification = "DNS_FAILURE";
                }
                else if (code === "CERT_HAS_EXPIRED" ||
                    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
                    code === "ERR_TLS_CERT_ALTNAME_INVALID" ||
                    msg.includes("SSL") ||
                    msg.includes("certificate")) {
                    classification = "TLS_ERROR";
                }
                else if (code === "ECONNREFUSED") {
                    classification = "TCP_CONNECTION_REFUSED";
                }
                else if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT" || msg.includes("timeout")) {
                    classification = "TIMEOUT";
                }
                else if (msg.includes("SSRF Block")) {
                    classification = "SSRF_BLOCKED";
                }
                resolve({
                    statusCode: null,
                    headers: {},
                    timing: {
                        dnsLookupMs,
                        tcpConnectionMs,
                        tlsHandshakeMs,
                        ttfbMs,
                        contentDownloadMs,
                        totalDurationMs,
                    },
                    success: false,
                    redirectCount: redirectsFollowed,
                    resolvedIp,
                    error: {
                        classification,
                        message: msg,
                        code,
                        details: { stack: err.stack },
                    },
                });
            });
            if (body) {
                req.write(body);
            }
            req.end();
        });
        // Check if we should follow redirect
        if (result.statusCode &&
            [301, 302, 303, 307, 308].includes(result.statusCode) &&
            result.bodyPreview?.startsWith("REDIRECT to ")) {
            redirectsFollowed++;
            currentUrl = result.bodyPreview.replace("REDIRECT to ", "");
            continue;
        }
        return result;
    }
    return {
        statusCode: null,
        headers: {},
        timing: {
            dnsLookupMs: 0,
            tcpConnectionMs: 0,
            tlsHandshakeMs: 0,
            ttfbMs: 0,
            contentDownloadMs: 0,
            totalDurationMs: 0,
        },
        success: false,
        redirectCount: redirectsFollowed,
        error: {
            classification: "CLIENT_NETWORK_ERROR",
            message: `Exceeded maximum redirect depth of ${maxRedirects}`,
        },
    };
}
//# sourceMappingURL=http-client.js.map