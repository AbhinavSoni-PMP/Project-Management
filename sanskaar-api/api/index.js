/* ==========================================================================
   SANSKAAR API — every /api/* request lands here (see vercel.json)
   ========================================================================== */
const { HttpError, cors, readJson, send, sendFile } = require("../lib/http");
const { signup, login, requireUser, requireOwner } = require("../lib/auth");
const { publicCatalog, allProducts, updateProduct } = require("../lib/catalog");
const { createOrder, confirmPayment, myOrders, getOrder, allOrders, updateOrder, STATUSES } = require("../lib/orders");
const { exportWorkbook, importWorkbook } = require("../lib/excel");

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// [method, path pattern, handler(req, params)]
const routes = [
  ["GET", "/api/health", async () => ({ ok: true })],
  ["GET", "/api/catalog", async () => ({ products: await publicCatalog() })],

  ["POST", "/api/auth/signup", async req => signup(await readJson(req))],
  ["POST", "/api/auth/login", async req => login(await readJson(req))],
  ["GET", "/api/auth/me", async req => ({ user: await requireUser(req) })],

  ["POST", "/api/orders", async req => createOrder(await requireUser(req), await readJson(req))],
  ["POST", "/api/verify", async req => ({ ok: true, order: await confirmPayment(await requireUser(req), await readJson(req)) })],
  ["GET", "/api/orders", async req => ({ orders: await myOrders(await requireUser(req)) })],
  ["GET", "/api/orders/:receipt", async (req, p) => ({ order: await getOrder(await requireUser(req), p.receipt) })],

  ["GET", "/api/admin/products", async req => { await requireOwner(req); return { products: await allProducts() }; }],
  ["PUT", "/api/admin/products/:id", async (req, p) => { await requireOwner(req); return { product: await updateProduct(p.id, await readJson(req)) }; }],
  ["GET", "/api/admin/catalog.xlsx", async (req, p, res) => {
    await requireOwner(req);
    sendFile(res, `sanskaar-catalogue-${new Date().toISOString().slice(0, 10)}.xlsx`, XLSX, await exportWorkbook());
  }],
  ["POST", "/api/admin/catalog.xlsx", async req => {
    await requireOwner(req);
    const { file } = await readJson(req);
    if (!file) throw new HttpError(400, "Please choose the Excel file to upload.");
    return importWorkbook(Buffer.from(String(file), "base64"));
  }],
  ["GET", "/api/admin/orders", async req => { await requireOwner(req); return { orders: await allOrders(), statuses: STATUSES }; }],
  ["PUT", "/api/admin/orders/:receipt", async (req, p) => { await requireOwner(req); return { order: await updateOrder(p.receipt, await readJson(req)) }; }]
].map(([method, path, handler]) => {
  const keys = [];
  const re = new RegExp("^" + path.replace(/[.]/g, "\\.").replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "/?$");
  return { method, re, keys, handler };
});

module.exports = async function api(req, res) {
  cors(res);
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  const path = req.url.split("?")[0];
  const matches = routes.filter(r => r.re.test(path));
  const route = matches.find(r => r.method === req.method);
  if (!route) return send(res, matches.length ? 405 : 404, { error: matches.length ? "Method not allowed" : "Not found" });
  const m = route.re.exec(path);
  const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
  try {
    const out = await route.handler(req, params, res);
    if (!res.writableEnded) send(res, 200, out);
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message, ...(err.details ? { details: err.details } : {}) });
    console.error(err);
    send(res, 500, { error: "Something went wrong on our side. Please try again in a moment." });
  }
};
