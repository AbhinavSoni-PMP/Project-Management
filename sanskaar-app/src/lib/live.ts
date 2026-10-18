/* Loads the owner's live prices and stock at start-up: last known values instantly,
   then a fresh copy (waiting at most ~2.5 s so the app never hangs on a slow network). */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, apiReady, LiveProduct } from "./api";
import { applyLive } from "./catalog";

const KEY = "sanskaar:live";

export async function loadLiveCatalog() {
  if (!apiReady) return;
  try {
    const cached = await AsyncStorage.getItem(KEY);
    if (cached) applyLive(JSON.parse(cached));
  } catch { /* no cache yet */ }
  try {
    const { products } = await api<{ products: LiveProduct[] }>("/api/catalog", { timeoutMs: 2500 });
    applyLive(products);
    AsyncStorage.setItem(KEY, JSON.stringify(products)).catch(() => {});
  } catch { /* keep cached or built-in prices */ }
}
