export type ProviderService = {
  id: string; name: string; category?: string; type?: string; rate?: number;
  min: number; max: number; refill?: boolean; cancel?: boolean; raw?: unknown;
};
export type ProviderOrderRequest = {
  serviceId: string;
  target: string;
  quantity?: number;
  fields?: Record<string, string>;
  omitQuantity?: boolean;
};
export type ProviderOrderResponse = { providerOrderId: string; raw?: unknown };
export type ProviderOrderStatus = {
  status: "pending" | "processing" | "completed" | "partial" | "failed" | "cancelled" | "unknown";
  startCount?: number; currentCount?: number; completedQuantity?: number; remains?: number; raw?: unknown;
};
export type ProviderBalance = { balance: number; currency: string; raw?: unknown };
export type ProviderRefillResponse = { providerRefillId: string; raw?: unknown };
export interface ProviderAdapter {
  getServices(): Promise<ProviderService[]>;
  getBalance(): Promise<ProviderBalance>;
  createOrder(request: ProviderOrderRequest): Promise<ProviderOrderResponse>;
  getOrderStatus(providerOrderId: string): Promise<ProviderOrderStatus>;
  cancelOrder?(providerOrderId: string): Promise<unknown>;
  requestRefill?(providerOrderId: string): Promise<ProviderRefillResponse>;
  getRefillStatus?(refillId: string): Promise<unknown>;
}