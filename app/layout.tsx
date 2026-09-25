import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { LayoutDashboard, ShoppingCart, Package, Boxes, ServerCog, RefreshCw, BarChart3, ScrollText, Settings, ShieldCheck, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "GeekyAce Social Hub",
  description: "Private provider-backed social service control center.",
};

const groups = [
  { label: "Workspace", items: [["Dashboard", "/", LayoutDashboard], ["New Order", "/new-order", ShoppingCart], ["Orders", "/orders", Package]] },
  { label: "Operations", items: [["Services", "/services", Boxes], ["Providers", "/providers", ServerCog], ["Refills", "/refills", RefreshCw], ["Analytics", "/analytics", BarChart3]] },
  { label: "System", items: [["Logs", "/logs", ScrollText], ["Settings", "/settings", Settings]] },
] as const;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-[#06100c] text-slate-100 lg:flex">
          <aside className="hidden w-[274px] shrink-0 border-r border-white/[0.07] bg-[#08130f] lg:block">
            <div className="sticky top-0 flex h-screen flex-col p-5">
              <Link href="/" className="group mb-7 flex items-center gap-3 px-2">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-emerald-300 via-emerald-500 to-teal-700 text-lg font-black text-[#06100c] shadow-[0_0_32px_rgba(52,211,153,.2)] transition group-hover:scale-105">G</span>
                <span><span className="block text-[11px] font-bold uppercase tracking-[.24em] text-emerald-400">GeekyAce</span><span className="mt-0.5 block text-lg font-semibold tracking-tight text-white">Social Hub</span></span>
              </Link>

              <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.06] px-3 py-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.9)]" />
                <span className="text-[11px] font-semibold uppercase tracking-[.18em] text-emerald-300">Private workspace</span>
              </div>

              <nav className="space-y-6">
                {groups.map((group) => (
                  <div key={group.label}>
                    <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.22em] text-slate-600">{group.label}</p>
                    <div className="space-y-1">
                      {group.items.map(([label, href, Icon]) => (
                        <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-400 transition-all hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-white">
                          <Icon size={17} strokeWidth={1.8} className="text-slate-600 transition group-hover:text-emerald-400" />
                          <span>{label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>

              <div className="mt-auto overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.055] to-emerald-400/[0.035] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-white"><ShieldCheck size={15} className="text-emerald-400" /> Owner-only access</div>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">Provider credentials stay server-side. This workspace is not a public storefront.</p>
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#06100c]/90 px-4 py-3 backdrop-blur-xl lg:hidden">
              <div className="flex items-center justify-between gap-3">
                <Link href="/" className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-300 to-emerald-600 text-sm font-black text-[#06100c]">G</span><span className="font-semibold text-white">Social Hub</span></Link>
                <Link href="/new-order" className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-bold text-[#06100c] shadow-lg shadow-emerald-500/10"><Zap size={13} /> New order</Link>
              </div>
              <nav className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
                {groups.flatMap((group) => group.items).map(([label, href]) => <Link key={href} href={href} className="whitespace-nowrap rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-slate-400">{label}</Link>)}
              </nav>
            </header>
            <div className="relative min-h-screen overflow-hidden">
              <div className="pointer-events-none fixed inset-0 -z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(16,185,129,.09),transparent_30%),radial-gradient(circle_at_25%_70%,rgba(20,184,166,.045),transparent_28%)]" />
              <div className="relative z-10">{children}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
