import type { TrendCandidate, ContentPlan } from "@/lib/content/engine";
import { geekyAceBrand } from "@/lib/content/brand";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function generateContentPlanWithGemini(candidate: TrendCandidate): Promise<ContentPlan> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");

  const model = process.env.GEMINI_TEXT_MODEL || "gemini-3.8-flash";
  const prompt = [
    "Create one short-form social video concept for GeekyAce Digital Hub.",
    "Return only JSON matching the requested schema.",
    "Brand: " + geekyAceBrand.name,
    "Voice: " + geekyAceBrand.voice,
    "Services: " + geekyAceBrand.services.join(", "),
    "Products: " + geekyAceBrand.products.join(", "),
    "Trend title: " + candidate.title,
    "Trend summary: " + candidate.summary,
    "The content must teach something useful, avoid unsupported claims, and end with a practical CTA.",
  ].join("\n");

  const response = await fetch(API_BASE + "/models/" + encodeURIComponent(model) + ":generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            type: { type: "STRING", enum: ["short_video"] },
            pillar: { type: "STRING" },
            hook: { type: "STRING" },
            script: { type: "STRING" },
            caption: { type: "STRING" },
            cta: { type: "STRING" },
            hashtags: { type: "ARRAY", items: { type: "STRING" } },
            targetPlatforms: { type: "ARRAY", items: { type: "STRING" } },
            score: { type: "INTEGER" },
          },
          required: ["title","type","pillar","hook","script","caption","cta","hashtags","targetPlatforms","score"],
        },
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error("Gemini request failed (" + response.status + "): " + detail.slice(0, 500));
  }

  const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");

  return JSON.parse(text) as ContentPlan;
}
