import { Globe2, ArrowUpRight, Boxes, CheckCircle2, ToggleRight, Search } from "lucide-react";
import { db } from "@/lib/db";
import { platforms } from "@/lib/db/schema";
import { asc, or, ilike } from "drizzle-orm";

export const dynamic = "force-dynamic";

type PlatformsPageProps = {
  searchParams?: Promise<{ q?: string | string[] }>;
};

export default async function PlatformsPage({ searchParams }: PlatformsPageProps) {
  const params = await searchParams;
  const rawQuery = params?.q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery ?? "").trim();

  const rows = await db
    .select()
    .from(platforms)
    .where(query ? or(ilike(platforms.name, "%" + query + "%"), ilike(platforms.slug, "%" + query + "%")) : undefined)
    .orderBy(asc(platforms.name));

  return (
    <main className="min-h-screen bg-[#06100c]">
      <div className="mx-auto max-w-7xl p-5 sm:p-8 xl:p-10">
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-emerald-400"><Globe2 size={13}/> Catalog</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Platforms</h1>
            <p className="mt-2 text-sm text-slate-500">Your provider-backed platform catalog and availability state.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-slate-400">
            <Boxes size={14} className="text-emerald-300"/> {rows.length}{query ? " matching " : " "}platform{rows.length===1?"":"s"}
          </div>
        </header>

        <form method="get" className="mt-8 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-[#0d1b15] px-4">
          <Search size={16} className="text-slate-600"/>
          <input name="q" defaultValue={query} placeholder="Search platforms..." aria-label="Search platforms" className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-600"/>
          {query ? <a href="/platforms" className="shrink-0 text-xs font-semibold text-slate-500 hover:text-emerald-300">Clear</a> : null}
        </form>

        <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.length ? rows.map((platform) => (
            <article key={platform.id} className="gx-card gx-card-hover group relative overflow-hidden rounded-2xl p-5">
              <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-emerald-400/[0.05] blur-2xl"/>
              <div className="relative flex items-start justify-between gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-emerald-300"><Globe2 size={19}/></div>
                <span className={"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold "+(platform.enabled?"border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-300":"border-white/[0.07] bg-white/[0.03] text-slate-500")}>
                  <span className={"h-1.5 w-1.5 rounded-full "+(platform.enabled?"bg-emerald-400 gx-pulse":"bg-slate-600")}/>{platform.enabled?"Enabled":"Disabled"}
                </span>
              </div>
              <h2 className="relative mt-6 text-base font-semibold text-white">{platform.name}</h2>
              <p className="relative mt-1 text-[11px] font-mono text-slate-600">{platform.slug}</p>
              <div className="relative mt-6 flex items-center justify-between border-t border-white/[0.05] pt-4">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-600"><ToggleRight size={14}/> Catalog state</span>
                <ArrowUpRight size={14} className="text-slate-700 transition group-hover:text-emerald-400"/>
              </div>
            </article>
          )) : (
            <div className="col-span-full gx-card rounded-2xl p-14 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400/[0.07] text-emerald-300"><CheckCircle2 size={22}/></div>
              <h2 className="mt-4 font-semibold text-white">No platforms{query ? " match your search" : " imported yet"}</h2>
              <p className="mt-2 text-sm text-slate-600">{query ? "Try a different platform name or slug." : "Sync the provider catalog from Providers to populate this workspace."}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
