/* ==========================================================================
   Owner's Excel workbook
   --------------------------------------------------------------------------
   Download → edit the yellow columns → upload. Grey columns are calculated
   (selling price, tentative delivery date, remaining stock) or come from the
   orders (sold), and are ignored on upload.
   ========================================================================== */
const ExcelJS = require("exceljs");
const catalog = require("../data/catalog.json");
const { allProducts, updateProduct, cleanUpdate, productsById, SIZE_UNITS } = require("./catalog");
const { allOrders } = require("./orders");
const { HttpError } = require("./http");

const info = new Map(catalog.products.map(p => [p.id, p]));

// key, header, width, editable
const COLUMNS = [
  ["id", "Product ID", 15, false],
  ["name", "Name", 34, false],
  ["category", "Category", 16, false],
  ["mrp", "MRP (₹)", 11, true],
  ["discountPct", "Discount %", 11, true],
  ["discountAmt", "Discount (₹)", 12, true],
  ["price", "Selling price (₹)", 16, false],
  ["deliveryDays", "Delivery days", 13, true],
  ["deliveryDate", "Tentative delivery date", 20, false],
  ["sizes", "Sizes", 26, true],
  ["sizeUnit", "Size unit", 11, true],
  ["inventory", "Stock received", 14, true],
  ["sold", "Sold (app + website)", 18, false],
  ["remaining", "Remaining", 11, false],
  ["active", "Show in store (Yes/No)", 20, true]
];
const col = key => String.fromCharCode(65 + COLUMNS.findIndex(c => c[0] === key));

const YELLOW = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF4CC" } };
const GREY = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDED" } };

async function exportWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SANSKAAR";
  const ws = wb.addWorksheet("Products", { views: [{ state: "frozen", xSplit: 2, ySplit: 1 }] });
  ws.columns = COLUMNS.map(([key, header, width]) => ({ key, header, width }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { wrapText: true, vertical: "middle" };

  const products = await allProducts();
  products.forEach((p, i) => {
    const r = i + 2;
    const row = ws.addRow({
      id: p.id, name: p.name, category: info.get(p.id)?.category ?? "",
      mrp: p.mrp, discountPct: p.discountPct, discountAmt: p.discountAmt,
      price: { formula: `MAX(0,ROUND(${col("mrp")}${r}*(1-${col("discountPct")}${r}/100),0)-${col("discountAmt")}${r})`, result: p.price },
      deliveryDays: p.deliveryDays,
      deliveryDate: { formula: `TODAY()+${col("deliveryDays")}${r}` },
      sizes: p.sizes.join(", "), sizeUnit: p.sizeUnit,
      inventory: p.inventory, sold: p.sold,
      remaining: { formula: `MAX(0,${col("inventory")}${r}-${col("sold")}${r})`, result: p.remaining },
      active: p.active ? "Yes" : "No"
    });
    COLUMNS.forEach(([key, , , editable], c) => { row.getCell(c + 1).fill = editable ? YELLOW : GREY; });
    row.getCell("deliveryDate").numFmt = "dd mmm yyyy";
    ["mrp", "discountAmt", "price"].forEach(k => { row.getCell(k).numFmt = "₹#,##0"; });
    row.getCell("sizeUnit").dataValidation = { type: "list", allowBlank: false, formulae: [`"${SIZE_UNITS.join(",")}"`] };
    row.getCell("active").dataValidation = { type: "list", allowBlank: false, formulae: ['"Yes,No"'] };
  });

  const help = wb.addWorksheet("How to use");
  help.getColumn(1).width = 110;
  [
    "SANSKAAR catalogue — edit the YELLOW columns, then upload this file on the Admin page.",
    "",
    "Selling price = MRP − Discount % − Discount (₹). Use either discount or both (the % is applied first).",
    "Delivery days = days from order to delivery; the app and website show the tentative delivery date to customers.",
    "Sizes = comma-separated list, e.g.  XS, S, M, L  or  38, 40, 42.   Size unit = " + SIZE_UNITS.join(" / ") + ".",
    "Stock received = total pieces you have stocked. Sold is counted automatically from paid orders on the app and website.",
    "Remaining = Stock received − Sold. When it reaches 0 the product shows as Sold out.",
    "Show in store = No hides a product without deleting it.",
    "GREY columns are calculated and ignored when you upload.",
    "New products (with photos and descriptions) are added on the website first; they then appear here automatically."
  ].forEach(t => help.addRow([t]));
  help.getRow(1).font = { bold: true, size: 13 };

  const os = wb.addWorksheet("Orders", { views: [{ state: "frozen", ySplit: 1 }] });
  os.columns = [
    ["receipt", "Order", 16], ["date", "Date", 12], ["status", "Status", 16], ["customer", "Customer", 22], ["phone", "Phone", 13],
    ["city", "City / PIN", 22], ["items", "Items", 60], ["total", "Total (₹)", 12], ["expected", "Expected delivery", 16], ["tracking", "Courier / tracking", 26]
  ].map(([key, header, width]) => ({ key, header, width }));
  os.getRow(1).font = { bold: true };
  for (const o of await allOrders()) {
    os.addRow({
      receipt: o.receipt, date: new Date(o.createdAt).toISOString().slice(0, 10), status: o.status,
      customer: o.customer.name, phone: o.customer.phone, city: `${o.customer.city} ${o.customer.pincode}`,
      items: o.items.map(i => `${i.id} ${i.name} (${i.size}) × ${i.qty}`).join("; "),
      total: o.total, expected: o.expectedDelivery || "", tracking: [o.courier, o.trackingNo].filter(Boolean).join(" ")
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const cellValue = v => (v && typeof v === "object" ? (v.result ?? v.text ?? (v.richText ? v.richText.map(t => t.text).join("") : "")) : v);

/** Applies the yellow columns of an uploaded workbook. All rows are checked before anything is saved. */
async function importWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buffer); } catch { throw new HttpError(400, "That doesn't look like an Excel (.xlsx) file."); }
  const ws = wb.getWorksheet("Products") || wb.worksheets[0];
  if (!ws) throw new HttpError(400, "The file has no Products sheet.");

  const header = {};
  ws.getRow(1).eachCell((cell, n) => {
    const c = COLUMNS.find(([, h]) => h.toLowerCase() === String(cellValue(cell.value) || "").trim().toLowerCase());
    if (c) header[c[0]] = n;
  });
  if (!header.id) throw new HttpError(400, "Couldn't find the \"Product ID\" column. Please start from the downloaded file.");

  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const id = String(cellValue(row.getCell(header.id).value) ?? "").trim();
    if (!id) return;
    const input = {};
    for (const [key, , , editable] of COLUMNS) {
      if (!editable || !header[key]) continue;
      const v = cellValue(row.getCell(header[key]).value);
      if (v !== null && v !== undefined && String(v).trim() !== "") input[key] = v;
    }
    rows.push({ id, input, line: n });
  });

  const current = await productsById(rows.map(r => r.id));
  const errors = [];
  for (const r of rows) {
    const p = current.get(r.id);
    if (!p) { errors.push(`Row ${r.line}: unknown product ID ${r.id}.`); continue; }
    try { cleanUpdate(r.input, p); } catch (e) { errors.push(`Row ${r.line}: ${e.message}`); }
  }
  if (errors.length) throw Object.assign(new HttpError(400, `Nothing was saved — please fix ${errors.length} problem(s).`), { details: errors.slice(0, 50) });
  for (const r of rows) await updateProduct(r.id, r.input);
  return { updated: rows.length };
}

module.exports = { exportWorkbook, importWorkbook, COLUMNS };
