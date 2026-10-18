/* The SANSKAAR API (../sanskaar-api): accounts, live catalogue, orders and tracking.
   Its address comes from EXPO_PUBLIC_API_URL in .env, or SANSKAAR.config.apiUrl on
   the website (synced with `npm run sync`). */
import { config } from "./catalog";

const API_URL = (process.env.EXPO_PUBLIC_API_URL || (config as { apiUrl?: string }).apiUrl || "").replace(/\/$/, "");
export const apiReady = !!API_URL;

let token: string | null = null;
let onSignedOut: (() => void) | null = null;
export const setApiToken = (t: string | null) => { token = t; };
export const setOnSignedOut = (fn: () => void) => { onSignedOut = fn; };

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function api<T>(path: string, { method = "GET", body, timeoutMs }: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  if (!API_URL) throw new ApiError("Online services aren't switched on yet.", 0);
  const ctrl = timeoutMs ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      signal: ctrl?.signal,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError("network", 0);
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (res.status === 401 && token) onSignedOut?.();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "Something went wrong. Please try again.", res.status);
  return data as T;
}

/* ---------- Shapes returned by the API ---------- */
export interface User { id: number; name: string; email: string; phone: string; isOwner: boolean }
export type OrderStatus = "confirmed" | "tailoring" | "shipped" | "out_for_delivery" | "delivered" | "cancelled";
export const STEPS: OrderStatus[] = ["confirmed", "tailoring", "shipped", "out_for_delivery", "delivered"];
export interface Order {
  receipt: string; status: OrderStatus; createdAt: string; paidAt: string | null; paymentId: string | null;
  subtotal: number; shipping: number; total: number;
  customer: { name: string; phone: string; email: string; line1: string; line2: string; city: string; state: string; pincode: string };
  items: { id: string; name: string; size: string; qty: number; price: number }[];
  expectedDelivery: string | null; courier: string; trackingNo: string; trackingUrl: string;
  history: { status: OrderStatus; at: string; note?: string }[];
}
export interface LiveProduct {
  id: string; mrp: number; price: number; deliveryDays: number; sizes: string[]; sizeUnit: string;
  active: boolean; inStock: boolean; lowStock: number | null;
}
