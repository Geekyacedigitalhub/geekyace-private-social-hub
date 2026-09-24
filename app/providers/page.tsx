import { Activity, KeyRound, Plus, ServerCog } from "lucide-react";
import { ProviderTest } from "./provider-test";
import { CatalogSync } from "./catalog-sync";

const providers = [
  { name: "No provider configured", url: "Add a provider API endpoint and server-side credential.", status: "Not configured" },
];

export default function ProvidersPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-5 sm:p-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-600">Infrastructure</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Providers</h1>
            <p className="mt-1 text-sm text-slate-500">Configure upstream provider connections without exposing credentials to the browser.</p>
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">
            <Plus size={16} /> Add provider
          </button>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5"><ServerCog className="text-emerald-600" size={20}/><p className="mt-3 text-sm text-slate-500">Configured providers</p><p className="mt-1 text-2xl font-bold">0</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-5"><Activity className="text-emerald-600" size={20}/><p className="mt-3 text-sm text-slate-500">Healthy connections</p><p className="mt-1 text-2xl font-bold">0</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-5"><KeyRound className="text-emerald-600" size={20}/><p className="mt-3 text-sm text-slate-500">Credentials</p><p className="mt-1 text-sm font-semibold text-emerald-700">Server-side only</p></div>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white">
          {providers.map((provider) => (
            <div key={provider.name} className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">{provider.name}</h2>
                <p className="mt-1 text-sm text-slate-500">{provider.url}</p>
              </div>
              <div><span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{provider.status}</span><ProviderTest /><CatalogSync /></div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
