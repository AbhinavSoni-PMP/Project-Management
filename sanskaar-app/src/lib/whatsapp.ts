import { Linking } from "react-native";
import { byId, config, inr } from "./catalog";
import type { CartItem } from "./store";

export const whatsappUrl = (text: string) =>
  `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(text)}`;

export const openWhatsApp = (text: string) => Linking.openURL(whatsappUrl(text));

export function orderMessage(items: CartItem[]) {
  let total = 0;
  const lines = items.map(i => {
    const p = byId(i.id);
    if (!p) return "";
    total += p.price * i.qty;
    return `• ${p.name} (${p.id}) — Size ${i.size} × ${i.qty} — ${inr(p.price * i.qty)}`;
  }).filter(Boolean);
  return `Namaste SANSKAAR! I'd like to place an order:\n${lines.join("\n")}\nTotal: ${inr(total)}`;
}
