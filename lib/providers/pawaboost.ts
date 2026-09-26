import type {
  ProviderAdapter,
  ProviderBalance,
  ProviderOrderRequest,
  ProviderOrderResponse,
  ProviderOrderStatus,
  ProviderService,
} from "./types";

type Config = { baseUrl: string; apiKey: string; timeoutMs?: number };

export class PawaBoostProvider implements ProviderAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(config: Config) {
    this.baseUrl = config.baseUrl.trim().replace(/\/$/, "");
    this.apiKey = config.apiKey.trim();
    this.timeoutMs = config.timeoutMs ?? 15000;
    if (!this.baseUrl || !this.apiKey) throw new Error("PawaBoost configuration is invalid.");
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.baseUrl + path, {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: "Bearer " + this.apiKey,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
        cache: "no-store",
      });
      const text = await response.text();
      if (text.length > 2_000_000) throw new Error("PawaBoost response exceeded the maximum allowed size.");
      let body: unknown = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        throw new Error("PawaBoost returned invalid JSON.");
      }
      if (!response.ok) {
        const message =
          body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string"
            ? String((body as { message: string }).message)
            : "PawaBoost returned HTTP " + response.status;
        throw new Error(message);
      }
      return body as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getServices(): Promise<ProviderService[]> {
    const result = await this.request<{ success?: boolean; services?: Array<Record<string, unknown>> }>("/services");
    const rows = Array.isArray(result.services) ? result.services : [];
    return rows.slice(0, 10000).map((service) => {
      const min = Number(service.minQuantity ?? 0);
      const max = Number(service.maxQuantity ?? 0);
      const rate = Number(service.pricePerUnit ?? 0);
      const id = String(service.id ?? "").trim();
      const name = String(service.name ?? "").trim();
      if (!id || !name || !Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min <= 0 || max < min || !Number.isFinite(rate) || rate < 0) {
        throw new Error("PawaBoost returned a malformed service catalog row.");
      }
      return {
        id,
        name,
        category: service.category ? String(service.category) : undefined,
        type: service.serviceType ? String(service.serviceType) : undefined,
        rate,
        min,
        max,
        refill: false,
        cancel: false,
        raw: service,
      };
    });
  }

  async getBalance(): Promise<ProviderBalance> {
    const result = await this.request<{ balance?: unknown; currency?: unknown }>("/balance");
    const balance = Number(result.balance ?? 0);
    if (!Number.isFinite(balance) || balance < 0) throw new Error("PawaBoost returned an invalid balance.");
    return { balance, currency: String(result.currency ?? "NGN"), raw: result };
  }

  async createOrder(request: ProviderOrderRequest): Promise<ProviderOrderResponse> {
    if (request.quantity === undefined || request.omitQuantity) {
      throw new Error("PawaBoost requires a quantity.");
    }
    const result = await this.request<{
      success?: boolean;
      order?: { id?: unknown };
    }>("/order", {
      method: "POST",
      body: JSON.stringify({
        serviceId: request.serviceId,
        link: request.target,
        quantity: request.quantity,
      }),
    });
    const providerOrderId = String(result.order?.id ?? "").trim();
    if (!providerOrderId) throw new Error("PawaBoost did not return a valid order ID.");
    return { providerOrderId, raw: result };
  }

  async getOrderStatus(providerOrderId: string): Promise<ProviderOrderStatus> {
    const result = await this.request<{
      order?: Record<string, unknown>;
    }>("/order/" + encodeURIComponent(providerOrderId));
    const order = result.order ?? {};
    return {
      status: normalizeStatus(order.status),
      startCount: toOptionalNumber(order.startCount),
      currentCount: toOptionalNumber(order.quantity && order.remains != null ? Number(order.quantity) - Number(order.remains) : undefined),
      completedQuantity: order.remains != null && order.quantity != null ? Math.max(0, Number(order.quantity) - Number(order.remains)) : undefined,
      remains: toOptionalNumber(order.remains),
      raw: result,
    };
  }
}

function toOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
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
