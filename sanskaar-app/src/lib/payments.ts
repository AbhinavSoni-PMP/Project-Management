/* Checkout calls to the SANSKAAR API: create the Razorpay order, then confirm the payment */
import { api, apiReady, Order } from "./api";
import type { Address, CartItem } from "./store";

export const paymentsConfigured = apiReady;

export interface PricedLine { id: string; name: string; size: string; qty: number; price: number; total: number }
export interface PaymentOrder {
  orderId: string; keyId: string; amount: number; currency: string; receipt: string;
  summary: { lines: PricedLine[]; subtotal: number; shipping: number; total: number; deliveryDays: number };
}
export interface RazorpaySuccess { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }

export const createOrder = (items: CartItem[], customer: Address) =>
  api<PaymentOrder>("/api/orders", { method: "POST", body: { items: items.map(({ id, size, qty }) => ({ id, size, qty })), customer } });

export const verifyPayment = (r: RazorpaySuccess) =>
  api<{ ok: boolean; order: Order }>("/api/verify", { method: "POST", body: r });

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
