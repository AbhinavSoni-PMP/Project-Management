/* Live product data the owner controls: price, discounts, delivery time,
   sizes, stock. "Sold" is counted from paid orders on the app and website. */
const { db } = require("./db");
const { HttpError } = require("./http");

const SIZE_UNITS = ["Standard", "Inches", "CM", "UK", "US"];

/** Selling price: MRP, less the % discount, less the ₹ discount. */
const sellingPrice = (mrp, pct, amt) => Math.max(0, Math.round(mrp * (1 - Number(pct) / 100)) - Number(amt));

const PRODUCTS_SQL = `
  select p.*,
         coalesce((select sum(i.qty) from order_items i join orders o on o.id = i.order_id
                   where i.product_id = p.id and o.status not in ('pending', 'cancelled')), 0)::int as sold
  from products p`;

function shape(r) {
  const price = sellingPrice(r.mrp, r.discount_pct, r.discount_amt);
  return {
    id: r.id,
    name: r.name,
    mrp: r.mrp,
    discountPct: Number(r.discount_pct),
    discountAmt: r.discount_amt,
    price,
    deliveryDays: r.delivery_days,
    sizes: r.sizes.split(",").map(s => s.trim()).filter(Boolean),
    sizeUnit: r.size_unit,
    inventory: r.inventory,
    sold: r.sold,
    remaining: Math.max(0, r.inventory - r.sold),
    active: r.active
  };
}

async function allProducts() {
  const { query } = await db();
  return (await query(`${PRODUCTS_SQL} order by p.id`)).map(shape);
}

async function productsById(ids) {
  const { query } = await db();
  return new Map((await query(`${PRODUCTS_SQL} where p.id = any($1)`, [ids])).map(r => [r.id, shape(r)]));
}

/** What shoppers see: no stock counts beyond "only a few left". */
async function publicCatalog() {
  return (await allProducts()).map(p => ({
    id: p.id, mrp: p.mrp, price: p.price, deliveryDays: p.deliveryDays, sizes: p.sizes, sizeUnit: p.sizeUnit,
    active: p.active, inStock: p.active && p.remaining > 0, lowStock: p.remaining > 0 && p.remaining <= 3 ? p.remaining : null
  }));
}

function cleanUpdate(input, current) {
  const num = (v, name, { min = 0, max = Infinity, int = true } = {}) => {
    const n = Number(String(v).replace(/[₹,\s%]/g, ""));
    if (!Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) throw new HttpError(400, `${current.id}: ${name} must be a number${min ? ` of at least ${min}` : ""}${max < Infinity ? ` up to ${max}` : ""}.`);
    return n;
  };
  const out = {
    mrp: input.mrp == null ? current.mrp : num(input.mrp, "MRP", { min: 1 }),
    discountPct: input.discountPct == null ? current.discountPct : num(input.discountPct, "Discount %", { max: 90, int: false }),
    discountAmt: input.discountAmt == null ? current.discountAmt : num(input.discountAmt, "Discount ₹"),
    deliveryDays: input.deliveryDays == null ? current.deliveryDays : num(input.deliveryDays, "Delivery days", { min: 1, max: 120 }),
    inventory: input.inventory == null ? current.inventory : num(input.inventory, "Stock", { max: 100000 }),
    sizes: input.sizes == null ? current.sizes : String(input.sizes).split(",").map(s => s.trim()).filter(Boolean),
    sizeUnit: input.sizeUnit == null ? current.sizeUnit : String(input.sizeUnit).trim(),
    active: input.active == null ? current.active : input.active === true || /^(yes|y|true|1)$/i.test(String(input.active))
  };
  if (!out.sizes.length) throw new HttpError(400, `${current.id}: add at least one size.`);
  const unit = SIZE_UNITS.find(u => u.toLowerCase() === out.sizeUnit.toLowerCase());
  if (!unit) throw new HttpError(400, `${current.id}: size unit must be one of ${SIZE_UNITS.join(", ")}.`);
  out.sizeUnit = unit;
  if (sellingPrice(out.mrp, out.discountPct, out.discountAmt) < 1) throw new HttpError(400, `${current.id}: the discounts take the price below ₹1.`);
  return out;
}

async function updateProduct(id, input) {
  const current = (await productsById([id])).get(id);
  if (!current) throw new HttpError(404, `Product ${id} not found.`);
  const u = cleanUpdate(input, current);
  const { query } = await db();
  await query(
    `update products set mrp = $2, discount_pct = $3, discount_amt = $4, delivery_days = $5, inventory = $6,
       sizes = $7, size_unit = $8, active = $9, updated_at = now() where id = $1`,
    [id, u.mrp, u.discountPct, u.discountAmt, u.deliveryDays, u.inventory, u.sizes.join(", "), u.sizeUnit, u.active]
  );
  return (await productsById([id])).get(id);
}

module.exports = { SIZE_UNITS, sellingPrice, allProducts, productsById, publicCatalog, updateProduct, cleanUpdate };
