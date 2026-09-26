import type { TrendCandidate } from "@/lib/content/engine";
import { collectGoogleTrends } from "./google";
import { collectYouTubeTrending } from "./youtube";

export async function collectLiveTrends(): Promise<TrendCandidate[]> {
  const results = await Promise.allSettled([
    collectGoogleTrends("NG"),
    collectGoogleTrends("US"),
    collectYouTubeTrending("NG"),
    collectYouTubeTrending("US"),
  ]);

  const candidates = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const seen = new Set<string>();

  return candidates
    .filter((item) => {
      const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return item.riskScore < 70;
    })
    .sort((a, b) => {
      const scoreA = a.relevanceScore * 0.55 + a.momentumScore * 0.35 - a.riskScore * 0.1;
      const scoreB = b.relevanceScore * 0.55 + b.momentumScore * 0.35 - b.riskScore * 0.1;
      return scoreB - scoreA;
    })
    .slice(0, 20);
}
