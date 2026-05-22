// /api/requests — Netlify Function backing the shared request queue.
// Storage: Netlify Blobs (built-in, free tier).
import { getStore } from "@netlify/blobs";

const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      ...init.headers,
    },
  });

export default async (req) => {
  try {
    const store = getStore({ name: "requests", consistency: "strong" });

    if (req.method === "OPTIONS") return json({});

    // ── GET ──────────────────────────────────────────────────────────
    if (req.method === "GET") {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      if (id) {
        const raw = await store.get(id);
        if (!raw) return json({ error: "Not found" }, { status: 404 });
        return json(JSON.parse(raw));
      }
      const list = await store.list();
      const items = await Promise.all(
        list.blobs.map(async (b) => {
          const raw = await store.get(b.key);
          try { return JSON.parse(raw); } catch { return null; }
        })
      );
      return json(
        items.filter(Boolean).sort((a, b) =>
          String(a.submittedAt || "").localeCompare(String(b.submittedAt || ""))
        )
      );
    }

    // ── POST ─────────────────────────────────────────────────────────
    if (req.method === "POST") {
      const body = await req.json();
      const id =
        body.id ||
        "r_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const now = new Date().toISOString();
      const record = {
        ...body,
        id,
        status: body.status || "Requested",
        submittedAt: body.submittedAt || now,
        updatedAt: now,
        statusHistory: body.statusHistory || [
          { status: "Requested", at: now, by: "requester" },
        ],
      };
      await store.set(id, JSON.stringify(record));
      return json(record, { status: 201 });
    }

    // ── PATCH ────────────────────────────────────────────────────────
    if (req.method === "PATCH") {
      const body = await req.json();
      if (!body.id) return json({ error: "Missing id" }, { status: 400 });
      const existingRaw = await store.get(body.id);
      if (!existingRaw)
        return json({ error: "Not found — id: " + body.id }, { status: 404 });
      const existing = JSON.parse(existingRaw);
      const now = new Date().toISOString();
      const { _by, ...rest } = body;
      const merged = { ...existing, ...rest, updatedAt: now };
      if (body.status && body.status !== existing.status) {
        merged.statusHistory = [
          ...(existing.statusHistory || []),
          { status: body.status, at: now, by: _by || "ops" },
        ];
      }
      delete merged._by;
      await store.set(body.id, JSON.stringify(merged));
      return json(merged);
    }

    // ── DELETE ───────────────────────────────────────────────────────
    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Missing id" }, { status: 400 });
      await store.delete(id);
      return new Response(null, {
        status: 204,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    return json({ error: "Method not allowed" }, { status: 405 });

  } catch (err) {
    console.error("[requests] error:", err?.message || err);
    return new Response(
      JSON.stringify({ error: err?.message || "Internal server error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
};

export const config = { path: "/api/requests" };
