import type {
  ProviderAdapter,
  ProviderBalance,
  ProviderOrderRequest,
  ProviderOrderResponse,
  ProviderOrderStatus,
  ProviderService,
  ProviderRefillResponse,
} from "./types";

type GenericProviderConfig = { baseUrl: string; apiKey: string; timeoutMs?: number; preserveTrailingSlash?: boolean };

export class ProviderRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderRejectedError";
  }
}

export class GenericPanelProvider implements ProviderAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(config: GenericProviderConfig) {
    const normalizedBaseUrl = config.baseUrl.trim();
    this.baseUrl = config.preserveTrailingSlash
      ? (normalizedBaseUrl.endsWith("/") ? normalizedBaseUrl : normalizedBaseUrl + "/")
      : normalizedBaseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey.trim();
    if (!this.baseUrl || !this.apiKey || this.baseUrl.length > 2048) throw new Error("Provider configuration is invalid.");
    validateProviderUrl(this.baseUrl);
    const timeoutMs = config.timeoutMs ?? 15000;
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000) {
      throw new Error("Provider timeout configuration is invalid.");
    }
    this.timeoutMs = timeoutMs;
  }

  private async request<T>(requestBody: Record<string, string | number>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response: Response = await fetch(this.baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          key: this.apiKey,
          ...Object.fromEntries(Object.entries(requestBody).map(([key, value]) => [key, String(value)])),
        }).toString(),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
      const body: string = await response.text();
      if (body.length > 2_000_000) throw new Error("Provider response exceeded the maximum allowed size.");
      try {
        const parsed: unknown = JSON.parse(body);
        if (parsed && typeof parsed === "object" && typeof (parsed as { error?: unknown }).error === "string") {
          const message = (parsed as { error: string }).error.trim().slice(0, 500);
          if (message) throw new ProviderRejectedError(message);
        }
        return parsed as T;
      } catch (error) {
        if (error instanceof ProviderRejectedError) throw error;
        throw new Error("Provider returned an invalid JSON response.");
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  async getServices(): Promise<ProviderService[]> {
    const result = await this.request<unknown>({ action: "services" });
    if (!Array.isArray(result)) return [];
    const services: ProviderService[] = [];
    for (const item of result.slice(0, 10_000)) {
      const service = item as Record<string, unknown>;
      const min = Number(service.min ?? 0);
      const max = Number(service.max ?? 0);
      const id = String(service.service ?? "").trim();
      const name = String(service.name ?? "").trim();
      const rate = toNumber(service.rate);
      if (
        !Number.isSafeInteger(min) ||
        !Number.isSafeInteger(max) ||
        !Number.isFinite(rate) ||
        !id ||
        !name ||
        id.length > 256 ||
        name.length > 512 ||
        min <= 0 ||
        max < min ||
        rate < 0
      ) {
        throw new Error("Provider returned a malformed service catalog row.");
      }
      services.push({
        id,
        name,
        category: service.category ? String(service.category).slice(0, 256) : undefined,
        type: service.type ? String(service.type).slice(0, 256) : undefined,
        rate,
        min,
        max,
        refill: toBoolean(service.refill),
        cancel: toBoolean(service.cancel),
      });
    }
    return services;
  }

  async getBalance(): Promise<ProviderBalance> {
    const result = await this.request<Record<string, unknown>>({ action: "balance" });
    const balance = Number(result.balance ?? 0);
    if (!Number.isFinite(balance) || balance < 0) throw new Error("Provider returned an invalid balance.");
    const currency = String(result.currency ?? "USD").trim().slice(0, 16) || "USD";
    return { balance, currency };
  }

  async createOrder(request: ProviderOrderRequest): Promise<ProviderOrderResponse> {
    const payload: Record<string, string | number> = {
      action: "add",
      service: request.serviceId,
      link: request.target,
    };
    if (request.quantity !== undefined && request.omitQuantity !== true) payload.quantity = request.quantity;
    for (const [key, value] of Object.entries(request.fields ?? {})) {
      if (value.trim()) payload[key] = value.trim();
    }
    const result = await this.request<Record<string, unknown>>(payload);
    const providerOrderId = String(result.order ?? "");
    if (!providerOrderId || providerOrderId.length > 256) throw new Error("Provider did not return a valid order ID");
    return { providerOrderId };
  }

  async getOrderStatus(providerOrderId: string): Promise<ProviderOrderStatus> {
    if (!providerOrderId.trim() || providerOrderId.length > 256) throw new Error("Provider order ID is invalid");
    const result = await this.request<Record<string, unknown>>({ action: "status", order: providerOrderId });
    return {
      status: normalizeStatus(result.status),
      startCount: toOptionalNumber(result.start_count),
      currentCount: toOptionalNumber(result.current_count),
      completedQuantity: toOptionalNumber(result.completed),
      remains: toOptionalNumber(result.remains),
    };
  }

  async cancelOrder(providerOrderId: string): Promise<unknown> {
    if (!providerOrderId.trim() || providerOrderId.length > 256) throw new Error("Provider order ID is invalid");
    return this.request({ action: "cancel", orders: providerOrderId });
  }

  async requestRefill(providerOrderId: string): Promise<ProviderRefillResponse> {
    if (!providerOrderId.trim() || providerOrderId.length > 256) throw new Error("Provider order ID is invalid");
    const result = await this.request<Record<string, unknown>>({ action: "refill", order: providerOrderId });
    const providerRefillId = String(result.refill ?? result.id ?? "");
    if (!providerRefillId || providerRefillId.length > 256) throw new Error("Provider did not return a valid refill ID");
    return { providerRefillId };
  }

  async getRefillStatus(refillId: string): Promise<unknown> {
    if (!refillId.trim() || refillId.length > 256) throw new Error("Provider refill ID is invalid");
    return this.request({ action: "refill_status", refill: refillId });
  }
}

function validateProviderUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Provider URL is invalid.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Provider URL must use HTTPS.");
  }

  if (url.username || url.password) {
    throw new Error("Provider URL must not contain embedded credentials.");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "localhost.localdomain" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname) ||
    /^10(?:\.\d{1,3}){3}$/.test(hostname) ||
    /^192\.168(?:\.\d{1,3}){2}$/.test(hostname) ||
    /^172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/.test(hostname) ||
    /^169\.254(?:\.\d{1,3}){2}$/.test(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Provider URL points to a private or local network address.");
  }
}

function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
  return false;
}

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function toOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : undefined;
}

function normalizeStatus(value: unknown): ProviderOrderStatus["status"] {
  const status = String(value ?? "").toLowerCase();
  if (status.includes("cancel")) return "cancelled";
  if (status.includes("partial")) return "partial";
  if (status.includes("complete")) return "completed";
  if (status.includes("process") || status.includes("progress")) return "processing";
  if (status.includes("fail") || status.includes("error")) return "failed";
  if (status.includes("pending") || status.includes("await")) return "pending";
  return "unknown";
}
