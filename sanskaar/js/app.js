/* ==========================================================================
   SANSKAAR — Site behaviour
   Shared header, side menu and footer, cart, wishlist, appointment booking
   and the home / catalogue / product page renderers. Language, sign-in and
   live prices come from js/platform.js; account, checkout and admin pages
   register themselves in SANSKAAR.pages.
   ========================================================================== */

/* ---------- Business settings: edit these ---------- */
SANSKAAR.config = {
  brand: "SANSKAAR",
  whatsapp: "919999999999",          // country code + number, digits only
  phone: "+91 99999 99999",
  email: "hello@sanskaar.in",
  address: "MI Road, Jaipur, Rajasthan 302001",
  apiUrl: "",                        // your SANSKAAR API address, e.g. https://sanskaar-api.vercel.app
  freeShippingAbove: 4999,
  shippingFee: 250,                  // charged below freeShippingAbove
  instagram: "#", facebook: "#", youtube: "#", pinterest: "#"
};

(function () {
  const S = SANSKAAR, Art = window.SanskaarArt;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const inr = n => "₹" + Number(n).toLocaleString("en-IN");
  const byId = id => S.products.find(p => p.id === id);
  // Page state comes from "#key.value~key.value" (works everywhere, incl. sandboxed
  // previews that drop query strings) or a classic ?key=value query.
  function pageParams() {
    const u = new URLSearchParams(location.search);
    location.hash.replace(/^#/, "").split("~").filter(Boolean).forEach(t => {
      const i = t.indexOf("."); if (i > 0) u.append(t.slice(0, i), decodeURIComponent(t.slice(i + 1)));
    });
    return u;
  }
  // js/platform.js loads after this file, so look its helpers up when called
  const t = (key, vars) => S.t(key, vars), rich = (key, vars) => S.rich(key, vars);
  const catName = key => t("cat." + key);
  const occName = key => t("occ." + key);
  const collOf = key => S.collections.find(c => c.key === key);
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };

  /* ---------- Icons ---------- */
  const I = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20s-7-4.4-9.2-8.6C1.2 8.3 3 4.5 6.6 4.5c2.1 0 3.5 1.2 4.4 2.6.9-1.4 2.3-2.6 4.4-2.6 3.6 0 5.4 3.8 3.8 6.9C19 15.6 12 20 12 20z"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 6h18M3 12h18M3 18h12"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 6h12v10H2zM14 10h4l3 3v3h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
    scissors: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 7.5 20 18M8.5 16.5 20 6"/></svg>',
    hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M7 12V5a1.5 1.5 0 0 1 3 0v6M10 11V3.5a1.5 1.5 0 0 1 3 0V11M13 11V4.5a1.5 1.5 0 0 1 3 0V12M16 12V7.5a1.5 1.5 0 0 1 3 0V14c0 4-3 7-7 7s-6-2-7.5-5L3 12.5a1.5 1.5 0 0 1 2.5-1.6L7 13"/></svg>',
    return: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 9h11a5 5 0 0 1 0 10H8"/><path d="m8 5-4 4 4 4"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 8.2a3 3 0 0 0-2-2C18.2 5.7 12 5.7 12 5.7s-6.2 0-8 .5a3 3 0 0 0-2 2A31 31 0 0 0 1.7 12 31 31 0 0 0 2 15.8a3 3 0 0 0 2 2c1.8.5 8 .5 8 .5s6.2 0 8-.5a3 3 0 0 0 2-2 31 31 0 0 0 .3-3.8 31 31 0 0 0-.3-3.8zM10 15V9l5.2 3L10 15z"/></svg>',
    pinterest: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.5 1.8-2.5.9 0 1.3.7 1.3 1.4 0 .9-.6 2.2-.8 3.4-.2 1 .5 1.9 1.6 1.9 1.9 0 3.3-2 3.3-4.9 0-2.5-1.8-4.3-4.4-4.3a4.6 4.6 0 0 0-4.8 4.6c0 .9.3 1.9.8 2.4l.1.4-.3 1.2c0 .2-.2.3-.4.2-1.4-.6-2.2-2.6-2.2-4.2 0-3.4 2.5-6.6 7.2-6.6 3.8 0 6.7 2.7 6.7 6.3 0 3.8-2.4 6.8-5.7 6.8-1.1 0-2.2-.6-2.5-1.3l-.7 2.6c-.2 1-.9 2.2-1.4 2.9A10 10 0 1 0 12 2z"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>',
    lotus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M12 4c2 2.5 2.5 5.5 0 9-2.5-3.5-2-6.5 0-9z"/><path d="M12 13c-2.5-1.5-5.5-2-8-1 1 3 4 4.5 8 4.5s7-1.5 8-4.5c-2.5-1-5.5-.5-8 1z"/><path d="M5 18h14"/></svg>'
  };
  S.icons = I;

  const occasionIcon = {
    wedding: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="28" r="10"/><circle cx="30" cy="28" r="10"/><path d="M24 6l3 5h-6z" fill="currentColor"/></svg>',
    reception: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 8h8l-1 12a3 3 0 0 1-6 0zM26 8h8l-1 12a3 3 0 0 1-6 0z"/><path d="M18 23v15M30 23v15M13 40h10M25 40h10"/></svg>',
    sangeet: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="24" cy="24" rx="16" ry="9"/><path d="M8 24v6c0 5 7 9 16 9s16-4 16-9v-6"/><path d="M12 18l-4-8M36 18l4-8"/></svg>',
    mehendi: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 40V20a3 3 0 0 1 6 0v8M22 26V12a3 3 0 0 1 6 0v14M28 26V14a3 3 0 0 1 6 0v16c0 6-4 10-10 10s-9-3-11-7l-4-7a2.5 2.5 0 0 1 4-3l3 4"/><circle cx="26" cy="32" r="3"/></svg>',
    haldi: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="24" cy="24" r="7"/><path d="M24 6v6M24 36v6M6 24h6M36 24h6M11 11l4 4M33 33l4 4M37 11l-4 4M15 33l-4 4"/></svg>',
    festive: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 32h28c-2 6-7 8-14 8s-12-2-14-8z"/><path d="M24 30c-4-3-4-8 0-14 4 6 4 11 0 14z"/><path d="M24 8v3"/></svg>'
  };

  const ornament = `<div class="divider" style="margin:0 auto 22px"></div>`;

  /* ---------- Header / nav ---------- */
  function megaMenu(gender) {
    const cats = S.categories[gender];
    const feature = S.products.find(p => p.gender === gender && p.tag === "bestseller");
    return `<div class="mega"><div class="container mega-inner">
      <div><h4>${gender === "men" ? t("nav.men") : t("nav.women")}</h4><ul>
        <li><a href="catalog.html#gender.${gender}">${t("nav.viewAll")}</a></li>
        ${cats.map(c => `<li><a href="catalog.html#gender.${gender}~category.${c.key}">${catName(c.key)}</a></li>`).join("")}
      </ul></div>
      <div><h4>${t("nav.occasions")}</h4><ul>
        ${S.occasions.map(o => `<li><a href="catalog.html#gender.${gender}~occasion.${o.key}">${occName(o.key)}</a></li>`).join("")}
      </ul></div>
      <div><h4>${t("nav.collections")}</h4><ul>
        ${S.collections.map(c => `<li><a href="catalog.html#gender.${gender}~collection.${c.key}">${c.name}</a></li>`).join("")}
      </ul></div>
      <a class="mega-feature" href="catalog.html#gender.${gender}~occasion.wedding">
        <div class="art">${feature ? media(feature, "front") : ""}</div>
        <div class="txt"><span class="eyebrow">${gender === "men" ? t("home.groomEyebrow") : t("home.brideEyebrow")}</span><h3>${gender === "men" ? t("home.groomTitle") : t("home.brideTitle")}</h3></div>
      </a>
    </div></div>`;
  }

  const langPicker = id => `<label class="lang-pick" for="${id}">${I.globe}<span class="sr-only">${t("nav.language")}</span>
    <select id="${id}" data-lang-select>${S.languages.map(l => `<option value="${l.code}" ${l.code === S.lang ? "selected" : ""}>${l.name}</option>`).join("")}</select></label>`;

  function header(active) {
    const el = $("#site-header");
    if (!el) return;
    const user = S.session.user;
    el.outerHTML = `
    <div class="announce">${esc(t("home.freeShipping", { amount: inr(S.config.freeShippingAbove) }))} &nbsp;·&nbsp; <a href="#" data-open="appointment">${t("nav.consult")}</a></div>
    <header class="site-header" id="header">
      <div class="container header-row">
        <div class="header-left">
          <button class="icon-btn menu-toggle" data-open="mobile-nav" aria-label="${t("nav.menu")}">${I.menu}<span class="menu-label">${t("nav.menu")}</span></button>
          <a href="index.html" class="logo" aria-label="SANSKAAR">
            <span class="logo-mark">SANSKAAR</span><span class="logo-sub">Indian Wedding Couture</span>
          </a>
        </div>
        <nav class="main-nav" aria-label="Main">
          <ul>
            <li><a href="index.html" class="${active === "home" ? "active" : ""}">${t("nav.home")}</a></li>
            <li><a href="catalog.html#gender.women" class="${active === "women" ? "active" : ""}">${t("nav.bride")}</a>${megaMenu("women")}</li>
            <li><a href="catalog.html#gender.men" class="${active === "men" ? "active" : ""}">${t("nav.groom")}</a>${megaMenu("men")}</li>
            <li><a href="index.html#advisor">${t("nav.advisor")}</a></li>
            <li><a href="catalog.html" class="${active === "catalog" ? "active" : ""}">${t("nav.catalog")}</a></li>
          </ul>
        </nav>
        <div class="header-right">
          <span class="hide-sm">${langPicker("lang-head")}</span>
          <a class="icon-btn hide-sm" href="catalog.html#search" aria-label="${t("nav.search")}">${I.search}</a>
          <a class="icon-btn account-btn" href="account.html" aria-label="${t("nav.account")}">${I.user}<span class="account-name">${user ? esc(user.name.split(" ")[0]) : t("nav.login")}</span></a>
          <a class="icon-btn" href="catalog.html#wishlist.1" aria-label="${t("nav.wishlist")}">${I.heart}<span class="badge" id="wish-count"></span></a>
          <button class="icon-btn" data-open="cart" aria-label="${t("nav.bag")}">${I.bag}<span class="badge" id="cart-count"></span></button>
        </div>
      </div>
    </header>`;

    // Amazon-style side menu: the whole catalogue as a list, plus account, language and help
    const link = (href, label, extra = "") => `<a class="menu-link" href="${href}" ${extra}><span>${label}</span><i aria-hidden="true">›</i></a>`;
    document.body.insertAdjacentHTML("beforeend", `
    <aside class="mobile-nav side-menu" id="mobile-nav" aria-label="${t("nav.menu")}">
      <div class="menu-hello">
        <a href="account.html">${I.user}<b>${user ? esc(t("nav.hello", { name: user.name.split(" ")[0] })) : t("nav.helloGuest")}</b></a>
        <button class="close" data-close aria-label="${t("nav.close")}">&times;</button>
      </div>
      <div class="menu-body">
        <form action="catalog.html" class="search-pill" id="m-search">${I.search}<input type="search" name="q" placeholder="${esc(t("nav.searchPlaceholder"))}" aria-label="${t("nav.search")}"></form>
        <h4>${t("nav.shopByCategory")}</h4>
        ${["women", "men"].map(g => `<h5>${g === "men" ? t("nav.men") : t("nav.women")}</h5>
          ${link(`catalog.html#gender.${g}`, t("nav.viewAll"))}
          ${S.categories[g].map(c => link(`catalog.html#gender.${g}~category.${c.key}`, catName(c.key))).join("")}`).join("")}
        <h4>${t("nav.occasions")}</h4>
        ${S.occasions.map(o => link(`catalog.html#occasion.${o.key}`, occName(o.key))).join("")}
        <h4>${t("nav.collections")}</h4>
        ${S.collections.map(c => link(`catalog.html#collection.${c.key}`, `${c.name} <small>${t("coll." + c.key)}</small>`)).join("")}
        <h4>${t("nav.account")}</h4>
        ${link("account.html#orders", t("nav.orders"))}
        ${link("catalog.html#wishlist.1", t("nav.wishlist"))}
        ${user && user.isOwner ? link("admin.html", t("nav.admin")) : ""}
        ${user ? link("#", t("nav.logout"), "data-logout") : link("account.html", t("nav.login"))}
        <h4>${t("nav.language")}</h4>
        <div class="menu-langs">${S.languages.map(l => `<button data-lang="${l.code}" class="${l.code === S.lang ? "on" : ""}">${l.name}</button>`).join("")}</div>
        <h4>${t("nav.help")}</h4>
        ${link("index.html#advisor", t("nav.advisor"))}
        ${link("#", t("nav.consult"), 'data-open="appointment"')}
        ${link(`https://wa.me/${S.config.whatsapp}`, t("foot.whatsapp"), 'target="_blank" rel="noopener"')}
      </div>
    </aside>
    <a class="wa-float" href="https://wa.me/${S.config.whatsapp}?text=${encodeURIComponent("Namaste SANSKAAR, I'd like some help choosing an outfit.")}" target="_blank" rel="noopener" aria-label="${t("foot.whatsapp")}">${I.whatsapp}</a>`);

    $$("[data-lang-select]").forEach(s => s.onchange = () => S.setLang(s.value));
    $$("[data-lang]").forEach(b => b.onclick = () => S.setLang(b.dataset.lang));
    $$("[data-logout]").forEach(a => a.onclick = e => { e.preventDefault(); S.logout(); location.href = "index.html"; });

    const h = $("#header");
    const onScroll = () => h.classList.toggle("scrolled", window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }

  /* ---------- Footer ---------- */
  function footer() {
    const el = $("#site-footer");
    if (!el) return;
    const cf = S.config;
    el.outerHTML = `
    <section class="container trust" aria-label="SANSKAAR">
      <div>${I.truck}<p><b>${t("foot.trust1")}</b><span>${t("foot.trust1Text")}</span></p></div>
      <div>${I.scissors}<p><b>${t("foot.trust2")}</b><span>${t("foot.trust2Text")}</span></p></div>
      <div>${I.hand}<p><b>${t("foot.trust3")}</b><span>${t("foot.trust3Text")}</span></p></div>
      <div>${I.shield}<p><b>${t("foot.trust4")}</b><span>${t("foot.trust4Text")}</span></p></div>
    </section>
    <footer class="site-footer">
      <div class="container footer-grid">
        <div>
          <div class="logo"><span class="logo-mark">SANSKAAR</span><span class="logo-sub">Indian Wedding Couture</span></div>
          <p style="margin-top:22px;max-width:340px">${t("foot.about")}</p>
          <form class="newsletter-inline" id="newsletter"><input type="email" required placeholder="${esc(t("foot.newsletter"))}" aria-label="${t("co.email")}"><button>${t("foot.join")}</button></form>
          <div class="socials">
            <a href="${cf.instagram}" aria-label="Instagram">${I.instagram}</a><a href="${cf.facebook}" aria-label="Facebook">${I.facebook}</a>
            <a href="${cf.youtube}" aria-label="YouTube">${I.youtube}</a><a href="${cf.pinterest}" aria-label="Pinterest">${I.pinterest}</a>
          </div>
          <div style="margin-top:20px">${langPicker("lang-foot")}</div>
        </div>
        <div><h4>${t("nav.women")}</h4><ul>${S.categories.women.map(c => `<li><a href="catalog.html#gender.women~category.${c.key}">${catName(c.key)}</a></li>`).join("")}</ul></div>
        <div><h4>${t("nav.men")}</h4><ul>${S.categories.men.map(c => `<li><a href="catalog.html#gender.men~category.${c.key}">${catName(c.key)}</a></li>`).join("")}</ul></div>
        <div><h4>${t("foot.care")}</h4><ul>
          <li><a href="account.html#orders">${t("nav.orders")}</a></li>
          <li><a href="#" data-open="appointment">${t("nav.consult")}</a></li>
          <li><a href="#" data-open="sizeguide">${t("p.sizeGuide")}</a></li>
          <li><a href="index.html#advisor">${t("nav.advisor")}</a></li>
        </ul></div>
        <div><h4>${t("foot.visit")}</h4><ul>
          <li>${cf.address}</li>
          <li><a href="tel:${cf.phone.replace(/\s/g, "")}">${cf.phone}</a></li>
          <li><a href="mailto:${cf.email}">${cf.email}</a></li>
          <li><a href="https://wa.me/${cf.whatsapp}" target="_blank" rel="noopener">${t("foot.whatsapp")}</a></li>
        </ul></div>
      </div>
      <div class="container footer-bottom">
        <span>© ${new Date().getFullYear()} SANSKAAR. ${t("foot.rights")}</span>
        <span>${t("foot.made")} · <a href="admin.html">Owner admin</a></span>
      </div>
    </footer>`;
    $$("[data-lang-select]").forEach(s => s.onchange = () => S.setLang(s.value));
  }
  /* ---------- Overlays: cart, appointment, size guide ---------- */
  function overlays() {
    const opt = (v, key) => `<option value="${v}">${t(key)}</option>`;
    const table = (head, rows) => `<table><tr>${head.map(h => `<th>${t(h)}</th>`).join("")}</tr>
      ${rows.map(r => `<tr>${r.map(v => `<td>${v}</td>`).join("")}</tr>`).join("")}</table>`;
    document.body.insertAdjacentHTML("beforeend", `
    <div class="overlay" id="overlay"></div>
    <aside class="drawer" id="cart" aria-label="${t("bag.title")}">
      <div class="drawer-head"><h3>${t("bag.title")}</h3><button class="close" data-close aria-label="${t("nav.close")}">&times;</button></div>
      <div class="drawer-body" id="cart-body"></div>
      <div class="drawer-foot" id="cart-foot"></div>
    </aside>
    <div class="modal" id="appointment" role="dialog" aria-modal="true" aria-labelledby="appt-title">
      <div class="modal-card">
        <button class="close" data-close aria-label="${t("nav.close")}">&times;</button>
        ${ornament}
        <span class="eyebrow">${t("appt.eyebrow")}</span>
        <h3 id="appt-title">${rich("appt.title")}</h3>
        <p class="intro">${t("appt.intro")}</p>
        <form id="appt-form" class="form-grid">
          <div class="field"><label>${t("appt.name")}</label><input name="name" required></div>
          <div class="field"><label>${t("appt.phone")}</label><input name="phone" type="tel" required></div>
          <div class="field"><label>${t("appt.for")}</label><select name="for">${opt("Groom", "appt.forGroom")}${opt("Bride", "appt.forBride")}${opt("Family", "appt.forFamily")}${opt("Festive", "appt.forFestive")}</select></div>
          <div class="field"><label>${t("appt.mode")}</label><select name="mode">${opt("In-store (Jaipur)", "appt.inStore")}${opt("Video call", "appt.video")}</select></div>
          <div class="field"><label>${t("appt.date")}</label><input name="date" type="date"></div>
          <div class="field"><label>${t("appt.wedding")}</label><input name="wedding" type="date"></div>
          <div class="field full"><label>${t("appt.notes")}</label><textarea name="notes" rows="3"></textarea></div>
          <div class="full"><button class="btn btn-gold btn-block">${t("appt.send")}</button></div>
        </form>
      </div>
    </div>
    <div class="modal" id="sizeguide" role="dialog" aria-modal="true" aria-labelledby="sg-title">
      <div class="modal-card" style="width:min(680px,100%)">
        <button class="close" data-close aria-label="${t("nav.close")}">&times;</button>
        <h3 id="sg-title">${t("sg.title")}</h3>
        <p class="intro">${t("sg.intro")}</p>
        <h4>${t("sg.groom")}</h4>
        ${table(["sg.size", "sg.chest", "sg.waist", "sg.shoulder"], [["36", 36, 30, 16.5], ["38", 38, 32, 17], ["40", 40, 34, 17.5], ["42", 42, 36, 18], ["44", 44, 38, 18.5], ["46", 46, 40, 19]])}
        <h4>${t("sg.bride")}</h4>
        ${table(["sg.size", "sg.bust", "sg.waist", "sg.hip"], [["XS", 32, 26, 35], ["S", 34, 28, 37], ["M", 36, 30, 39], ["L", 38, 32, 41], ["XL", 40, 34, 43], ["XXL", 42, 36, 45]])}
      </div>
    </div>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>`);

    document.addEventListener("click", e => {
      const opener = e.target.closest("[data-open]");
      if (opener) { e.preventDefault(); open(opener.dataset.open); return; }
      if (e.target.closest("[data-close]") || e.target.id === "overlay" || e.target.classList.contains("modal")) closeAll();
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeAll(); });

    $("#appt-form").addEventListener("submit", e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const msg = `Namaste SANSKAAR! I'd like to book a consultation.\nName: ${f.name}\nPhone: ${f.phone}\nShopping for: ${f.for}\nMode: ${f.mode}\nPreferred date: ${f.date || "-"}\nWedding date: ${f.wedding || "-"}\nNotes: ${f.notes || "-"}`;
      window.open(`https://wa.me/${S.config.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
      closeAll(); e.target.reset();
    });
    document.addEventListener("submit", e => {
      if (e.target.id === "m-search") {
        e.preventDefault();
        try { sessionStorage.setItem("sk_q", e.target.q.value); } catch (err) { /* ignore */ }
        location.href = "catalog.html#search"; if (document.body.dataset.page === "catalog") location.reload();
        return;
      }
      if (e.target.id === "newsletter") { e.preventDefault(); toast(t("foot.thanks")); e.target.reset(); }
    });
  }
  function open(id) {
    closeAll();
    const el = document.getElementById(id);
    if (!el) return;
    if (id === "cart") renderCart();
    el.classList.add("open");
    if (!el.classList.contains("modal")) $("#overlay").classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeAll() {
    $$(".drawer.open, .modal.open, .mobile-nav.open, .filters.open, .overlay.open").forEach(x => x.classList.remove("open"));
    document.body.style.overflow = "";
  }
  S.open = open; S.closeAll = closeAll;

  let toastTimer;
  function toast(msg) {
    const t = $("#toast"); if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }
  S.toast = toast;

  /* ---------- Cart & wishlist ---------- */
  const cart = {
    items: () => store.get("sk_cart", []),
    save(items) { store.set("sk_cart", items); updateCounts(); },
    add(id, size, qty = 1) {
      const items = cart.items();
      const hit = items.find(i => i.id === id && i.size === size);
      hit ? hit.qty += qty : items.push({ id, size, qty });
      cart.save(items);
    },
    setQty(idx, qty) { const items = cart.items(); if (qty < 1) items.splice(idx, 1); else items[idx].qty = qty; cart.save(items); },
    total: () => cart.items().reduce((s, i) => s + (byId(i.id)?.price || 0) * i.qty, 0),
    count: () => cart.items().reduce((s, i) => s + i.qty, 0)
  };
  const wish = {
    ids: () => store.get("sk_wish", []),
    has: id => wish.ids().includes(id),
    toggle(id) {
      const ids = wish.ids(), i = ids.indexOf(id);
      i > -1 ? ids.splice(i, 1) : ids.push(id);
      store.set("sk_wish", ids); updateCounts();
      return i === -1;
    }
  };
  S.cart = cart; S.wish = wish;

  function updateCounts() {
    const c = $("#cart-count"), w = $("#wish-count");
    if (c) { c.textContent = cart.count() || ""; c.dataset.count = cart.count(); }
    if (w) { w.textContent = wish.ids().length || ""; w.dataset.count = wish.ids().length; }
  }

  function renderCart() {
    const body = $("#cart-body"), foot = $("#cart-foot");
    const items = cart.items();
    if (!items.length) {
      body.innerHTML = `<div class="empty" style="padding:60px 0">${ornament}<h3>${t("bag.empty")}</h3><p>${t("bag.emptyText")}</p><a class="btn btn-ghost-gold" href="catalog.html">${t("bag.explore")}</a></div>`;
      foot.innerHTML = ""; return;
    }
    body.innerHTML = items.map((it, idx) => {
      const p = byId(it.id); if (!p) return "";
      return `<div class="cart-item">
        <a class="thumb" href="product.html#id.${p.id}">${media(p, "front")}</a>
        <div><h4>${p.name}</h4><small>${t("bag.size", { size: it.size === "Custom" ? t("p.madeToMeasure") : it.size })} · ${p.colorName}</small><span class="price">${inr(p.price)}</span>
          <div class="qty"><button data-q="${idx}" data-d="-1" aria-label="−">−</button><span>${it.qty}</span><button data-q="${idx}" data-d="1" aria-label="+">+</button></div></div>
        <button class="rm" data-rm="${idx}">${t("bag.remove")}</button>
      </div>`;
    }).join("");
    const total = cart.total();
    const left = S.config.freeShippingAbove - total;
    foot.innerHTML = `
      <p style="font-size:12px;color:var(--text-3);margin-bottom:14px;letter-spacing:.04em">${left > 0 ? t("bag.freeShipLeft", { amount: inr(left) }) : "✦ " + t("bag.freeShip")}</p>
      <div class="row"><span>${t("bag.subtotal")}</span><b>${inr(total)}</b></div>
      <a class="btn btn-gold btn-block" href="checkout.html">${t("bag.checkout")}</a>
      <p style="font-size:11.5px;color:var(--text-3);text-align:center;margin:12px 0 0">${t("bag.methods")}</p>`;
    body.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { const it = cart.items()[b.dataset.q]; cart.setQty(+b.dataset.q, it.qty + +b.dataset.d); renderCart(); });
    body.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { cart.setQty(+b.dataset.rm, 0); renderCart(); });
  }
  /* ---------- Media: real photo if present, otherwise illustrated preview ----------
     Drop a photo at images/products/<SKU>/<view>.jpg and it is picked up
     automatically; until then the illustrated preview underneath shows. */
  const esc = s => S.esc(s);
  function photoLayer(src, alt, eager) {
    return `<img src="${src}" alt="${esc(alt)}" ${eager ? "" : 'loading="lazy"'} onerror="this.remove()">`;
  }
  function media(p, view = "front", eager) {
    // products with a `photos` list use only those shots; others probe the folder
    if (p.photos) {
      const shot = p.photos.includes(view) ? view : p.photos[0];
      return `<div class="ph">${photoLayer(`images/products/${p.id}/${shot}.jpg`, `${p.name} — ${view} view`, eager)}</div>`;
    }
    const src = `images/products/${p.id}/${view}.jpg`;
    return `<div class="ph">${Art.garment(p, view)}${photoLayer(src, `${p.name} — ${view} view`, eager)}</div>`;
  }
  // site imagery (hero, banners, collections) with an illustrated fallback
  function sitePhoto(src, alt, fallbackSvg, eager) {
    return `<div class="ph">${fallbackSvg}${photoLayer(src, alt, eager)}</div>`;
  }
  S.media = media;

  /* ---------- Product card ---------- */
  const quickSize = p => p.sizes[Math.min(2, p.sizes.length - 1)];
  const soldOut = p => p.inStock === false;
  function card(p) {
    const off = p.mrp ? Math.round((1 - p.price / p.mrp) * 100) : 0;
    const tag = soldOut(p) ? `<span class="tag tag-out">${t("tag.soldOut")}</span>` : p.tag === "new" ? `<span class="tag">${t("tag.new")}</span>` : p.tag === "bestseller" ? `<span class="tag">${t("tag.bestseller")}</span>` : `<span class="tag">${catName(p.category)}</span>`;
    return `<article class="product-card reveal${soldOut(p) ? " is-out" : ""}">
      <a href="product.html#id.${p.id}" class="media" aria-label="${esc(p.name)}">
        ${tag}
        <div class="v main">${media(p, "front")}</div>
        <div class="v alt">${media(p, p.photos ? (p.photos[1] || p.photos[0]) : "back")}</div>
        ${soldOut(p) ? "" : `<span class="quick" data-quick="${p.id}">+ ${t("nav.bag")} · ${quickSize(p)}</span>`}
      </a>
      <button class="wish ${wish.has(p.id) ? "on" : ""}" data-wish="${p.id}" aria-label="${t("p.wishlist")}">${I.heart}</button>
      <div class="info">
        <h3><a href="product.html#id.${p.id}">${p.name}</a></h3>
        <div class="meta">${p.fabric} · ${p.work}</div>
        <div class="price">${inr(p.price)}${p.mrp ? `<s>${inr(p.mrp)}</s><span class="off">${t("p.off", { n: off })}</span>` : ""}</div>
      </div>
    </article>`;
  }
  S.card = card;

  function bindCards(root = document) {
    root.addEventListener("click", e => {
      const w = e.target.closest("[data-wish]");
      if (w) {
        e.preventDefault();
        const on = wish.toggle(w.dataset.wish);
        w.classList.toggle("on", on);
        toast(on ? t("p.wishAdded") : t("p.wishRemoved"));
        return;
      }
      const q = e.target.closest("[data-quick]");
      if (q) {
        e.preventDefault();
        const p = byId(q.dataset.quick);
        cart.add(p.id, quickSize(p));
        toast(t("p.added", { name: p.name }));
      }
    });
  }
  /* ---------- Reveal on scroll ---------- */
  function reveal() {
    const els = $$(".reveal:not(.in):not(.pre)");
    if (!("IntersectionObserver" in window)) { els.forEach(x => x.classList.add("in")); return; }
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { rootMargin: "0px 0px -40px 0px" });
    els.forEach(x => {
      if (x.getBoundingClientRect().top < innerHeight) x.classList.add("in");   // visible at rest
      else { x.classList.add("pre"); io.observe(x); }
    });
  }
  S.reveal = reveal;

  /* =====================================================================
     HOME
     ===================================================================== */
  function home() {
    // artwork may show products the owner has hidden, so look them up in the full list
    const art = id => S.allProducts.find(p => p.id === id);
    $("#hero-bg").innerHTML = sitePhoto("images/site/hero.jpg", "SANSKAAR wedding wear",
      Art.scene({ colors: ["#3a0d14", "#c8a45c"], w: 1600, h: 900, seed: 5, sunX: .68, sun: "#e0a85a",
        figure: Art.figureGroup(art("SK-M-SHW-002"), 860, 300, 1.45) + Art.figureGroup(art("SK-W-LHG-001"), 1110, 290, 1.5) }), true);

    // bride / groom panels
    $("#duo-bride .art").innerHTML = sitePhoto("images/site/bride.jpg", t("home.brideTitle"),
      Art.scene({ colors: ["#4a0f1c", "#c8a45c"], w: 600, h: 750, seed: 21, sunX: .5, sun: "#e7b07a",
        figure: Art.figureGroup(art("SK-W-LHG-002"), 150, 260, 1.05) }));
    $("#duo-groom .art").innerHTML = sitePhoto("images/site/groom.jpg", t("home.groomTitle"),
      Art.scene({ colors: ["#1d1a2e", "#c8a45c"], w: 600, h: 750, seed: 4, sunX: .5, sun: "#d9b06a",
        figure: Art.figureGroup(art("SK-M-SHW-001"), 150, 260, 1.05) }));

    // bestsellers & new arrivals with tabs + search
    const tabs = [["all", t("home.tabAll")], ...["lehenga", "saree", "sharara", "anarkali", "sherwani", "bandhgala", "indowestern"].map(k => [k, catName(k)])];
    let active = "all", q = "";
    $("#cc-tabs").innerHTML = tabs.map(([k, l], i) => `<button class="tab ${i ? "" : "active"}" data-k="${k}">${l}</button>`).join("");
    const grid = $("#cc-grid");
    const draw = () => {
      let list = S.products.filter(p => active === "all" || p.category === active);
      if (q) list = list.filter(p => (p.name + " " + p.fabric + " " + p.work + " " + p.colorName + " " + catName(p.category)).toLowerCase().includes(q));
      if (active === "all" && !q) list = list.filter(p => p.tag === "bestseller" || p.tag === "new");
      list = list.slice(0, 8);
      grid.innerHTML = list.length ? list.map(card).join("") : `<div class="empty"><h3>${t("shop.noMatch")}</h3><p>${t("shop.noMatchText")} <a href="catalog.html" style="color:var(--gold-2)">${t("home.viewFull")}</a></p></div>`;
      reveal();
    };
    $$("#cc-tabs .tab").forEach(tb => tb.onclick = () => {
      active = tb.dataset.k; $$("#cc-tabs .tab").forEach(x => x.classList.toggle("active", x === tb)); draw();
    });
    $("#cc-search").addEventListener("input", e => { q = e.target.value.trim().toLowerCase(); draw(); });
    bindCards(grid);
    draw();

    advisor();
    $("#cta-wa").href = `https://wa.me/${S.config.whatsapp}?text=${encodeURIComponent("Namaste SANSKAAR, I would like to book a consultation.")}`;

    // collections
    $("#coll-row").innerHTML = S.collections.map((c, i) => {
      const p = S.allProducts.find(x => x.collection === c.key && x.gender === (i % 2 ? "men" : "women"));
      return `<a class="coll-card reveal" href="catalog.html#collection.${c.key}">
        <div class="art">${sitePhoto(`images/collections/${c.key}.jpg`, `${c.name}`,
          Art.scene({ colors: [Art.shade(c.colors[0], -.45), c.colors[1]], w: 300, h: 465, seed: i * 7 + 3, sunX: .5,
            figure: p ? Art.figureGroup(p, 30, 120, .8) : "" }))}</div>
        <div class="txt"><span class="deva">${c.deva}</span><h3>${c.name}</h3><small>${t("coll." + c.key)}</small></div></a>`;
    }).join("");

    reveal();
  }

  /* ---------- Style advisor (3-step quiz → recommendations) ---------- */
  function advisor() {
    const root = $("#advisor-card"); if (!root) return;
    const palettes = {
      classic: ["red", "maroon", "wine"],
      pastel: ["blush", "mint", "lilac", "peach", "ivory", "beige"],
      jewel: ["green", "teal", "blue", "navy", "black"],
      sunshine: ["yellow", "orange", "gold", "pink"]
    };
    const steps = [
      { key: "who", q: "adv.q1", opts: ["women", "men", "any", "festive"].map(k => [k, t(`adv.who.${k}`), t(`adv.who.${k}Hint`)]) },
      { key: "occ", q: "adv.q2", opts: ["wedding", "reception", "sangeet", "mehendi"].map(k => [k, t(`adv.occ.${k}`), t(`adv.occ.${k}Hint`)]) },
      { key: "pal", q: "adv.q3", opts: Object.entries(palettes).map(([k, cols]) => [k, t(`adv.pal.${k}`), t(`adv.pal.${k}Hint`), cols]) }
    ];
    const ans = {};
    let i = 0;
    function render() {
      if (i >= steps.length) return result();
      const st = steps[i];
      root.innerHTML = `<div class="progress"><i style="width:${(i + 1) / steps.length * 100}%"></i></div>
        <div class="advisor-step active">
          <span class="q-num">${t("adv.q", { i: i + 1, n: steps.length })}</span>
          <h3>${t(st.q)}</h3>
          <div class="advisor-opts">${st.opts.map(([k, l, h, cols]) => `<button class="advisor-opt" data-v="${k}"><b>${l}</b><span>${h}</span>${cols ? `<div class="sw">${cols.slice(0, 4).map(c => `<i style="background:${S.colors[c].hex}"></i>`).join("")}</div>` : ""}</button>`).join("")}</div>
          ${i ? `<button class="advisor-back">${t("adv.back")}</button>` : ""}
        </div>`;
      $$(".advisor-opt", root).forEach(b => b.onclick = () => { ans[st.key] = b.dataset.v; i++; render(); });
      const back = $(".advisor-back", root); if (back) back.onclick = () => { i--; render(); };
    }
    function result() {
      const pal = palettes[ans.pal];
      const occ = ans.who === "festive" ? ["festive", ans.occ] : ans.occ === "mehendi" ? ["mehendi", "haldi"] : [ans.occ];
      const scored = S.products
        .filter(p => ans.who === "women" || ans.who === "men" ? p.gender === ans.who : true)
        .map(p => ({ p, s: (p.occasions.some(o => occ.includes(o)) ? 3 : 0) + (pal.includes(p.color) ? 2 : 0) + (p.tag === "bestseller" ? .5 : 0) + (p.inStock === false ? -10 : 0) }))
        .sort((a, b) => b.s - a.s).slice(0, 3).map(x => x.p);
      root.innerHTML = `<div class="advisor-result advisor-step active">
        <span class="q-num">${t("adv.eyebrow")}</span>
        <h3>${t("adv.result")}</h3>
        <div class="product-grid">${scored.map(card).join("")}</div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:36px">
          <a href="#" data-open="appointment" class="btn btn-gold">${t("adv.book")}</a>
          <button class="btn btn-outline" id="advisor-restart">${t("adv.restart")}</button>
        </div></div>`;
      $("#advisor-restart").onclick = () => { i = 0; render(); };
      bindCards(root.querySelector(".product-grid"));
      reveal();
    }
    render();
  }
  /* =====================================================================
     CATALOGUE
     ===================================================================== */
  function catalog() {
    const params = pageParams();
    const state = {
      gender: params.getAll("gender"),
      category: params.getAll("category"),
      occasion: params.getAll("occasion"),
      collection: params.getAll("collection"),
      color: params.getAll("color"),
      tag: params.get("tag") || "",
      q: (params.get("q") || (() => { try { const v = sessionStorage.getItem("sk_q") || ""; sessionStorage.removeItem("sk_q"); return v; } catch (e) { return ""; } })()).trim(),
      wishlist: params.get("wishlist") === "1",
      max: +params.get("max") || 0,
      sort: params.get("sort") || "featured"
    };
    const maxPrice = Math.max(...S.products.map(p => p.price));
    const priceCeil = Math.ceil(maxPrice / 10000) * 10000;
    if (!state.max) state.max = priceCeil;

    // title
    let title = t("shop.title"), sub = t("shop.sub");
    if (state.wishlist) { title = t("wl.title"); sub = t("wl.emptyText"); }
    else if (state.q) { title = t("shop.results", { q: state.q }); sub = ""; }
    else if (state.category.length === 1) { title = catName(state.category[0]); }
    else if (state.collection.length === 1) { const c = collOf(state.collection[0]); title = `${c.name} Collection`; sub = c.hint; }
    else if (state.occasion.length === 1) { title = occName(state.occasion[0]); sub = ""; }
    else if (state.tag === "new") title = t("shop.newArrivals");
    else if (state.tag === "bestseller") title = t("shop.bestsellers");
    else if (state.gender.length === 1) { const m = state.gender[0] === "men"; title = m ? t("shop.menTitle") : t("shop.womenTitle"); sub = m ? t("home.groomText") : t("home.brideText"); }
    $("#cat-title").textContent = title;
    $("#cat-sub").textContent = sub;
    document.title = `${title} · SANSKAAR`;

    const groups = [
      { key: "gender", label: t("shop.all"), opts: [["men", t("nav.men")], ["women", t("nav.women")]] },
      { key: "category", label: t("nav.shopByCategory"), opts: [...S.categories.men, ...S.categories.women].map(c => [c.key, catName(c.key)]) },
      { key: "occasion", label: t("shop.occasion"), opts: S.occasions.map(o => [o.key, occName(o.key)]) },
      { key: "collection", label: t("shop.collection"), opts: S.collections.map(c => [c.key, c.name]) }
    ];

    function matches(p, skip) {
      if (state.wishlist && !wish.has(p.id)) return false;
      if (skip !== "gender" && state.gender.length && !state.gender.includes(p.gender)) return false;
      if (skip !== "category" && state.category.length && !state.category.includes(p.category)) return false;
      if (skip !== "occasion" && state.occasion.length && !p.occasions.some(o => state.occasion.includes(o))) return false;
      if (skip !== "collection" && state.collection.length && !state.collection.includes(p.collection)) return false;
      if (skip !== "color" && state.color.length && !state.color.includes(p.color)) return false;
      if (state.tag && p.tag !== state.tag) return false;
      if (p.price > state.max) return false;
      if (state.q) {
        const hay = [p.name, p.id, catName(p.category), p.colorName, p.fabric, p.work, collOf(p.collection)?.name, p.gender, ...p.occasions, p.description].join(" ").toLowerCase();
        if (!state.q.toLowerCase().split(/\s+/).every(w => hay.includes(w))) return false;
      }
      return true;
    }

    function drawFilters() {
      const usedColors = [...new Set(S.products.map(p => p.color))];
      $("#filters-body").innerHTML = groups.map(g => {
        const opts = g.opts.filter(([k]) => g.key !== "category" || !state.gender.length || state.gender.some(gg => S.categories[gg].some(c => c.key === k)));
        return `<details class="filter-group" open><summary>${g.label}</summary><div class="opts">
          ${opts.map(([k, l]) => {
            const n = S.products.filter(p => matches(p, g.key) && (g.key === "occasion" ? p.occasions.includes(k) : p[g.key] === k)).length;
            return `<label class="check"><input type="checkbox" data-g="${g.key}" value="${k}" ${state[g.key].includes(k) ? "checked" : ""}> ${l}<span class="n">${n}</span></label>`;
          }).join("")}
        </div></details>`;
      }).join("") + `
        <details class="filter-group" open><summary>${t("shop.colour")}</summary><div class="opts color-opts">
          ${usedColors.map(k => `<label class="color-opt" style="background:${S.colors[k].hex}" title="${S.colors[k].name}"><input type="checkbox" data-g="color" value="${k}" ${state.color.includes(k) ? "checked" : ""} aria-label="${S.colors[k].name}"></label>`).join("")}
        </div></details>
        <details class="filter-group price-range" open><summary>${t("shop.priceUpTo")}</summary><div class="opts">
          <input type="range" id="price-max" min="5000" max="${priceCeil}" step="1000" value="${state.max}" aria-label="Maximum price">
          <div class="vals"><span>₹5,000</span><span><b id="price-val">${inr(state.max)}</b></span></div>
        </div></details>`;
      $$("#filters-body input[type=checkbox]").forEach(i => i.onchange = () => {
        const arr = state[i.dataset.g]; const at = arr.indexOf(i.value);
        i.checked ? at < 0 && arr.push(i.value) : at > -1 && arr.splice(at, 1);
        update();
      });
      const r = $("#price-max");
      r.oninput = () => { $("#price-val").textContent = inr(r.value); };
      r.onchange = () => { state.max = +r.value; update(); };
    }

    function drawActive() {
      const chips = [];
      ["gender", "category", "occasion", "collection", "color"].forEach(g => state[g].forEach(v => {
        const label = g === "color" ? S.colors[v].name : g === "gender" ? (v === "men" ? t("nav.men") : t("nav.women")) :
          g === "category" ? catName(v) : g === "occasion" ? occName(v) : collOf(v).name;
        chips.push(`<button data-rmg="${g}" data-v="${v}">${label}</button>`);
      }));
      if (state.tag) chips.push(`<button data-rmg="tag">${state.tag === "new" ? t("shop.newArrivals") : t("shop.bestsellers")}</button>`);
      if (state.q) chips.push(`<button data-rmg="q">“${state.q}”</button>`);
      if (state.max < priceCeil) chips.push(`<button data-rmg="max">≤ ${inr(state.max)}</button>`);
      $("#active-filters").innerHTML = chips.join("");
      $$("#active-filters button").forEach(b => b.onclick = () => {
        const g = b.dataset.rmg;
        if (g === "tag" || g === "q") { state[g] = ""; if (g === "q" && $("#search-input")) $("#search-input").value = ""; }
        else if (g === "max") state.max = priceCeil;
        else state[g].splice(state[g].indexOf(b.dataset.v), 1);
        update();
      });
    }

    function sortList(list) {
      const s = state.sort;
      if (s === "price-asc") return list.sort((a, b) => a.price - b.price);
      if (s === "price-desc") return list.sort((a, b) => b.price - a.price);
      if (s === "new") return list.sort((a, b) => (b.tag === "new") - (a.tag === "new"));
      if (s === "discount") return list.sort((a, b) => ((b.mrp ? 1 - b.price / b.mrp : 0) - (a.mrp ? 1 - a.price / a.mrp : 0)));
      return list.sort((a, b) => (!!b.photos - !!a.photos) || ((b.tag === "bestseller") - (a.tag === "bestseller")));
    }

    function drawGrid() {
      const list = sortList(S.products.filter(p => matches(p)));
      $("#result-count").textContent = list.length === 1 ? t("shop.piece") : t("shop.pieces", { n: list.length });
      $("#catalog-grid").innerHTML = list.length ? list.map(card).join("") :
        `<div class="empty">${ornament}<h3>${state.wishlist ? t("wl.empty") : t("shop.noMatch")}</h3><p>${state.wishlist ? t("wl.emptyText") : t("shop.noMatchText")}</p><a class="btn btn-outline" href="catalog.html">${t("bag.explore")}</a></div>`;
      reveal();
    }

    function syncURL() {
      const t = [];
      ["gender", "category", "occasion", "collection", "color"].forEach(g => state[g].forEach(v => t.push(`${g}.${v}`)));
      if (state.tag) t.push(`tag.${state.tag}`);
      if (state.wishlist) t.push("wishlist.1");
      if (state.max < priceCeil) t.push(`max.${state.max}`);
      if (state.sort !== "featured") t.push(`sort.${state.sort}`);
      try { history.replaceState(null, "", "catalog.html" + (t.length ? "#" + t.join("~") : "")); } catch (e) { /* sandboxed frame */ }
    }

    function update() { drawFilters(); drawActive(); drawGrid(); syncURL(); }

    const si = $("#search-input");
    if (si) {
      si.value = state.q;
      let t; si.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { state.q = si.value.trim(); update(); }, 200); });
      if (location.hash === "#search") si.focus();
    }
    const sortLabels = { featured: "sort.featured", new: "sort.new", "price-asc": "sort.low", "price-desc": "sort.high", discount: "shop.highlights" };
    $$("#sort option").forEach(o => { o.textContent = t(sortLabels[o.value]); });
    $("#sort").value = state.sort;
    $("#sort").onchange = e => { state.sort = e.target.value; update(); };
    $("#clear-filters").onclick = () => {
      ["gender", "category", "occasion", "collection", "color"].forEach(g => state[g] = []);
      state.tag = ""; state.q = ""; state.max = priceCeil; update();
    };
    $("#filter-toggle").onclick = () => { $("#filters").classList.add("open"); $("#overlay").classList.add("open"); };
    bindCards($("#catalog-grid"));
    update();
  }

  /* =====================================================================
     PRODUCT DETAIL
     ===================================================================== */
  function product() {
    const id = pageParams().get("id");
    const p = byId(id) || S.products[0];
    document.title = `${p.name} · SANSKAAR`;
    const c = collOf(p.collection);
    const off = p.mrp ? Math.round((1 - p.price / p.mrp) * 100) : 0;
    const views = p.photos || ["front", "back", "side", "detail"];
    const viewNames = { front: "Front", back: "Back", side: "Side", detail: "Close-up", flatlay: "Flat lay" };
    const siblings = S.products.filter(x => x.category === p.category && x.id !== p.id);
    const includes = {
      sherwani: "Sherwani, churidar, stole", bandhgala: "Bandhgala jacket, trousers", indowestern: "Indo-western jacket, dhoti trousers",
      kurta: "Kurta, pajama", jacket: "Nehru jacket, kurta, churidar", lehenga: "Lehenga, blouse (unstitched option), dupatta",
      saree: "Saree with unstitched blouse piece", anarkali: "Anarkali, churidar, dupatta", sharara: "Kurti, sharara, dupatta", suit: "Kurta, palazzo, dupatta"
    }[p.category];
    const out = soldOut(p);
    const unit = p.sizeUnit && p.sizeUnit !== "Standard" ? p.sizeUnit : "";

    $("#breadcrumb").innerHTML = `<a href="index.html">${t("nav.home")}</a> / <a href="catalog.html#gender.${p.gender}">${p.gender === "men" ? t("nav.men") : t("nav.women")}</a> / <a href="catalog.html#gender.${p.gender}~category.${p.category}">${catName(p.category)}</a> / <span>${p.name}</span>`;

    $("#pdp").innerHTML = `
      <div class="gallery">
        <div class="thumbs">${views.map((v, i) => `<button class="${i ? "" : "active"}" data-view="${v}" aria-label="${viewNames[v]}">${media(p, v)}<small>${viewNames[v]}</small></button>`).join("")}</div>
        <div class="main-view" id="main-view">${media(p, "front", true)}<span class="view-label" id="view-label">Front</span><span class="ai-note" id="ai-note">Preview · photoshoot coming</span></div>
      </div>
      <div class="pdp-info">
        <div class="coll">${t("p.collection", { name: c.name })} · <span class="deva">${c.deva}</span></div>
        <h1>${p.name}</h1>
        <div class="sku">SKU ${p.id} · ${p.colorName}</div>
        <span class="price">${inr(p.price)}${p.mrp ? `<s>${inr(p.mrp)}</s><span class="off">${t("p.off", { n: off })}</span>` : ""}</span>
        <div class="tax">${t("p.taxes")}</div>
        ${out ? `<div class="stock-note out">${t("p.soldOut")}</div>` : p.lowStock ? `<div class="stock-note">${t("p.onlyLeft", { n: p.lowStock })}</div>` : ""}
        ${!out && p.deliveryDays ? `<div class="delivery-note">${I.truck}<span>${t("p.deliveryBy", { date: S.fmtDate(S.inDays(p.deliveryDays)) })}</span></div>` : ""}
        <p class="desc">${p.description}</p>

        <div class="opt-label"><span>${t("p.colour")}: ${p.colorName}</span></div>
        <div class="color-row">
          ${[p, ...siblings.filter(s => s.color !== p.color).slice(0, 4)].map(s => `<a href="product.html#id.${s.id}" class="${s.id === p.id ? "active" : ""}" style="background:${s.hex}" title="${esc(s.colorName)} — ${esc(s.name)}" aria-label="${esc(s.colorName)}"></a>`).join("")}
        </div>

        <div class="opt-label"><span>${unit ? t("p.sizeUnit", { unit }) : t("p.selectSize")}</span><a href="#" data-open="sizeguide">${t("p.sizeGuide")}</a></div>
        <div class="sizes" id="sizes">${p.sizes.map(s => `<button data-size="${esc(s)}" ${out ? "disabled" : ""}>${esc(s)}</button>`).join("")}<button data-size="Custom" ${out ? "disabled" : ""}>${t("p.madeToMeasure")}</button></div>

        <div class="pdp-actions">
          <button class="btn btn-gold" id="add-cart" ${out ? "disabled" : ""}>${out ? t("p.soldOut") : t("p.addToBag")}</button>
          <button class="btn btn-outline" id="add-wish">${wish.has(p.id) ? "♥ " + t("p.wishlisted") : "♡ " + t("p.wishlist")}</button>
          <a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="https://wa.me/${S.config.whatsapp}?text=${encodeURIComponent(`Namaste! I'm interested in ${p.name} (${p.id}). Could you share more details?`)}">${I.whatsapp.replace("<svg", '<svg width="18" height="18"')} ${t("p.enquire")}</a>
        </div>

        <div class="pdp-perks">
          <div>${I.truck}${t("p.perk1")}</div><div>${I.scissors}${t("p.perk2")}</div><div>${I.shield}${t("p.perk3")}</div>
        </div>

        <div class="accordion">
          <details open><summary>${t("p.details")}</summary><div class="body"><ul>
            <li><b>${t("p.fabric")}:</b> ${p.fabric}</li><li><b>${t("p.work")}:</b> ${p.work}</li><li><b>${t("p.colour")}:</b> ${p.colorName}</li>
            <li><b>${t("p.includes")}:</b> ${includes}</li><li><b>${t("p.occasion")}:</b> ${p.occasions.map(occName).join(", ")}</li>
          </ul></div></details>
          <details><summary>${t("p.sizeFit")}</summary><div class="body">${t("p.sizeFitText")}</div></details>
          <details><summary>${t("p.shipping")}</summary><div class="body">${t("p.shippingText", { amount: inr(S.config.freeShippingAbove) })}</div></details>
          <details><summary>${t("p.care")}</summary><div class="body">${t("p.careText")}</div></details>
        </div>
      </div>`;

    // gallery
    const mv = $("#main-view");
    // hide the "preview" badge once a real photo has loaded for the current view
    const notePhoto = () => {
      const img = mv.querySelector(".ph img"), note = $("#ai-note");
      const upd = () => { note.hidden = !!(img && img.isConnected && img.naturalWidth); };
      if (img && !img.complete) img.addEventListener("load", upd); upd();
    };
    notePhoto();
    $$(".thumbs button").forEach(b => b.onclick = () => {
      $$(".thumbs button").forEach(x => x.classList.toggle("active", x === b));
      mv.querySelector(".ph").outerHTML = media(p, b.dataset.view, true); notePhoto();
      $("#view-label").textContent = viewNames[b.dataset.view];
    });
    mv.addEventListener("mousemove", e => {
      const r = mv.getBoundingClientRect();
      mv.style.setProperty("--zx", ((e.clientX - r.left) / r.width * 100) + "%");
      mv.style.setProperty("--zy", ((e.clientY - r.top) / r.height * 100) + "%");
    });
    mv.addEventListener("click", () => mv.classList.toggle("zoom"));
    mv.addEventListener("mouseleave", () => mv.classList.remove("zoom"));

    let size = null;
    $$("#sizes button").forEach(b => b.onclick = () => {
      size = b.dataset.size; $$("#sizes button").forEach(x => x.classList.toggle("active", x === b));
    });
    $("#add-cart").onclick = () => {
      if (out) return;
      if (!size) { toast(t("p.pleaseSize")); $("#sizes").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
      cart.add(p.id, size); toast(t("p.added", { name: p.name }));
      setTimeout(() => open("cart"), 500);
    };
    $("#add-wish").onclick = e => {
      const on = wish.toggle(p.id);
      e.target.textContent = on ? "♥ " + t("p.wishlisted") : "♡ " + t("p.wishlist");
      toast(on ? t("p.wishAdded") : t("p.wishRemoved"));
    };

    // complete the look: same collection, opposite gender
    const look = S.products.filter(x => x.collection === p.collection && x.gender !== p.gender).slice(0, 4);
    $("#look-grid").innerHTML = look.map(card).join("");
    $("#look-sub").textContent = t("p.forPartner");
    const similar = siblings.slice(0, 4);
    $("#similar-grid").innerHTML = similar.map(card).join("");
    bindCards($("#look-grid")); bindCards($("#similar-grid"));

    // recently viewed
    const rv = store.get("sk_recent", []).filter(x => x !== p.id);
    store.set("sk_recent", [p.id, ...rv].slice(0, 8));
    reveal();
  }

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    await S.loadLive();
    const page = document.body.dataset.page;
    S.applyStatic();
    header(document.body.dataset.nav);
    footer();
    overlays();
    updateCounts();
    if (page === "home") home();
    if (page === "catalog" || page === "product") window.addEventListener("hashchange", () => { if (location.hash !== "#search") location.reload(); });
    if (page === "catalog") catalog();
    if (page === "product") product();
    if (S.pages[page]) await S.pages[page]();
    reveal();
  });
})();