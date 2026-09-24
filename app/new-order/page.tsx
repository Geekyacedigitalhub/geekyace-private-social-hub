import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function NewOrderPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl p-5 sm:p-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-emerald-700">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>

        <header className="mt-6">
          <p className="text-sm font-medium text-emerald-600">Order workspace</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">New order</h1>
          <p className="mt-1 text-sm text-slate-500">Choose a configured service and submit a target and quantity.</p>
        </header>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-emerald-700" size={18} />
              <div>
                <p className="text-sm font-semibold text-emerald-900">Provider mapping required</p>
                <p className="mt-1 text-xs leading-5 text-emerald-900/70">
                  Services become selectable here after a provider connection and service mapping have been configured.
                </p>
              </div>
            </div>
          </div>

          <form className="mt-6 space-y-5">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Platform</span>
              <select disabled className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-400">
                <option>No platforms configured for ordering yet</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Service</span>
              <select disabled className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-400">
                <option>No mapped services available</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Target</span>
              <input disabled placeholder="Target URL, username, channel, or other provider-supported target" className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-400 outline-none" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Quantity</span>
              <input disabled type="number" placeholder="Quantity" className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-400 outline-none" />
            </label>
            <button disabled className="w-full rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-400">
              Provider mapping required
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
