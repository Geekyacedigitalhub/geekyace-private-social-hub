import { GenericPanelProvider } from "./generic";
import type { ProviderAdapter } from "./types";

export type ProviderConfig = {
  name: string;
  baseUrl: string;
  apiKey: string;
};

export function createProviderAdapter(config: ProviderConfig): ProviderAdapter {
  if (!config.baseUrl || !config.apiKey) {
    throw new Error(`Provider "${config.name}" is missing its server-side configuration.`);
  }

  return new GenericPanelProvider({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
  });
}
