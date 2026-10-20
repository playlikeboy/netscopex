import { describe, it, expect } from "vitest";
import {
  isIpSafe,
  validateTargetUrl,
} from "../../apps/worker/src/client/ssrf-validator.js";

describe("SSRF Validator & Target Protection", () => {
  it("rejects loopback IPv4 addresses", () => {
    expect(isIpSafe("127.0.0.1")).toBe(false);
    expect(isIpSafe("127.0.0.254")).toBe(false);
    expect(isIpSafe("127.255.255.255")).toBe(false);
  });

  it("rejects loopback IPv6 addresses", () => {
    expect(isIpSafe("::1")).toBe(false);
    expect(isIpSafe("0:0:0:0:0:0:0:1")).toBe(false);
  });

  it("rejects private RFC1918 IPv4 ranges", () => {
    expect(isIpSafe("10.0.0.1")).toBe(false);
    expect(isIpSafe("10.254.1.5")).toBe(false);
    expect(isIpSafe("172.16.0.1")).toBe(false);
    expect(isIpSafe("172.31.255.255")).toBe(false);
    expect(isIpSafe("192.168.1.1")).toBe(false);
    expect(isIpSafe("192.168.100.200")).toBe(false);
  });

  it("rejects link-local and cloud metadata addresses", () => {
    expect(isIpSafe("169.254.169.254")).toBe(false);
    expect(isIpSafe("169.254.1.1")).toBe(false);
    expect(isIpSafe("fe80::1")).toBe(false);
  });

  it("rejects IPv4-mapped IPv6 loopback and private variants", () => {
    expect(isIpSafe("::ffff:127.0.0.1")).toBe(false);
    expect(isIpSafe("::ffff:10.0.0.1")).toBe(false);
    expect(isIpSafe("::ffff:192.168.1.1")).toBe(false);
    expect(isIpSafe("::ffff:169.254.169.254")).toBe(false);
  });

  it("permits public, globally routable IP addresses", () => {
    expect(isIpSafe("8.8.8.8")).toBe(true);
    expect(isIpSafe("1.1.1.1")).toBe(true);
    expect(isIpSafe("93.184.216.34")).toBe(true);
    expect(isIpSafe("2606:4700:4700::1111")).toBe(true);
  });

  it("rejects prohibited non-HTTP/HTTPS protocols", async () => {
    const fileResult = await validateTargetUrl("file:///etc/passwd");
    expect(fileResult.valid).toBe(false);
    expect(fileResult.errorReason).toContain("Prohibited protocol");

    const ftpResult = await validateTargetUrl("ftp://ftp.example.com/file");
    expect(ftpResult.valid).toBe(false);

    const gopherResult = await validateTargetUrl("gopher://example.com");
    expect(gopherResult.valid).toBe(false);
  });

  it("rejects internal cloud metadata hostnames", async () => {
    const res = await validateTargetUrl("http://metadata.google.internal/computeMetadata/v1/");
    expect(res.valid).toBe(false);
    expect(res.errorReason).toContain("prohibited");
  });

  it("allows controlled local endpoints only when explicit test bypass is active", async () => {
    const blockedWithoutBypass = await validateTargetUrl("http://127.0.0.1:4000/fault/status", false);
    expect(blockedWithoutBypass.valid).toBe(false);

    const allowedWithBypass = await validateTargetUrl("http://127.0.0.1:4000/fault/status", true);
    expect(allowedWithBypass.valid).toBe(true);
    expect(allowedWithBypass.resolvedIp).toBe("127.0.0.1");
  });
});
