import type { TrendCandidate } from "@/lib/content/engine";

export async function collectYouTubeTrending(regionCode = "NG"): Promise<TrendCandidate[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet,statistics");
  url.searchParams.set("chart", "mostPopular");
  url.searchParams.set("regionCode", regionCode);
  url.searchParams.set("maxResults", "50");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("YouTube Data API returned " + response.status);
  const data = await response.json() as { items?: Array<{ id: string; snippet?: { title?: string; description?: string; categoryId?: string }; statistics?: { viewCount?: string } }> };

  return (data.items ?? []).map((item) => {
    const title = item.snippet?.title ?? "Untitled";
    const views = Number(item.statistics?.viewCount ?? 0);
    return {
      title,
      summary: item.snippet?.description?.slice(0, 280) || "Trending video on YouTube.",
      source: "youtube-trending",
      url: "https://www.youtube.com/watch?v=" + item.id,
      relevanceScore: relevanceForGeekyAce(title + " " + (item.snippet?.description ?? "")),
      momentumScore: Math.min(100, Math.round(Math.log10(Math.max(views, 1)) * 10)),
      riskScore: riskForTopic(title),
    };
  }).filter((item) => item.relevanceScore >= 48);
}

function relevanceForGeekyAce(text: string) {
  const value = text.toLowerCase();
  const keywords = ["shopify","ecommerce","website","web","seo","ai","artificial intelligence","automation","online store","marketing","business","wordpress","wix","webflow","software"];
  return Math.min(100, 35 + keywords.filter((keyword) => value.includes(keyword)).length * 12);
}

function riskForTopic(title: string) {
  const value = title.toLowerCase();
  return ["death","war","crime","violence","election","politics","adult","gambling","drugs"].some((word) => value.includes(word)) ? 90 : 5;
}
