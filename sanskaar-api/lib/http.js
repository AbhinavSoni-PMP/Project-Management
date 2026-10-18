/* Tiny helpers so the handlers run unchanged on Vercel and on the local dev server */

/** An error whose message is safe to show the customer. */
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 6_000_000) throw new HttpError(413, "That file is too large.");
  }
  try { return JSON.parse(raw || "{}"); } catch { throw new HttpError(400, "Invalid request."); }
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function sendFile(res, name, type, buffer) {
  res.statusCode = 200;
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.end(buffer);
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
}

module.exports = { HttpError, readJson, send, sendFile, cors };
