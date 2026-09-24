import { Layers3, Search } from "lucide-react";

const services = [
  ["Instagram", "Followers", "Provider mapping required"],
  ["Instagram", "Likes", "Provider mapping required"],
  ["TikTok", "Followers", "Provider mapping required"],
  ["TikTok", "Views", "Provider mapping required"],
  ["YouTube", "Subscribers", "Provider mapping required"],
  ["YouTube", "Views", "Provider mapping required"],
  ["Facebook", "Page Followers", "Provider mapping required"],
  ["X", "Followers", "Provider mapping required"],
  ["LinkedIn", "Followers", "Provider mapping required"],
  ["Telegram", "Channel Members", "Provider mapping required"],
];

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-5 sm:p-8">
        <header>
          <p className="text-sm font-medium text-emerald-600">Catalog</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Services</h1>
          <p className="mt-1 text-sm text-slate-500">Define the private services and connect each one to an approved provider mapping.</p>
        </header>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
            <Search size={17} className="text-slate-400" />
            <input aria-label="Search services" placeholder="Search services..." className="w-full bg-transparent text-sm outline-none" />
          </div>
        </div>

        <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="grid grid-cols-[1.2fr_1fr_1.4fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Platform</span><span>Service</span><span>Mapping</span>
          </div>
          {services.map(([platform, service, mapping]) => (
            <div key={platform + service} className="grid grid-cols-[1.2fr_1fr_1.4fr] gap-4 border-b border-slate-100 px-5 py-4 text-sm last:border-0">
              <span className="font-medium text-slate-800">{platform}</span>
              <span className="text-slate-700">{service}</span>
              <span className="text-xs font-medium text-amber-700">{mapping}</span>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
