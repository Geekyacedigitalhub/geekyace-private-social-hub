import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/require-owner";
import { collectLiveTrends } from "@/lib/content/trends";
import { getStarterTrendCandidates } from "@/lib/content/engine";

export const runtime = "nodejs";

export async function POST() {
  const denied = await requireOwner();
  if (denied) return denied;

  const live = await collectLiveTrends().catch(() => []);
  const candidates = live.length ? live : getStarterTrendCandidates();

  return NextResponse.json({
    ok: true,
    mode: live.length ? "live" : "fallback",
    message: live.length
      ? "Live trend discovery completed. " + live.length + " relevant opportunities are ready for the content planner."
      : "Live sources were unavailable, so the engine returned its safe starter queue.",
    opportunities: candidates.map((item) => ({
      title: item.title,
      source: item.source,
      relevanceScore: item.relevanceScore,
      momentumScore: item.momentumScore,
      riskScore: item.riskScore,
    })),
  });
}
