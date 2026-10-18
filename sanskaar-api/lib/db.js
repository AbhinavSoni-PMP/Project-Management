/* ==========================================================================
   Database: Postgres in production (DATABASE_URL, e.g. Neon via Vercel), an
   embedded Postgres (PGlite) on your computer and in tests.
   Tables are created on first use and products are seeded from
   data/catalog.json (synced from the website).
   ========================================================================== */
const catalog = require("../data/catalog.json");

const SCHEMA = [
  `create table if not exists users (
     id serial primary key,
     name text not null,
     email text not null unique,
     phone text not null unique,
     password_hash text not null,
     created_at timestamptz not null default now())`,
  `create table if not exists products (
     id text primary key,
     name text not null,
     mrp integer not null,
     discount_pct numeric(5,2) not null default 0,
     discount_amt integer not null default 0,
     delivery_days integer not null default 10,
     sizes text not null,
     size_unit text not null default 'Standard',
     inventory integer not null default 10,
     active boolean not null default true,
     updated_at timestamptz not null default now())`,
  `create table if not exists orders (
     id serial primary key,
     receipt text not null unique,
     user_id integer not null references users(id),
     status text not null default 'pending',
     customer jsonb not null,
     subtotal integer not null,
     shipping integer not null,
     total integer not null,
     razorpay_order_id text unique,
     payment_id text,
     paid_at timestamptz,
     expected_delivery date,
     courier text not null default '',
     tracking_no text not null default '',
     tracking_url text not null default '',
     history jsonb not null default '[]',
     created_at timestamptz not null default now())`,
  `create table if not exists order_items (
     order_id integer not null references orders(id) on delete cascade,
     product_id text not null,
     name text not null,
     size text not null,
     qty integer not null,
     price integer not null)`,
  `create index if not exists order_items_product on order_items(product_id)`,
  `create index if not exists orders_user on orders(user_id)`
];

async function migrate(query) {
  for (const sql of SCHEMA) await query(sql);
  // New products from the website are added; names follow the website. Prices,
  // stock and sizes are never overwritten — those belong to the owner.
  for (const p of catalog.products) {
    const mrp = p.mrp || p.price;
    await query(
      `insert into products (id, name, mrp, discount_amt, sizes, size_unit)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do update set name = excluded.name`,
      [p.id, p.name, mrp, mrp - p.price, p.sizes.join(", "), p.sizeUnit || "Standard"]
    );
  }
}

async function open() {
  let query, close;
  if (process.env.DATABASE_URL) {
    const { Pool, types } = require("pg");
    types.setTypeParser(1082, v => v); // keep DATE as "YYYY-MM-DD" (no timezone shifts)
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
    query = async (sql, params) => (await pool.query(sql, params)).rows;
    close = () => pool.end();
  } else {
    // an in-memory database would silently lose orders on a server, so refuse
    if (process.env.VERCEL) throw new Error("DATABASE_URL is not set");
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite(process.env.PGLITE_DIR || undefined);
    query = async (sql, params) => (await pg.query(sql, params)).rows;
    close = () => pg.close();
  }
  await migrate(query);
  return { query, close };
}

let ready;
/** Shared connection; retried on the next call if opening failed. */
function db() {
  if (!ready) ready = open().catch(err => { ready = undefined; throw err; });
  return ready;
}

module.exports = { db };
