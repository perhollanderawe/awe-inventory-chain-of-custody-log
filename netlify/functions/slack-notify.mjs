// /api/slack-notify — fires a Slack Incoming Webhook on new request submissions.
// Server-side only: reads SLACK_WEBHOOK_URL from process.env.
// Non-blocking: always returns 200; Slack failures are logged as warnings only.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors },
  });

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[slack-notify] SLACK_WEBHOOK_URL not configured — skipping");
    return json({ ok: false, warning: "SLACK_WEBHOOK_URL not set" });
  }

  let data;
  try {
    data = await req.json();
  } catch (_) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const {
    requestName, aweOwner, requestedFor, purpose,
    requiredBy, arrivalBy,
    shippingRequired, shipDetails, packaging,
    items, urgent,
    retailTotal, costTotal, hasPricing,
    requestId, appUrl,
  } = data;

  if (!requestName || !aweOwner || !purpose) {
    return json({ error: "Missing required fields" }, 400);
  }

  // Line item counts
  const itemCount = Array.isArray(items) ? items.length : 0;
  const qtyTotal  = Array.isArray(items)
    ? items.reduce((s, i) => s + (Number(i.qty) || 1), 0)
    : 0;

  // Pricing display
  const fmtRetail = (hasPricing && retailTotal != null)
    ? "$" + Number(retailTotal).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : "—";
  const fmtCost = (hasPricing && costTotal != null)
    ? "$" + Number(costTotal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";

  // Shipping address line (only when shipping is required and address is present)
  let shipLine = null;
  if (shippingRequired === "Yes" && shipDetails && typeof shipDetails === "object") {
    const s = shipDetails;
    const parts = [
      s.name,
      s.street,
      [s.city, s.state, s.zip].filter(Boolean).join(", "),
      s.country,
    ].filter(Boolean);
    if (parts.length) shipLine = `*Shipping Address:* ${parts.join(", ")}`;
  }

  // Build message — null entries are filtered out
  const lines = [
    urgent ? "🚨 *URGENT — pickup is inside 48 hours*" : null,
    `*New Inventory Request Submitted*`,
    ``,
    `*Request:* ${requestName}`,
    `*Requested For:* ${requestedFor || "—"}`,
    `*AWE Owner:* ${aweOwner}`,
    `*Purpose:* ${purpose}`,
    `*Pickup / Ship-out By:* ${requiredBy || "—"}`,
    arrivalBy ? `*Arrival Needed By:* ${arrivalBy}` : null,
    `*Shipping Required:* ${shippingRequired || "—"}`,
    shipLine,
    `*Packaging:* ${packaging || "—"}`,
    ``,
    `*Line items:* ${itemCount}`,
    `*Total units:* ${qtyTotal}`,
    `*Retail value:* ${fmtRetail}`,
    `*Cost value:* ${fmtCost}`,
    ``,
    appUrl && requestId ? `<${appUrl}?req=${encodeURIComponent(requestId)}|Track this request>` : null,
    appUrl              ? `<${appUrl}|Open Request Queue>` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const slackBody = JSON.stringify({ text: lines });

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: slackBody,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[slack-notify] Slack returned ${res.status}: ${body}`);
      return json({ ok: false, warning: `Slack returned ${res.status}` });
    }
    return json({ ok: true });
  } catch (err) {
    console.error("[slack-notify] Slack POST failed:", err.message);
    return json({ ok: false, warning: err.message });
  }
};

export const config = { path: "/api/slack-notify" };
