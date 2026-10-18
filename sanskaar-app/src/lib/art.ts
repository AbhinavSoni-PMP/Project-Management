/* Illustrated previews: the website's own SVG drawing code (art.generated.js),
   cached per product/view so lists don't redraw on every render. */
import { byId, Product, View } from "./catalog";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Art = require("../data/art.generated.js") as {
  garment(p: Product, view?: string, opts?: object): string;
  scene(opts?: object): string;
  figureGroup(p: Product, x: number, y: number, scale: number): string;
  shade(hex: string, amt: number): string;
};

export const shade = Art.shade;

// react-native-svg has no feDropShadow; drop filter references so shapes still render
const native = (svg: string) => svg.replace(/\sfilter="url\([^)]*\)"/g, "");

const cache = new Map<string, string>();
export function garmentSvg(p: Product, view: View): string {
  const key = `${p.id}:${view}`;
  let svg = cache.get(key);
  if (!svg) {
    svg = native(Art.garment(p, view === "flatlay" ? "front" : view));
    cache.set(key, svg);
  }
  return svg;
}

export interface SceneOpts {
  colors: [string, string]; w?: number; h?: number; seed?: number; sunX?: number; sun?: string;
  /** garments standing in the scene: product id, position and scale */
  figures?: [id: string, x: number, y: number, scale: number][];
}
/** Rajasthani palace scene (optionally with garments), the website's fallback for site photos. */
export function sceneSvg(key: string, { figures = [], ...opts }: SceneOpts): string {
  let svg = cache.get(key);
  if (!svg) {
    const figure = figures.map(([id, x, y, s]) => { const p = byId(id); return p ? Art.figureGroup(p, x, y, s) : ""; }).join("");
    svg = native(Art.scene({ ...opts, figure }));
    cache.set(key, svg);
  }
  return svg;
}
