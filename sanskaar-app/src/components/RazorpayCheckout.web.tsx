/* Web build: open Razorpay Standard Checkout directly on the page */
import { useEffect } from "react";
import { checkoutOptions } from "../lib/payments";
import type { CheckoutProps } from "./RazorpayCheckout";

type RazorpayCtor = new (o: object) => { open(): void; on(e: string, cb: (r: { error?: { description?: string } }) => void): void };
const SRC = "https://checkout.razorpay.com/v1/checkout.js";

function load(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject());
    s.onerror = () => reject();
    document.body.appendChild(s);
  });
}

export function RazorpayCheckout({ order, customer, onSuccess, onDismiss, onFailure }: CheckoutProps) {
  useEffect(() => {
    load()
      .then(Razorpay => {
        const o = checkoutOptions(order, customer);
        const rzp = new Razorpay({ ...o, handler: onSuccess, modal: { ...o.modal, ondismiss: onDismiss } });
        rzp.on("payment.failed", r => onFailure(r.error?.description || "Payment failed."));
        rzp.open();
      })
      .catch(() => onFailure("Couldn't load the payment page. Please check your connection."));
    // opened once per order
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.orderId]);
  return null;
}
