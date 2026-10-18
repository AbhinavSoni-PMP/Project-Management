/* Typed access to the catalogue synced from the website (see scripts/sync-from-website.js) */
import data from "../data/catalog.json";
import { images } from "../data/images.generated";
import type { LiveProduct } from "./api";

export type Gender = "men" | "women";
export type View = "front" | "back" | "side" | "detail" | "flatlay";

export interface Product {
  id: string;
  name: string;
  gender: Gender;
  category: string;
  collection: string;
  occasions: string[];
  color: string;
  colorName: string;
  hex: string;
  accent: string;
  second: string;
  price: number;
  mrp: number | null;
  fabric: string;
  work: string;
  tag: "new" | "bestseller" | null;
  description: string;
  sizes: string[];
  photos: View[] | null;
  /* set from the live catalogue (owner admin) */
  sizeUnit?: string;
  deliveryDays?: number;
  inStock?: boolean;
  lowStock?: number | null;
  active?: boolean;
}

export interface Named { key: string; name: string; hint: string }
export interface Collection extends Named { deva: string; colors: [string, string] }
export interface Occasion extends Named { color: string }

export const config = data.config;
export const categories = data.categories as Record<Gender, Named[]>;
export const occasions = data.occasions as Occasion[];
export const collections = data.collections as Collection[];
export const colorTable = data.colors as Record<string, { name: string; hex: string }>;
/** Every product, including ones the owner has hidden (for artwork and old orders). */
export const allProducts = data.products as Product[];
/** Products currently for sale. Updated in place by applyLive(). */
export const products: Product[] = allProducts.slice();

export const inr = (n: number) => "₹" + Number(n).toLocaleString("en-IN");
export const byId = (id: string) => products.find(p => p.id === id);
export const catName = (key: string) =>
  [...categories.men, ...categories.women].find(c => c.key === key)?.name ?? key;
export const isSoldOut = (p: Product) => p.inStock === false;
export const quickSize = (p: Product) => p.sizes[Math.min(2, p.sizes.length - 1)];
export const collOf = (key: string) => collections.find(c => c.key === key) ?? collections[0];
export const occName = (key: string) => occasions.find(o => o.key === key)?.name ?? key;
export const discount = (p: Product) => (p.mrp ? Math.round((1 - p.price / p.mrp) * 100) : 0);

export const viewNames: Record<View, string> = {
  front: "Front", back: "Back", side: "Side", detail: "Close-up", flatlay: "Flat lay"
};
/** Shots to show for a product: its real photos, or the four illustrated views. */
export const viewsOf = (p: Product): View[] => p.photos ?? ["front", "back", "side", "detail"];

/** Bundled studio photo for a product view, if the website has one. */
export function productPhoto(p: Product, view: View): number | undefined {
  if (p.photos) {
    const shot = p.photos.includes(view) ? view : p.photos[0];
    return images[`products/${p.id}/${shot}.jpg`];
  }
  return images[`products/${p.id}/${view}.jpg`];
}
/** Bundled site photo (hero, groom, collections/...). */
export const sitePhoto = (rel: string): number | undefined => images[rel];

export const includesOf: Record<string, string> = {
  sherwani: "Sherwani, churidar, stole", bandhgala: "Bandhgala jacket, trousers", indowestern: "Indo-western jacket, dhoti trousers",
  kurta: "Kurta, pajama", jacket: "Nehru jacket, kurta, churidar", lehenga: "Lehenga, blouse (unstitched option), dupatta",
  saree: "Saree with unstitched blouse piece", anarkali: "Anarkali, churidar, dupatta", sharara: "Kurti, sharara, dupatta", suit: "Kurta, palazzo, dupatta"
};

export const sizeGuide = {
  groom: { head: ["Size", "Chest", "Waist", "Shoulder"], rows: [["36", 36, 30, 16.5], ["38", 38, 32, 17], ["40", 40, 34, 17.5], ["42", 42, 36, 18], ["44", 44, 38, 18.5], ["46", 46, 40, 19]] },
  bride: { head: ["Size", "Bust", "Waist", "Hip"], rows: [["XS", 32, 26, 35], ["S", 34, 28, 37], ["M", 36, 30, 39], ["L", 38, 32, 41], ["XL", 40, 34, 43], ["XXL", 42, 36, 45]] }
};

export interface HeroSlide { key: string; image: number; product?: Product }
/**
 * Home-screen hero slides. Portrait campaign photos named
 * site/hero-mobile-<n>.jpg (optionally site/hero-mobile-<n>-<SKU>.jpg to link
 * the look to its product) are used first; until the photoshoot is in, the
 * studio photo of every photographed product fills the hero.
 */
export function heroSlides(): HeroSlide[] {
  const campaign = Object.keys(images)
    .filter(k => /^site\/hero-mobile-\d+/.test(k))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map(k => ({ key: k, image: images[k], product: byId(k.match(/^site\/hero-mobile-\d+-(.+)\.\w+$/)?.[1] ?? "") }));
  if (campaign.length) return campaign;
  return products
    .filter(p => p.photos)
    .map(p => ({ key: p.id, image: productPhoto(p, "front")!, product: p }))
    .filter(s => s.image);
}

/** Applies the owner's live prices, discounts, sizes, stock and delivery times. */
export function applyLive(list: LiveProduct[]) {
  const live = new Map(list.map(l => [l.id, l]));
  for (const p of allProducts) {
    const l = live.get(p.id);
    if (!l) continue;
    p.price = l.price;
    p.mrp = l.mrp > l.price ? l.mrp : null;
    p.sizes = l.sizes;
    p.sizeUnit = l.sizeUnit;
    p.deliveryDays = l.deliveryDays;
    p.inStock = l.inStock;
    p.lowStock = l.lowStock;
    p.active = l.active;
  }
  products.splice(0, products.length, ...allProducts.filter(p => p.active !== false));
}

