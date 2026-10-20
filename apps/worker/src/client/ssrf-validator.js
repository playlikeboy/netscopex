import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";
const BLOCKED_HOSTNAMES = new Set([
    "localhost",
    "metadata.google.internal",
    "metadata.internal",
    "instance-data",
    "169.254.169.254",
]);
/**
 * Validates an IP string to ensure it is a public, globally routable address.
 * Rejects loopback, private RFC1918, link-local, carrier-grade NAT,
 * cloud metadata, multicast, and IPv4-mapped IPv6 variants.
 */
export function isIpSafe(ipStr) {
    try {
        let addr = ipaddr.parse(ipStr);
        // If IPv4-mapped IPv6 (::ffff:10.0.0.1), extract the IPv4 address
        if (addr.kind() === "ipv6" && addr.isIPv4MappedAddress()) {
            addr = addr.toIPv4Address();
        }
        const range = addr.range();
        // Block dangerous ranges
        const prohibitedRanges = [
            "loopback",
            "private",
            "linkLocal",
            "carrierGradeNat",
            "broadcast",
            "multicast",
            "unspecified",
            "reserved",
        ];
        if (prohibitedRanges.includes(range)) {
            return false;
        }
        // Explicit check for AWS/GCP/Azure link-local metadata IP
        if (addr.toString() === "169.254.169.254") {
            return false;
        }
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Validates a target URL against SSRF attacks before initiating a connection.
 * Resolves DNS and validates the underlying IP address.
 */
export async function validateTargetUrl(urlStr, allowLocalTest = false) {
    let parsed;
    try {
        parsed = new URL(urlStr);
    }
    catch {
        return { valid: false, errorReason: "Malformed URL" };
    }
    // 1. Strict Protocol Enforcement
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return {
            valid: false,
            errorReason: `Prohibited protocol: ${parsed.protocol}. Only HTTP and HTTPS are permitted.`,
        };
    }
    const hostname = parsed.hostname.toLowerCase();
    // Local test bypass for controlled fault injection testing
    if (allowLocalTest && (hostname === "127.0.0.1" || hostname === "localhost")) {
        return { valid: true, resolvedIp: "127.0.0.1" };
    }
    // 2. Reject blocked hostnames
    if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
        return {
            valid: false,
            errorReason: `Destination hostname is prohibited: ${hostname}`,
        };
    }
    // 3. Resolve DNS records
    try {
        // Resolve both IPv4 and IPv6
        const [ipv4Addresses, ipv6Addresses] = await Promise.all([
            dns.resolve4(hostname).catch(() => []),
            dns.resolve6(hostname).catch(() => []),
        ]);
        const allIps = [...ipv4Addresses, ...ipv6Addresses];
        if (allIps.length === 0) {
            // If direct IP was passed as hostname, test it directly
            if (ipaddr.isValid(hostname)) {
                allIps.push(hostname);
            }
            else {
                return { valid: false, errorReason: `DNS resolution failed for hostname: ${hostname}` };
            }
        }
        // Verify all resolved IPs are safe
        for (const ip of allIps) {
            if (!isIpSafe(ip)) {
                return {
                    valid: false,
                    resolvedIp: ip,
                    errorReason: `Target resolves to prohibited IP address: ${ip}`,
                };
            }
        }
        return { valid: true, resolvedIp: allIps[0] };
    }
    catch (err) {
        return {
            valid: false,
            errorReason: `DNS lookup failed: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}
//# sourceMappingURL=ssrf-validator.js.map