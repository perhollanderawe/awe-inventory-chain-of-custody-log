// /api/auth — validates shared Ops password
// Set OPS_PASSWORD as a Netlify environment variable in your site dashboard.
// Default for initial rollout: "aweinspired2026" (change this in Netlify → Site config → Env vars)

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json", ...cors }
    });
  }
  try {
    const { password } = await req.json();
    const expected = process.env.OPS_PASSWORD || "aweinspired2026";
    const ok = typeof password === "string" && password === expected;
    return new Response(JSON.stringify({ ok }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400, headers: { "Content-Type": "application/json", ...cors }
    });
  }
};

export const config = { path: "/api/auth" };
