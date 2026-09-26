import { geekyAceBrand } from "./brand";

export type TrendCandidate = {
  title: string;
  summary: string;
  source: string;
  url?: string;
  relevanceScore: number;
  momentumScore: number;
  riskScore: number;
};

export type ContentPlan = {
  title: string;
  type: "short_video";
  pillar: string;
  hook: string;
  script: string;
  caption: string;
  cta: string;
  hashtags: string[];
  targetPlatforms: readonly string[];
  score: number;
};

const hooks = [
  "Your Shopify store may be losing customers because of this.",
  "Before you spend more on ads, check these three things.",
  "Most small businesses miss this on their website.",
];

export function rankTrend(candidate: TrendCandidate) {
  const score = candidate.relevanceScore * 0.55 + candidate.momentumScore * 0.35 - candidate.riskScore * 0.1;
  return Math.round(score);
}

export function buildContentPlan(candidate: TrendCandidate): ContentPlan {
  const score = rankTrend(candidate);
  const pillar = candidate.title.toLowerCase().includes("shopify") ? "Problem / Solution" : "Education";
  const hook = hooks[score % hooks.length];

  return {
    title: candidate.title + ": the GeekyAce angle",
    type: "short_video",
    pillar,
    hook,
    script: hook + " Here is what to check: " + candidate.summary + " Fix the biggest issue first, then measure the result. GeekyAce Digital Hub can help you build, fix or automate the workflow.",
    caption: candidate.title + " is worth watching if you run an online business. Save this, check your setup, and fix the highest-impact issue first.",
    cta: "Visit geekyacedigitalhub.com to get help with your website, ecommerce or automation.",
    hashtags: ["#GeekyAce","#Ecommerce","#Shopify","#WebDevelopment","#AI","#DigitalMarketing"],
    targetPlatforms: geekyAceBrand.platforms,
    score,
  };
}

export function getStarterTrendCandidates(): TrendCandidate[] {
  return [
    { title: "Shopify conversion problems", summary: "Checkout friction, weak product pages and unclear trust signals can reduce conversions.", source: "starter", relevanceScore: 95, momentumScore: 82, riskScore: 5 },
    { title: "AI automation for small businesses", summary: "Businesses are looking for practical ways to automate repetitive marketing and operations work.", source: "starter", relevanceScore: 92, momentumScore: 88, riskScore: 8 },
    { title: "Website speed and mobile UX", summary: "Slow pages and poor mobile experiences can make visitors leave before they contact a business.", source: "starter", relevanceScore: 90, momentumScore: 74, riskScore: 3 },
  ];
}
