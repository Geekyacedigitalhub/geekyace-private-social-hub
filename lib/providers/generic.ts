import type {
  ProviderAdapter,
  ProviderBalance,
  ProviderOrderRequest,
  ProviderOrderResponse,
  ProviderOrderStatus,
  ProviderService,
  ProviderRefillResponse,
} from "./types";

type GenericProviderConfig = { baseUrl: string; apiKey: string; timeoutMs?: number };

export class GenericPanelProvider implements ProviderAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(config: GenericProviderConfig) {
    this.baseUrl = config.baseUrl.trim().replace(/\/$/, "");
    this.apiKey = config.apiKey.trim();
    if (!this.baseUrl || !this.apiKey || this.baseUrl.length > 2048) throw new Error("Provider configuration is invalid.");
    this.timeoutMs = config.timeoutMs ?? 15000;
  }

  private async request<T>(body: Record<string, string | number>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          key: this.apiKey,
          ...Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value)])),
        }).toString(),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getServices(): Promise<ProviderService[]> {
    const result = await this.request<unknown>({ action: "services" });
    if (!Array.isArray(result)) return [];
    const services: ProviderService[] = [];
    for (const item of result) {
      const service = item as Record<string, unknown>;
      const min = Number(service.min ?? 0);
      const max = Number(service.max ?? 0);
      const id = String(service.service ?? "").trim();
      const name = String(service.name ?? "").trim();
      if (!Number.isFinite(min) || !Number.isFinite(max) || !id || !name || min <= 0 || max < min) {
        continue;
      }
      services.push({
        id,
        name,
        category: service.category ? String(service.category) : undefined,
        type: service.type ? String(service.type) : undefined,
        rate: toNumber(service.rate),
        min,
        max,
        refill: Boolean(service.refill),
        cancel: Boolean(service.cancel),
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
    const result = await this.request<Record<string, unknown>>({
      action: "add", service: request.serviceId, link: request.target, quantity: request.quantity,
    });
    const providerOrderId = String(result.order ?? "");
    if (!providerOrderId || providerOrderId.length > 256) throw new Error("Provider did not return a valid order ID");
    return { providerOrderId };
  }

  async getOrderStatus(providerOrderId: string): Promise<ProviderOrderStatus> {
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
    return this.request({ action: "cancel", orders: providerOrderId });
  }

  async requestRefill(providerOrderId: string): Promise<ProviderRefillResponse> {
    const result = await this.request<Record<string, unknown>>({ action: "refill", order: providerOrderId });
    const providerRefillId = String(result.refill ?? result.id ?? "");
    if (!providerRefillId || providerRefillId.length > 256) throw new Error("Provider did not return a valid refill ID");
    return { providerRefillId };
  }

  async getRefillStatus(refillId: string): Promise<unknown> {
    return this.request({ action: "refill_status", refill: refillId });
  }
}

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function toOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
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
