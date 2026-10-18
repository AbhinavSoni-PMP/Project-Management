/* Customer accounts: scrypt-hashed passwords and signed 30-day sign-in tokens.
   Owners are the accounts whose email is listed in OWNER_EMAILS. */
const crypto = require("crypto");
const { db } = require("./db");
const { HttpError } = require("./http");

const TOKEN_DAYS = 30;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is not set (use a long random string)");
  return s;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function checkPassword(password, stored) {
  const [, salt, hash] = String(stored).split("$");
  if (!salt || !hash) return false;
  const calc = crypto.scryptSync(password, Buffer.from(salt, "base64"), 64);
  const expected = Buffer.from(hash, "base64");
  return calc.length === expected.length && crypto.timingSafeEqual(calc, expected);
}

const sign = body => crypto.createHmac("sha256", secret()).update(body).digest("base64url");

function makeToken(userId) {
  const body = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + TOKEN_DAYS * 864e5 })).toString("base64url");
  return `${body}.${sign(body)}`;
}

function readToken(token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(sign(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const data = JSON.parse(Buffer.from(body, "base64url").toString());
  return data.exp > Date.now() ? data.uid : null;
}

const owners = () => (process.env.OWNER_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const publicUser = u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, isOwner: owners().includes(u.email) });

const cleanPhone = v => String(v || "").replace(/[\s-]/g, "").replace(/^(\+91|0)/, "");
const cleanEmail = v => String(v || "").trim().toLowerCase();

async function signup({ name, email, phone, password }) {
  name = String(name || "").trim().replace(/\s+/g, " ");
  email = cleanEmail(email);
  phone = cleanPhone(phone);
  if (!name) throw new HttpError(400, "Please enter your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Please enter a valid email address.");
  if (!/^[6-9]\d{9}$/.test(phone)) throw new HttpError(400, "Please enter a valid 10-digit mobile number.");
  if (String(password || "").length < 8) throw new HttpError(400, "Password must be at least 8 characters.");
  const { query } = await db();
  const taken = await query("select email, phone from users where email = $1 or phone = $2", [email, phone]);
  if (taken.length) throw new HttpError(409, taken[0].email === email ? "An account with this email already exists. Please log in." : "An account with this mobile number already exists. Please log in.");
  const [user] = await query(
    "insert into users (name, email, phone, password_hash) values ($1, $2, $3, $4) returning *",
    [name, email, phone, hashPassword(password)]
  );
  return { token: makeToken(user.id), user: publicUser(user) };
}

async function login({ login: id, password }) {
  const { query } = await db();
  const key = String(id || "").includes("@") ? cleanEmail(id) : cleanPhone(id);
  const [user] = await query("select * from users where email = $1 or phone = $1", [key]);
  if (!user || !checkPassword(String(password || ""), user.password_hash)) throw new HttpError(401, "Wrong email/mobile number or password.");
  return { token: makeToken(user.id), user: publicUser(user) };
}

/** The signed-in user, or a 401. */
async function requireUser(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  let uid = null;
  try { uid = m && readToken(m[1]); } catch { uid = null; }
  if (!uid) throw new HttpError(401, "Please log in to continue.");
  const { query } = await db();
  const [user] = await query("select * from users where id = $1", [uid]);
  if (!user) throw new HttpError(401, "Please log in to continue.");
  return publicUser(user);
}

async function requireOwner(req) {
  const user = await requireUser(req);
  if (!user.isOwner) throw new HttpError(403, "Only the store owner can do this.");
  return user;
}

module.exports = { signup, login, requireUser, requireOwner, hashPassword, checkPassword, makeToken, readToken };
