import { NextResponse } from "next/server";
import { getStarterTrendCandidates } from "@/lib/content/engine";
import { requireOwner } from "@/lib/auth/require-owner";

export const runtime = "nodejs";

export async function POST() {
  const denied = await requireOwner();
  if (denied) return denied;
  const candidates = getStarterTrendCandidates();
  return NextResponse.json({
    ok: true,
    message: "Content engine foundation run completed: " + candidates.length + " opportunities prepared. Production trend, AI video and publishing adapters are the next execution layer.",
    opportunities: candidates.map((item) => item.title),
  });
}
