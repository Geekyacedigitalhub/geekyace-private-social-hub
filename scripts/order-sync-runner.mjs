const baseUrl = String(process.env.SYNC_BASE_URL ?? "").trim().replace(/\/$/, "");
const secret = String(process.env.INTERNAL_SYNC_SECRET ?? "").trim();

if (!baseUrl || !secret) {
  throw new Error("SYNC_BASE_URL and INTERNAL_SYNC_SECRET are required.");
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);

try {
  const response = await fetch(`${baseUrl}/api/orders/sync`, {
    method: "POST",
    headers: {
      "x-sync-secret": secret,
      "accept": "application/json",
    },
    signal: controller.signal,
    cache: "no-store",
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Order sync returned HTTP ${response.status}: ${body.slice(0, 1000)}`);
  }

  console.log(body);
} finally {
  clearTimeout(timeout);
}
