import { desc, eq } from "drizzle-orm";
import { Layers3, Search, ShoppingCart, Filter } from "lucide-react";
import { db } from "@/lib/db";
import { platforms, services } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const rows = await db
    .select({
      id: services.id,
      platform: platforms.name,
      name: services.name,
      min: services.minQuantity,
      max: services.maxQuantity,
      enabled: services.enabled,
    })
    .from(services)
    .innerJoin(platforms, eq(services.platformId, platforms.id))
    .orderBy(desc(services.createdAt));

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-5 sm:p-8">
        <header>
          <p className="text-sm font-medium text-emerald-600">Catalog</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Services</h1>
          <p className="mt-1 text-sm text-slate-500">Provider services mapped into the private ordering catalog.</p>
        </header>

        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]"><div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"><Search size={17} className="text-slate-400" /><input aria-label="Search services" placeholder="Search services..." className="w-full bg-transparent text-sm outline-none" /></div><div className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600"><Filter size={16}/> {rows.length} services</div></div>

        <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="grid grid-cols-[1.1fr_1.7fr_0.8fr_0.8fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Platform</span><span>Service</span><span>Range</span><span>Action</span>
          </div>
          {rows.length ? rows.map((service) => (
            <div key={service.id} className="grid grid-cols-[1.1fr_1.7fr_0.8fr_0.8fr] gap-4 border-b border-slate-100 px-5 py-4 text-sm last:border-0">
              <span className="font-medium text-slate-800">{service.platform}</span>
              <span className="text-slate-700">{service.name}</span>
              <span className="text-slate-600">{service.min.toLocaleString()} – {service.max.toLocaleString()}</span>
              <span><a href={"/new-order?serviceId="+encodeURIComponent(service.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"><ShoppingCart size={13}/> Order</a></span>
            </div>
          )) : (
            <div className="p-10 text-center">
              <Layers3 className="mx-auto text-emerald-600" size={26} />
              <h2 className="mt-3 font-semibold text-slate-900">No services imported yet</h2>
              <p className="mt-2 text-sm text-slate-500">Sync the provider catalog from the Providers page first.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
