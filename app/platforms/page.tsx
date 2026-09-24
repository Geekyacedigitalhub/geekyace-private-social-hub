import { Globe2, Plus, ToggleRight } from "lucide-react";
import { db } from "@/lib/db";
import { platforms } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function PlatformsPage() {
  const rows = await db.select().from(platforms).orderBy(platforms.name);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-5 sm:p-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-600">Catalog</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Platforms</h1>
            <p className="mt-1 text-sm text-slate-500">Platforms imported from the configured provider catalog.</p>
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">
            <Plus size={16} /> Add platform
          </button>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.length ? rows.map((platform) => (
            <article key={platform.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Globe2 size={19} />
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <ToggleRight size={15} /> {platform.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <h2 className="mt-4 font-semibold text-slate-900">{platform.name}</h2>
              <p className="mt-1 text-xs text-slate-500">{platform.slug}</p>
            </article>
          )) : (
            <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <h2 className="font-semibold text-slate-900">No platforms imported yet</h2>
              <p className="mt-2 text-sm text-slate-500">Sync the provider catalog from the Providers page to populate this list.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
