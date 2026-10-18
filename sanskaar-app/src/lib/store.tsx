/* Bag, wishlist and recently viewed — persisted on the device */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { byId } from "./catalog";

export interface CartItem { id: string; size: string; qty: number }

interface State { cart: CartItem[]; wish: string[]; recent: string[] }
const KEY = "sanskaar:v1";
const empty: State = { cart: [], wish: [], recent: [] };

interface Store extends State {
  ready: boolean;
  addToCart(id: string, size: string, qty?: number): void;
  setQty(index: number, qty: number): void;
  clearCart(): void;
  toggleWish(id: string): boolean;
  isWished(id: string): boolean;
  viewed(id: string): void;
  cartCount: number;
  cartTotal: number;
  toast: string | null;
  showToast(msg: string): void;
}

const Ctx = createContext<Store | null>(null);

const tap = () => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(empty);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(raw => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<State>;
        // drop anything no longer in the catalogue
        setState({
          cart: (saved.cart ?? []).filter(i => byId(i.id)),
          wish: (saved.wish ?? []).filter(id => byId(id)),
          recent: (saved.recent ?? []).filter(id => byId(id))
        });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, [state, ready]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const store = useMemo<Store>(() => ({
    ...state,
    ready,
    toast,
    showToast,
    addToCart(id, size, qty = 1) {
      tap();
      setState(s => {
        const hit = s.cart.find(i => i.id === id && i.size === size);
        const cart = hit
          ? s.cart.map(i => (i === hit ? { ...i, qty: i.qty + qty } : i))
          : [...s.cart, { id, size, qty }];
        return { ...s, cart };
      });
    },
    setQty(index, qty) {
      setState(s => ({
        ...s,
        cart: qty < 1 ? s.cart.filter((_, i) => i !== index) : s.cart.map((it, i) => (i === index ? { ...it, qty } : it))
      }));
    },
    clearCart() { setState(s => ({ ...s, cart: [] })); },
    toggleWish(id) {
      tap();
      const on = !state.wish.includes(id);
      setState(s => ({ ...s, wish: on ? [...s.wish, id] : s.wish.filter(x => x !== id) }));
      return on;
    },
    isWished: id => state.wish.includes(id),
    viewed(id) {
      setState(s => (s.recent[0] === id ? s : { ...s, recent: [id, ...s.recent.filter(x => x !== id)].slice(0, 8) }));
    },
    cartCount: state.cart.reduce((n, i) => n + i.qty, 0),
    cartTotal: state.cart.reduce((n, i) => n + (byId(i.id)?.price ?? 0) * i.qty, 0)
  }), [state, ready, toast, showToast]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside <StoreProvider>");
  return s;
}
