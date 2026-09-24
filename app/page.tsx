import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  Layers3,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
} from "lucide-react";

const stats = [
  { label: "Orders", value: "0", icon: ShoppingCart },
  { label: "Active", value: "0", icon: Activity },
  { label: "Completed", value: "0", icon: CheckCircle2 },
  { label: "Providers", value: "0", icon: Layers3 },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-64 border-r border-emerald-100 bg-white p-5 lg:block">
          <div className="mb-8">
            <div className="text-lg font-bold text-emerald-700">GeekyAce</div>
            <div className="text-xs text-slate-500">Private Social Hub</div>
          </div>

          <nav className="space-y-1 text-sm">
            {[
              "Dashboard",
              "New Order",
              "Orders",
              "Services",
              "Platforms",
              "Providers",
              "Refills",
              "Analytics",
              "Logs",
              "Settings",
            ].map((item, index) => (
              <div
                key={item}
                className={`rounded-lg px-3 py-2.5 ${index === 0 ? "bg-emerald-50 font-semibold text-emerald-700" : "text-slate-600"}`}
              >
                {item}
              </div>
            ))}
          </nav>

          <div className="mt-8 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <ShieldCheck size={16} />
              Private mode
            </div>
            <p className="mt-2 text-xs leading-5 text-emerald-900/70">
              Single-user panel. Provider secrets stay server-side.
            </p>
          </div>
        </aside>

        <section className="flex-1">
          <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-600">Control center</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  Private Social Hub
                </h1>
              </div>
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
                <ShoppingCart size={16} />
                New order
              </button>
            </div>
          </header>

          <div className="space-y-6 p-5 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">{label}</span>
                    <Icon size={18} className="text-emerald-600" />
                  </div>
                  <div className="mt-3 text-3xl font-bold text-slate-900">{value}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
              <section className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">System status</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Foundation is ready for the provider and order layers.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 size={14} />
                    Ready
                  </span>
                </div>

                <div className="mt-6 grid gap-3">
                  {[
                    ["Application shell", "Ready"],
                    ["Private access model", "Planned"],
                    ["Provider adapter layer", "Next milestone"],
                    ["Order database", "Next milestone"],
                  ].map(([label, status]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <span className="text-sm text-slate-700">{label}</span>
                      <span className="text-xs font-semibold text-slate-500">{status}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-emerald-100 bg-emerald-700 p-6 text-white">
                <Sparkles size={20} />
                <h2 className="mt-4 text-lg font-bold">Next milestone</h2>
                <p className="mt-2 text-sm leading-6 text-emerald-50">
                  Add the provider catalog, service mapping, order records, and secure server-side API routing.
                </p>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">
                  Provider architecture
                  <ArrowUpRight size={16} />
                </div>
              </section>
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2">
                <CircleDollarSign size={18} className="text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-900">Cost approach</h2>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                The application is being designed around free-tier hosting and database resources.
                Any third-party fulfillment provider may charge separately for its own services.
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
