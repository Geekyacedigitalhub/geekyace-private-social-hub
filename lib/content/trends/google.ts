import type { TrendCandidate } from "@/lib/content/engine";

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export async function collectGoogleTrends(geo = "NG"): Promise<TrendCandidate[]> {
  const response = await fetch("https://trends.google.com/trending/rss?geo=" + encodeURIComponent(geo), {
    headers: { "user-agent": "GeekyAce-Content-Engine/1.0" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Google Trends returned " + response.status);
  const xml = await response.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  return items.slice(0, 40).map((match) => {
    const item = match[1];
    const title = decodeXml(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").trim();
    const traffic = Number((item.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/)?.[1] ?? "0").replace(/[^0-9]/g, "")) || 0;
    const url = decodeXml(item.match(/<ht:news_item_url>([\s\S]*?)<\/ht:news_item_url>/)?.[1] ?? "").trim();
    return {
      title,
      summary: "Trending search topic in Google Trends for " + geo + ".",
      source: "google-trends",
      url,
      relevanceScore: relevanceForGeekyAce(title),
      momentumScore: Math.min(100, Math.round(Math.log10(Math.max(traffic, 1)) * 22)),
      riskScore: riskForTopic(title),
    };
  }).filter((item) => item.title);
}

function relevanceForGeekyAce(title: string) {
  const value = title.toLowerCase();
  const keywords = ["shopify","ecommerce","website","web","seo","ai","artificial intelligence","automation","online store","marketing","business","wordpress","wix","webflow","app","software"];
  const matches = keywords.filter((keyword) => value.includes(keyword)).length;
  return Math.min(100, 35 + matches * 13);
}

function riskForTopic(title: string) {
  const value = title.toLowerCase();
  const sensitive = ["death","war","crime","violence","election","politics","adult","gambling","drugs"];
  return sensitive.some((word) => value.includes(word)) ? 90 : 5;
}
