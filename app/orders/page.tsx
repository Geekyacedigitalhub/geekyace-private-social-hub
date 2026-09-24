import Link from "next/link";
import { ArrowLeft, ShoppingCart } from "lucide-react";

export default function OrdersPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-5 sm:p-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-emerald-700">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <header className="mt-6">
          <p className="text-sm font-medium text-emerald-600">Order history</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Orders</h1>
          <p className="mt-1 text-sm text-slate-500">Track provider order IDs, status changes, quantities, and refill records.</p>
        </header>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-10 text-center">
          <ShoppingCart className="mx-auto text-emerald-600" size={28} />
          <h2 className="mt-4 font-semibold text-slate-900">No orders yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Orders will appear here after a mapped service is configured and an order is submitted.
          </p>
          <Link href="/new-order" className="mt-5 inline-flex rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">
            Configure a new order
          </Link>
        </section>
      </div>
    </main>
  );
}
