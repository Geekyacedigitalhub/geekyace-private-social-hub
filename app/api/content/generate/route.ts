import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/require-owner";
import { generateContentPlanWithGemini } from "@/lib/content/ai/gemini";
import { getStarterTrendCandidates } from "@/lib/content/engine";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = await requireOwner();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const index = typeof body.index === "number" ? body.index : 0;
  const candidate = getStarterTrendCandidates()[index];
  if (!candidate) return NextResponse.json({ ok: false, error: "Trend candidate not found" }, { status: 404 });

  try {
    const plan = await generateContentPlanWithGemini(candidate);
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Generation failed" }, { status: 502 });
  }
}
