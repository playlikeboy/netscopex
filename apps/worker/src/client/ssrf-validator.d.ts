export interface SsrfValidationResult {
    valid: boolean;
    resolvedIp?: string;
    errorReason?: string;
}
/**
 * Validates an IP string to ensure it is a public, globally routable address.
 * Rejects loopback, private RFC1918, link-local, carrier-grade NAT,
 * cloud metadata, multicast, and IPv4-mapped IPv6 variants.
 */
export declare function isIpSafe(ipStr: string): boolean;
/**
 * Validates a target URL against SSRF attacks before initiating a connection.
 * Resolves DNS and validates the underlying IP address.
 */
export declare function validateTargetUrl(urlStr: string, allowLocalTest?: boolean): Promise<SsrfValidationResult>;
//# sourceMappingURL=ssrf-validator.d.ts.map