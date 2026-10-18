/* Tiny helpers so the handlers run unchanged on Vercel and on the local dev server */

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100000) throw new Error("Body too large");
  }
  return JSON.parse(raw || "{}");
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

/** Handles CORS + method checks; returns true when the request was already answered. */
function preflight(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return true; }
  if (req.method !== "POST") { send(res, 405, { error: "Method not allowed" }); return true; }
  return false;
}

module.exports = { readJson, send, preflight };
