import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import "./globals.css";
import { LayoutDashboard, ShoppingCart, Package, Boxes, ServerCog, RefreshCw, BarChart3, ScrollText, Settings, ShieldCheck, Zap, WalletCards, ReceiptText, KeyRound } from "lucide-react";

export const metadata: Metadata = {
  title: "GeekyAce Social Hub",
  description: "Private provider-backed social service control center.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-icon.svg",
  },
};

type NavItem = readonly [string, string, LucideIcon];
type NavGroup = { label: string; items: readonly NavItem[] };

const groups: readonly NavGroup[] = [
  { label: "Workspace", items: [["Dashboard", "/", LayoutDashboard], ["New Order", "/new-order", ShoppingCart], ["Orders", "/orders", Package]] },
  { label: "Operations", items: [["Services", "/services", Boxes], ["Providers", "/providers", ServerCog], ["Wallet", "/settings", WalletCards], ["Transactions", "/orders", ReceiptText], ["API Keys", "/settings", KeyRound], ["Analytics", "/analytics", BarChart3], ["Refills", "/refills", RefreshCw]] },
  { label: "System", items: [["Logs", "/logs", ScrollText], ["Settings", "/settings", Settings]] },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const mobileItems: readonly NavItem[] = groups.flatMap((group) => group.items);
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-[#06100c] text-slate-100 lg:flex">
          <aside className="hidden w-[313px] shrink-0 border-r border-white/[0.07] bg-[#07110d] lg:block">
            <div className="sticky top-0 flex h-screen flex-col px-4 py-5">
              <Link href="/" className="mb-6 flex items-center gap-3 px-2">
                <img src="/mark.svg" alt="GeekyAce Social Hub" className="h-10 w-10 rounded-xl" />
                <div className="leading-none">
                  <div className="text-[17px] font-extrabold tracking-[-.04em] text-white">Geeky<span className="text-emerald-400">Ace</span></div>
                  <div className="mt-1 text-[11px] font-semibold text-slate-400">Social Hub</div>
                </div>
              </Link>

              <div className="mb-5 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.05] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.9)]" />
                  <span className="text-[10px] font-bold uppercase tracking-[.16em] text-emerald-300">Private workspace</span>
                </div>
              </div>

              <nav className="space-y-5 overflow-y-auto pr-1">
                {groups.map((group) => (
                  <div key={group.label}>
                    <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[.2em] text-slate-600">{group.label}</p>
                    <div className="space-y-1">
                      {group.items.map(([label, href, Icon]) => (
                        <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-[13px] font-medium text-slate-400 transition hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-white">
                          <Icon size={16} strokeWidth={1.9} className="text-slate-600 transition group-hover:text-emerald-400" />
                          <span>{label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>

              <div className="mt-auto pt-4">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <ShieldCheck size={15} className="text-emerald-400" />
                    Owner-only access
                  </div>
                  <p className="mt-1.5 text-[10px] leading-4 text-slate-600">Provider credentials remain server-side.</p>
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#06100c]/90 px-4 py-3 backdrop-blur-xl lg:hidden">
              <div className="flex items-center justify-between gap-3">
                <Link href="/" className="flex items-center gap-2.5">
                  <img src="/mark.svg" alt="GeekyAce Social Hub" className="h-9 w-9 rounded-xl" />
                  <span className="font-semibold text-white">Geeky<span className="text-emerald-400">Ace</span> Social Hub</span>
                </Link>
                <Link href="/new-order" className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-bold text-[#06100c]">
                  <Zap size={13} /> New order
                </Link>
              </div>
              <nav className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
                {mobileItems.map(([label, href]) => (
                  <Link key={href} href={href} className="whitespace-nowrap rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-slate-400">{label}</Link>
                ))}
              </nav>
            </header>

            <div className="relative min-h-screen overflow-hidden">
              <div className="pointer-events-none fixed inset-0 -z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(16,185,129,.08),transparent_30%),radial-gradient(circle_at_25%_70%,rgba(20,184,166,.04),transparent_28%)]" />
              <div className="relative z-10">{children}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
