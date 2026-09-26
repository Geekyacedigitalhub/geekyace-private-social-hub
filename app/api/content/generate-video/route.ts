import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/require-owner";
import { startVeoGeneration } from "@/lib/content/video/veo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await requireOwner();
  const body = await request.json().catch(() => ({}));
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return NextResponse.json({ ok: false, error: "A video prompt is required" }, { status: 400 });

  try {
    const operation = await startVeoGeneration(prompt);
    return NextResponse.json({ ok: true, operation });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Video generation failed" }, { status: 502 });
  }
}
