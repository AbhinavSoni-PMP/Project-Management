/* Signed-in customer, remembered on the phone */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setApiToken, setOnSignedOut, User } from "./api";

const KEY = "sanskaar:auth";

interface Auth {
  user: User | null;
  ready: boolean;
  login(login: string, password: string): Promise<User>;
  signup(form: { name: string; email: string; phone: string; password: string }): Promise<User>;
  logout(): void;
}

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const save = useCallback((token: string | null, u: User | null) => {
    setApiToken(token);
    setUser(u);
    if (token) AsyncStorage.setItem(KEY, JSON.stringify({ token, user: u })).catch(() => {});
    else AsyncStorage.removeItem(KEY).catch(() => {});
  }, []);

  useEffect(() => {
    setOnSignedOut(() => save(null, null));
    AsyncStorage.getItem(KEY)
      .then(raw => {
        if (!raw) return;
        const { token, user: u } = JSON.parse(raw);
        setApiToken(token);
        setUser(u);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [save]);

  const value = useMemo<Auth>(() => ({
    user, ready,
    async login(login, password) {
      const r = await api<{ token: string; user: User }>("/api/auth/login", { method: "POST", body: { login, password } });
      save(r.token, r.user);
      return r.user;
    },
    async signup(form) {
      const r = await api<{ token: string; user: User }>("/api/auth/signup", { method: "POST", body: form });
      save(r.token, r.user);
      return r.user;
    },
    logout() { save(null, null); }
  }), [user, ready, save]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
