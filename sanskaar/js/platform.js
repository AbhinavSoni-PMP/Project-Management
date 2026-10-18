/* ==========================================================================
   SANSKAAR — Language, account session, backend API and live catalogue
   --------------------------------------------------------------------------
   Shared by every page. The backend address is SANSKAAR.config.apiUrl
   (top of js/app.js). Without it the site still works as a catalogue, but
   log in, checkout and order tracking are switched off.
   ========================================================================== */
(function () {
  const S = window.SANSKAAR;
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } }
  };

  /* ---------- Language ---------- */
  const saved = ls.get("sk_lang", "en");
  S.lang = S.languages.some(l => l.code === saved) ? saved : "en";
  document.documentElement.lang = S.lang;
  S.t = (key, vars) => S.translate(S.lang, key, vars);
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  S.esc = esc;
  /** Translated text as HTML, with *word* in gold italics. */
  S.rich = (key, vars) => esc(S.t(key, vars)).replace(/\*([^*]+)\*/g, "<em>$1</em>");
  S.setLang = code => { ls.set("sk_lang", code); location.reload(); };
  const LOCALES = { en: "en-IN", hi: "hi-IN", gu: "gu-IN", mr: "mr-IN", kn: "kn-IN" };
  S.fmtDate = d => {
    if (!d) return "";
    const date = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T00:00:00") : new Date(d);
    return date.toLocaleDateString(LOCALES[S.lang] || "en-IN", { day: "numeric", month: "short", year: "numeric" });
  };
  S.inDays = n => { const d = new Date(); d.setDate(d.getDate() + Number(n || 0)); return d; };

  /** Fills [data-i18n] (text with *em*) and [data-i18n-ph] (placeholder) in static HTML. */
  S.applyStatic = (root = document) => {
    root.querySelectorAll("[data-i18n]").forEach(el => { el.innerHTML = S.rich(el.dataset.i18n, el.dataset.i18nVars ? JSON.parse(el.dataset.i18nVars) : undefined); });
    root.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = S.t(el.dataset.i18nPh); });
  };

  /* ---------- Backend API ---------- */
  const base = () => String((S.config && S.config.apiUrl) || "").replace(/\/$/, "");
  S.apiReady = () => !!base();

  S.session = { token: ls.get("sk_token", null), user: ls.get("sk_user", null) };
  S.saveSession = (token, user) => { S.session = { token, user }; ls.set("sk_token", token); ls.set("sk_user", user); };
  S.logout = () => { S.session = { token: null, user: null }; ls.del("sk_token"); ls.del("sk_user"); };

  /** fetch() wrapper: JSON in/out, sign-in token, readable errors. */
  S.api = async (path, { method = "GET", body, blob } = {}) => {
    if (!base()) throw new Error(S.t("co.notConfigured"));
    let res;
    try {
      res = await fetch(base() + path, {
        method,
        headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(S.session.token ? { Authorization: `Bearer ${S.session.token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      throw new Error(S.t("err.network"));
    }
    if (res.status === 401 && S.session.token) S.logout();
    if (blob && res.ok) return res.blob();
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong."), { status: res.status, details: data.details });
    return data;
  };

  /* ---------- Live prices, stock and delivery times ---------- */
  const original = S.products.slice();
  /** Every product, including ones the owner has hidden (for artwork and old orders). */
  S.allProducts = original;
  function applyLive(list) {
    const live = new Map((list || []).map(p => [p.id, p]));
    original.forEach(p => {
      const l = live.get(p.id);
      if (!l) return;
      p.price = l.price;
      p.mrp = l.mrp > l.price ? l.mrp : null;
      p.sizes = l.sizes;
      p.sizeUnit = l.sizeUnit;
      p.deliveryDays = l.deliveryDays;
      p.inStock = l.inStock;
      p.lowStock = l.lowStock;
      p.active = l.active;
    });
    S.products = original.filter(p => p.active !== false);
  }
  /** Uses the last known prices instantly, then refreshes them (waits at most ~2.5 s). */
  S.loadLive = async () => {
    if (!base()) return;
    const cached = ls.get("sk_live", null);
    if (cached) applyLive(cached);
    try {
      const data = await Promise.race([S.api("/api/catalog"), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 2500))]);
      ls.set("sk_live", data.products);
      applyLive(data.products);
    } catch (e) { /* keep the cached or built-in prices */ }
  };

  S.pages = S.pages || {};
})();
