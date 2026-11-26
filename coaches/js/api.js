// Backend facade. Two implementations with the same shape:
//   - Netlify (production): the /api/portal function, which stores data in Netlify Blobs
//   - In-memory demo (ONLY on localhost, where Netlify functions don't run) so the UI can be tried offline.
// Login is a secure HttpOnly cookie set by the server: nothing secret ever touches JavaScript here.

const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
export const demo = LOCAL && !globalThis.__PB_SIM__; // __PB_SIM__ is set only by portal-ops/tests/sim.html, to test the real backend path locally

let onExpired = () => {};
export const onSessionExpired = f => { onExpired = f; };

async function call(method, path, body, { quiet401 = false } = {}) {
  let r;
  try {
    r = await fetch("/api/portal" + path, {
      method, credentials: "same-origin", cache: "no-store",
      headers: method === "GET" ? {} : { "content-type": "application/json", "x-portal": "1" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch { throw Object.assign(new Error("Could not reach the server. Check your connection and try again."), { status: 0 }); }
  let data = null;
  try { data = await r.json(); } catch { /* not JSON */ }
  if (!r.ok) {
    if (r.status === 401 && !quiet401) onExpired();
    throw Object.assign(new Error(data?.error || "Could not complete that."), { status: r.status });
  }
  return data;
}

function netlifyBackend() {
  return {
    auth: {
      status: () => call("GET", "/status"),
      async session() { try { return await call("GET", "/me", undefined, { quiet401: true }); } catch (e) { if (e.status === 401) return null; throw e; } },
      signIn: (email, password) => call("POST", "/login", { email, password }, { quiet401: true }),
      signOut: () => call("POST", "/logout", {}, { quiet401: true }),
      setupInfo: token => call("POST", "/setup-info", { token }, { quiet401: true }),
      setPassword: (token, password) => call("POST", "/setup", { token, password }, { quiet401: true }),
      firstAdmin: (key, name, email, password) => call("POST", "/first-admin", { key, name, email, password }, { quiet401: true }),
      recover: (key, email) => call("POST", "/recover", { key, email }, { quiet401: true }),
    },
    all: () => call("GET", "/all"),
    backup: () => call("GET", "/backup"),
    upsert: (table, rows, onConflict = "id") => call("POST", "/write", { op: "upsert", table, rows, onConflict }),
    remove: (table, match) => call("POST", "/write", { op: "remove", table, match }),
    manage: (action, payload) => call("POST", "/coach", { action, ...payload }),
  };
}

export async function getBackend() {
  if (demo) return (await import("./demo.js")).demoBackend();
  return netlifyBackend();
}
