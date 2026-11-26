// Coach Portal API: /api/portal/*   (all logic lives in ../lib/portal-core.mjs)
import { getStore } from "@netlify/blobs";
import { handle } from "../lib/portal-core.mjs";

export const config = { path: "/api/portal/*" };

// Netlify Blobs adapter. Strong consistency matters: the portal does read-modify-write with etags.
function blobs() {
  const s = getStore({ name: "portal", consistency: "strong" });
  return {
    async get(key) {
      const r = await s.getWithMetadata(key, { type: "json", consistency: "strong" });
      return r ? { data: r.data, etag: r.etag } : null;
    },
    async set(key, data, opts = {}) {
      try {
        const r = await s.setJSON(key, data, opts);
        return { modified: r?.modified !== false };
      } catch (e) {
        if (e?.status === 412 || /precondition|etag|412/i.test(String(e?.message))) return { modified: false };
        throw e;
      }
    },
    async delete(key) { await s.delete(key); },
  };
}

export default async (req, context) => {
  const url = new URL(req.url);
  const body = req.method === "GET" || req.method === "HEAD" ? "" : await req.text();
  const out = await handle(
    { method: req.method, path: url.pathname.replace(/^\/api\/portal/, "") || "/", headers: Object.fromEntries(req.headers), body, ip: context?.ip },
    blobs(),
    process.env,
  );
  const headers = new Headers();
  for (const [k, v] of Object.entries(out.headers)) headers.append(k, v);
  return new Response(out.body, { status: out.status, headers });
};
