import { GenericPanelProvider } from "./generic";
import type { ProviderAdapter } from "./types";

export type ProviderConfig = {
  name: string;
  baseUrl: string;
  apiKey?: string;
};

const PROVIDER_KEY_ENV: Record<string, string> = {
  "TaskletPay": "PROVIDER_API_KEY_TASKLETPAY",
  "Shoprime": "PROVIDER_API_KEY_SHOPRIME",
  "ClassySMM": "PROVIDER_API_KEY_CLASSYSMM",
  "PawaBoost": "PROVIDER_API_KEY_PAWABOOST",
  "Caryvn": "PROVIDER_API_KEY_CARYVN",
};

export function getProviderApiKey(name: string): string {
  const envName = PROVIDER_KEY_ENV[name.trim()];
  const key = (envName ? process.env[envName] : undefined) ?? process.env.PROVIDER_API_KEY ?? "";
  return key.trim();
}

export function createProviderAdapter(config: ProviderConfig): ProviderAdapter {
  const apiKey = (config.apiKey ?? getProviderApiKey(config.name)).trim();
  if (!config.baseUrl || !apiKey) {
    throw new Error(`Provider "${config.name}" is missing its server-side configuration.`);
  }

  return new GenericPanelProvider({
    baseUrl: config.baseUrl,
    apiKey,
  });
}
