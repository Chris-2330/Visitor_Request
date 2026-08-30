import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 32_768;

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function sameToken(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function validRecord(record: unknown): record is Record<string, unknown> {
  if (!record || typeof record !== "object" || Array.isArray(record)) return false;
  const value = record as Record<string, unknown>;
  return (
    typeof value.referenceNumber === "string" && value.referenceNumber.length <= 80 &&
    typeof value.name === "string" && value.name.trim().length > 0 && value.name.length <= 200 &&
    (typeof value.email === "string" || typeof value.phone === "string") &&
    value.consent === true
  );
}

export async function POST(request: Request) {
  const appsScriptUrl = process.env.APPS_SCRIPT_URL;
  const syncToken = process.env.SYNC_TOKEN;
  if (!appsScriptUrl || !syncToken) return json({ ok: false, error: "Sync service is not configured." }, 503);

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return json({ ok: false, error: "Content-Type must be application/json." }, 415);
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) return json({ ok: false, error: "Request body is too large." }, 413);

  let payload: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return json({ ok: false, error: "Request body is too large." }, 413);
    }
    payload = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "Invalid JSON." }, 400);
  }

  const record = (payload as { record?: unknown } | null)?.record;
  if (!validRecord(record)) return json({ ok: false, error: "Invalid visitor record." }, 400);

  try {
    const upstream = await fetch(appsScriptUrl, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: syncToken, record }),
      signal: AbortSignal.timeout(10_000),
    });
    const result = (await upstream.json().catch(() => null)) as { ok?: boolean; referenceNumber?: string; error?: string } | null;
    if (!upstream.ok || result?.ok !== true) {
      return json({ ok: false, error: "Upstream sync failed." }, 502);
    }

    const returnedReference = String(result.referenceNumber || "");
    if (!sameToken(returnedReference, String(record.referenceNumber))) {
      return json({ ok: false, error: "Upstream response mismatch." }, 502);
    }
    return json({ ok: true, referenceNumber: returnedReference });
  } catch {
    return json({ ok: false, error: "Upstream sync failed." }, 502);
  }
}

export function GET() {
  return json({ ok: true, service: "ITRI visitor request secure relay" });
}
