/* Talks to the SANSKAAR payments API (../sanskaar-api), which creates the
   Razorpay order and confirms the payment. Set its address in .env:
     EXPO_PUBLIC_API_URL=https://your-api.vercel.app */
import type { Address, CartItem } from "./store";

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
export const paymentsConfigured = !!API_URL;

export interface PricedLine { id: string; name: string; size: string; qty: number; price: number; total: number }
export interface PaymentOrder {
  orderId: string; keyId: string; amount: number; currency: string; receipt: string;
  summary: { lines: PricedLine[]; subtotal: number; shipping: number; total: number };
}
export interface RazorpaySuccess { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("No internet connection. Please check your network and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data as T;
}

export const createOrder = (items: CartItem[], customer: Address) =>
  post<PaymentOrder>("/api/orders", { items: items.map(({ id, size, qty }) => ({ id, size, qty })), customer });

export const verifyPayment = (r: RazorpaySuccess) =>
  post<{ ok: boolean; orderId: string; paymentId: string }>("/api/verify", r);

/** Options for Razorpay Standard Checkout (cards, UPI, net banking, wallets, EMI). */
export const checkoutOptions = (order: PaymentOrder, customer: Address) => ({
  key: order.keyId,
  order_id: order.orderId,
  amount: order.amount,
  currency: order.currency,
  name: "SANSKAAR",
  description: `Order ${order.receipt}`,
  prefill: { name: customer.name, email: customer.email, contact: customer.phone },
  notes: { receipt: order.receipt },
  theme: { color: "#c8a45c", backdrop_color: "#0e0c0b" },
  modal: { confirm_close: true }
});
