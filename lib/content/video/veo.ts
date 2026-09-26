const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function startVeoGeneration(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");

  const model = process.env.GEMINI_VIDEO_MODEL || "veo-3.1-generate-preview";
  const response = await fetch(API_BASE + "/models/" + encodeURIComponent(model) + ":predictLongRunning", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { aspectRatio: "9:16", resolution: "720p", numberOfVideos: 1 },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error("Veo request failed (" + response.status + "): " + detail.slice(0, 500));
  }

  return await response.json() as { name?: string; done?: boolean; [key: string]: unknown };
}

export async function getVeoOperation(operationName: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");

  const response = await fetch(API_BASE + "/" + operationName.replace(/^\/+/, ""), {
    headers: { "x-goog-api-key": apiKey },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error("Veo operation check failed (" + response.status + "): " + detail.slice(0, 500));
  }

  return await response.json() as { name?: string; done?: boolean; response?: unknown; error?: unknown };
}
