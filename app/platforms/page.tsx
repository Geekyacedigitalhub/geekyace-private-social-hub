import { Globe2, Plus, ToggleRight } from "lucide-react";

const platforms = [
  ["Instagram", "instagram", "Enabled"],
  ["TikTok", "tiktok", "Enabled"],
  ["YouTube", "youtube", "Enabled"],
  ["Facebook", "facebook", "Enabled"],
  ["X", "x", "Enabled"],
  ["LinkedIn", "linkedin", "Enabled"],
  ["Threads", "threads", "Enabled"],
  ["Discord", "discord", "Enabled"],
  ["Telegram", "telegram", "Enabled"],
  ["Reddit", "reddit", "Enabled"],
  ["Twitch", "twitch", "Enabled"],
  ["Pinterest", "pinterest", "Enabled"],
  ["Spotify", "spotify", "Enabled"],
  ["Snapchat", "snapchat", "Enabled"],
];

export default function PlatformsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-5 sm:p-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-600">Catalog</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Platforms</h1>
            <p className="mt-1 text-sm text-slate-500">Manage the platforms available to the private order panel.</p>
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">
            <Plus size={16} /> Add platform
          </button>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {platforms.map(([name, slug, status]) => (
            <article key={slug} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Globe2 size={19} />
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <ToggleRight size={15} /> {status}
                </span>
              </div>
              <h2 className="mt-4 font-semibold text-slate-900">{name}</h2>
              <p className="mt-1 text-xs text-slate-500">{slug}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
