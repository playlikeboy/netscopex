import { HttpMethod, ProbeTimingBreakdown, RootCauseClassification } from "@netscopex/contracts";
export interface HttpRequestOptions {
    url: string;
    method?: HttpMethod;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
    expectedStatusCodes?: number[];
    maxRedirects?: number;
    allowLocalTest?: boolean;
}
export interface HttpResponseDiagnostic {
    statusCode: number | null;
    statusMessage?: string;
    headers: Record<string, string>;
    bodyPreview?: string;
    timing: ProbeTimingBreakdown;
    success: boolean;
    redirectCount: number;
    resolvedIp?: string;
    error?: {
        classification: RootCauseClassification;
        message: string;
        code?: string;
        details?: Record<string, unknown>;
    };
}
export declare function executeProbeRequest(options: HttpRequestOptions): Promise<HttpResponseDiagnostic>;
//# sourceMappingURL=http-client.d.ts.map