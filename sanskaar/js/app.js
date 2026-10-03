/* ==========================================================================
   SANSKAAR — Site behaviour
   Shared header/footer, cart, wishlist, appointment booking and the
   home / catalogue / product page renderers.
   ========================================================================== */

/* ---------- Business settings: edit these ---------- */
SANSKAAR.config = {
  brand: "SANSKAAR",
  whatsapp: "919999999999",          // country code + number, digits only
  phone: "+91 99999 99999",
  email: "hello@sanskaar.in",
  address: "MI Road, Jaipur, Rajasthan 302001",
  freeShippingAbove: 4999,
  instagram: "#", facebook: "#", youtube: "#", pinterest: "#"
};

(function () {
  const S = SANSKAAR, Art = window.SanskaarArt;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const inr = n => "₹" + Number(n).toLocaleString("en-IN");
  const byId = id => S.products.find(p => p.id === id);
  const catName = key => [...S.categories.men, ...S.categories.women].find(c => c.key === key)?.name || key;
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
    const g = gender === "men" ? "Groom" : "Bride";
    return `<div class="mega"><div class="container mega-inner">
      <div><h4>Shop ${gender === "men" ? "Men" : "Women"}</h4><ul>
        <li><a href="catalog.html?gender=${gender}">View all</a></li>
        ${cats.map(c => `<li><a href="catalog.html?gender=${gender}&category=${c.key}">${c.name}</a></li>`).join("")}
      </ul></div>
      <div><h4>By occasion</h4><ul>
        ${S.occasions.map(o => `<li><a href="catalog.html?gender=${gender}&occasion=${o.key}">${o.name}</a></li>`).join("")}
      </ul></div>
      <div><h4>Collections</h4><ul>
        ${S.collections.map(c => `<li><a href="catalog.html?gender=${gender}&collection=${c.key}">${c.name}</a></li>`).join("")}
      </ul></div>
      <a class="mega-feature" href="catalog.html?gender=${gender}&occasion=wedding">
        <div class="art">${feature ? media(feature, "front") : ""}</div>
        <div class="txt"><span class="eyebrow">The ${g} Edit</span><h3>Wedding ${g === "Groom" ? "Sherwanis" : "Lehengas"}</h3></div>
      </a>
    </div></div>`;
  }

  function header(active) {
    const el = $("#site-header");
    if (!el) return;
    el.outerHTML = `
    <div class="announce">Complimentary shipping across India above ${inr(S.config.freeShippingAbove)} &nbsp;·&nbsp; <a href="#" data-open="appointment">Book a private bridal consultation</a></div>
    <header class="site-header" id="header">
      <div class="container header-row">
        <button class="icon-btn menu-toggle" data-open="mobile-nav" aria-label="Open menu">${I.menu}</button>
        <a href="index.html" class="logo" aria-label="Sanskaar home">
          <span class="logo-mark">SANSKAAR</span><span class="logo-sub">Indian Wedding Couture</span>
        </a>
        <nav class="main-nav" aria-label="Main">
          <ul>
            <li><a href="index.html" class="${active === "home" ? "active" : ""}">Home</a></li>
            <li><a href="catalog.html?gender=women" class="${active === "women" ? "active" : ""}">Bride</a>${megaMenu("women")}</li>
            <li><a href="catalog.html?gender=men" class="${active === "men" ? "active" : ""}">Groom</a>${megaMenu("men")}</li>
            <li><a href="index.html#advisor">Style Advisor</a></li>
            <li><a href="catalog.html" class="${active === "catalog" ? "active" : ""}">Couture Catalog</a></li>
            <li><a href="index.html#atelier">The Atelier</a></li>
          </ul>
        </nav>
        <div class="header-right">
          <a class="icon-btn hide-sm" href="catalog.html#search" aria-label="Search">${I.search}</a>
          <a class="icon-btn" href="catalog.html?wishlist=1" aria-label="Wishlist">${I.heart}<span class="badge" id="wish-count"></span></a>
          <button class="icon-btn" data-open="cart" aria-label="Shopping bag">${I.bag}<span class="badge" id="cart-count"></span></button>
          <a href="#" data-open="appointment" class="btn btn-ghost-gold header-cta">Book Consultation</a>
        </div>
      </div>
    </header>`;

    document.body.insertAdjacentHTML("beforeend", `
    <aside class="mobile-nav" id="mobile-nav" aria-label="Menu">
      <div class="drawer-head" style="padding:0 0 18px;border:0"><span class="logo-mark" style="font-size:24px">SANSKAAR</span><button class="close" data-close aria-label="Close menu">&times;</button></div>
      <form action="catalog.html" class="search-pill">${I.search}<input type="search" name="q" placeholder="Search lehenga, sherwani…" aria-label="Search"></form>
      <a href="index.html">Home</a>
      ${["women", "men"].map(g => `<details><summary>${g === "men" ? "Groom" : "Bride"}</summary><ul>
        <li><a href="catalog.html?gender=${g}">View all</a></li>
        ${S.categories[g].map(c => `<li><a href="catalog.html?gender=${g}&category=${c.key}">${c.name}</a></li>`).join("")}
      </ul></details>`).join("")}
      <details><summary>Occasions</summary><ul>${S.occasions.map(o => `<li><a href="catalog.html?occasion=${o.key}">${o.name}</a></li>`).join("")}</ul></details>
      <details><summary>Collections</summary><ul>${S.collections.map(c => `<li><a href="catalog.html?collection=${c.key}">${c.name}</a></li>`).join("")}</ul></details>
      <a href="index.html#advisor">Style Advisor</a>
      <a href="catalog.html">Couture Catalog</a>
      <a href="catalog.html?wishlist=1">Wishlist</a>
      <a href="#" data-open="appointment" class="btn btn-gold btn-block" style="font-family:var(--sans);font-size:11px;margin-top:24px;border:0">Book Consultation</a>
    </aside>
    <a class="wa-float" href="https://wa.me/${S.config.whatsapp}?text=${encodeURIComponent("Namaste SANSKAAR, I'd like some help choosing an outfit.")}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">${I.whatsapp}</a>`);

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
    <section class="container trust" aria-label="Why shop with us">
      <div>${I.truck}<p><b>Insured shipping</b><span>Pan-India & worldwide</span></p></div>
      <div>${I.scissors}<p><b>Bespoke fittings</b><span>Free alterations, made to measure</span></p></div>
      <div>${I.hand}<p><b>Handcrafted</b><span>By master karigars of Rajasthan</span></p></div>
      <div>${I.shield}<p><b>Authenticity</b><span>Pure handloom & silk-mark fabrics</span></p></div>
    </section>
    <footer class="site-footer">
      <div class="container footer-grid">
        <div>
          <div class="logo"><span class="logo-mark">SANSKAAR</span><span class="logo-sub">Indian Wedding Couture</span></div>
          <p style="margin-top:22px;max-width:340px">Heirloom wedding couture for the bride, the groom and the family, rooted in the ateliers of Jaipur.</p>
          <form class="newsletter-inline" id="newsletter"><input type="email" required placeholder="Your email for private previews" aria-label="Email"><button>Join</button></form>
          <div class="socials">
            <a href="${cf.instagram}" aria-label="Instagram">${I.instagram}</a><a href="${cf.facebook}" aria-label="Facebook">${I.facebook}</a>
            <a href="${cf.youtube}" aria-label="YouTube">${I.youtube}</a><a href="${cf.pinterest}" aria-label="Pinterest">${I.pinterest}</a>
          </div>
        </div>
        <div><h4>Bride</h4><ul>${S.categories.women.map(c => `<li><a href="catalog.html?gender=women&category=${c.key}">${c.name}</a></li>`).join("")}</ul></div>
        <div><h4>Groom</h4><ul>${S.categories.men.map(c => `<li><a href="catalog.html?gender=men&category=${c.key}">${c.name}</a></li>`).join("")}</ul></div>
        <div><h4>Client care</h4><ul>
          <li><a href="#" data-open="appointment">Book consultation</a></li>
          <li><a href="#" data-open="sizeguide">Size guide</a></li>
          <li><a href="index.html#advisor">Style advisor</a></li>
          <li><a href="#">Shipping & exchange</a></li>
        </ul></div>
        <div><h4>Visit the atelier</h4><ul>
          <li>${cf.address}</li>
          <li><a href="tel:${cf.phone.replace(/\s/g, "")}">${cf.phone}</a></li>
          <li><a href="mailto:${cf.email}">${cf.email}</a></li>
          <li><a href="https://wa.me/${cf.whatsapp}" target="_blank" rel="noopener">WhatsApp us</a></li>
        </ul></div>
      </div>
      <div class="container footer-bottom">
        <span>© ${new Date().getFullYear()} SANSKAAR. All rights reserved.</span>
        <span>Crafted in Jaipur, Rajasthan</span>
      </div>
    </footer>`;
  }

  /* ---------- Overlays: cart, appointment, size guide ---------- */
  function overlays() {
    document.body.insertAdjacentHTML("beforeend", `
    <div class="overlay" id="overlay"></div>
    <aside class="drawer" id="cart" aria-label="Shopping bag">
      <div class="drawer-head"><h3>Your Bag</h3><button class="close" data-close aria-label="Close">&times;</button></div>
      <div class="drawer-body" id="cart-body"></div>
      <div class="drawer-foot" id="cart-foot"></div>
    </aside>
    <div class="modal" id="appointment" role="dialog" aria-modal="true" aria-labelledby="appt-title">
      <div class="modal-card">
        <button class="close" data-close aria-label="Close">&times;</button>
        ${ornament}
        <span class="eyebrow">Private consultation</span>
        <h3 id="appt-title">Book your <em>bespoke</em> session</h3>
        <p class="intro">Meet our couturiers at the Jaipur atelier or over a video call. We'll confirm on WhatsApp.</p>
        <form id="appt-form" class="form-grid">
          <div class="field"><label>Name</label><input name="name" required></div>
          <div class="field"><label>Phone</label><input name="phone" type="tel" required></div>
          <div class="field"><label>Shopping for</label><select name="for"><option>Groom</option><option>Bride</option><option>Family</option><option>Festive</option></select></div>
          <div class="field"><label>Mode</label><select name="mode"><option>In-store (Jaipur)</option><option>Video call</option></select></div>
          <div class="field"><label>Preferred date</label><input name="date" type="date"></div>
          <div class="field"><label>Wedding date</label><input name="wedding" type="date"></div>
          <div class="field full"><label>Anything we should know?</label><textarea name="notes" rows="3"></textarea></div>
          <div class="full"><button class="btn btn-gold btn-block">Request consultation</button></div>
        </form>
      </div>
    </div>
    <div class="modal" id="sizeguide" role="dialog" aria-modal="true" aria-labelledby="sg-title">
      <div class="modal-card" style="width:min(680px,100%)">
        <button class="close" data-close aria-label="Close">&times;</button>
        <h3 id="sg-title">Size Guide</h3>
        <p class="intro">All measurements in inches. Every outfit can also be made to your measurements.</p>
        <h4>Groom</h4>
        <table>
          <tr><th>Size</th><th>Chest</th><th>Waist</th><th>Shoulder</th></tr>
          ${[["36", 36, 30, 16.5], ["38", 38, 32, 17], ["40", 40, 34, 17.5], ["42", 42, 36, 18], ["44", 44, 38, 18.5], ["46", 46, 40, 19]].map(r => `<tr>${r.map(v => `<td>${v}</td>`).join("")}</tr>`).join("")}
        </table>
        <h4>Bride</h4>
        <table>
          <tr><th>Size</th><th>Bust</th><th>Waist</th><th>Hip</th></tr>
          ${[["XS", 32, 26, 35], ["S", 34, 28, 37], ["M", 36, 30, 39], ["L", 38, 32, 41], ["XL", 40, 34, 43], ["XXL", 42, 36, 45]].map(r => `<tr>${r.map(v => `<td>${v}</td>`).join("")}</tr>`).join("")}
        </table>
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
      const msg = `Namaste Sanskaar! I'd like to book a styling appointment.\nName: ${f.name}\nPhone: ${f.phone}\nShopping for: ${f.for}\nMode: ${f.mode}\nPreferred date: ${f.date || "-"}\nWedding date: ${f.wedding || "-"}\nNotes: ${f.notes || "-"}`;
      window.open(`https://wa.me/${S.config.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
      closeAll(); toast("Opening WhatsApp to confirm your appointment…");
      e.target.reset();
    });
    document.addEventListener("submit", e => {
      if (e.target.id === "newsletter") { e.preventDefault(); toast("Thank you — you're on the list for private previews."); e.target.reset(); }
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
      body.innerHTML = `<div class="empty" style="padding:60px 0">${ornament}<h3>Your bag is empty</h3><p>Let's find something beautiful.</p><a class="btn btn-ghost-gold" href="catalog.html">Explore the catalog</a></div>`;
      foot.innerHTML = ""; return;
    }
    body.innerHTML = items.map((it, idx) => {
      const p = byId(it.id); if (!p) return "";
      return `<div class="cart-item">
        <a class="thumb" href="product.html?id=${p.id}">${media(p, "front")}</a>
        <div><h4>${p.name}</h4><small>Size ${it.size} · ${p.colorName}</small><span class="price">${inr(p.price)}</span>
          <div class="qty"><button data-q="${idx}" data-d="-1" aria-label="Decrease">−</button><span>${it.qty}</span><button data-q="${idx}" data-d="1" aria-label="Increase">+</button></div></div>
        <button class="rm" data-rm="${idx}">Remove</button>
      </div>`;
    }).join("");
    const total = cart.total();
    const left = S.config.freeShippingAbove - total;
    foot.innerHTML = `
      <p style="font-size:12px;color:var(--text-3);margin-bottom:14px;letter-spacing:.04em">${left > 0 ? `Add ${inr(left)} more for free shipping` : "✦ You've unlocked free shipping"}</p>
      <div class="row"><span>Subtotal</span><b>${inr(total)}</b></div>
      <button class="btn btn-gold btn-block" id="checkout">Checkout on WhatsApp</button>
      <p style="font-size:11.5px;color:var(--text-3);text-align:center;margin:12px 0 0">Our team confirms sizing & delivery before payment.</p>`;
    body.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { const it = cart.items()[b.dataset.q]; cart.setQty(+b.dataset.q, it.qty + +b.dataset.d); renderCart(); });
    body.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { cart.setQty(+b.dataset.rm, 0); renderCart(); });
    $("#checkout").onclick = () => {
      const lines = cart.items().map(i => { const p = byId(i.id); return `• ${p.name} (${p.id}) — Size ${i.size} × ${i.qty} — ${inr(p.price * i.qty)}`; });
      const msg = `Namaste Sanskaar! I'd like to place an order:\n${lines.join("\n")}\nTotal: ${inr(cart.total())}`;
      window.open(`https://wa.me/${S.config.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
    };
  }

  /* ---------- Media: real photo if present, otherwise illustrated preview ----------
     Drop a photo at images/products/<SKU>/<view>.jpg and it is picked up
     automatically; until then the illustrated preview underneath shows. */
  const esc = s => String(s).replace(/"/g, "&quot;");
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
  function card(p) {
    const off = p.mrp ? Math.round((1 - p.price / p.mrp) * 100) : 0;
    const tag = p.tag === "new" ? `<span class="tag">New</span>` : p.tag === "bestseller" ? `<span class="tag">Bestseller</span>` : `<span class="tag">${catName(p.category)}</span>`;
    return `<article class="product-card reveal">
      <a href="product.html?id=${p.id}" class="media" aria-label="${esc(p.name)}">
        ${tag}
        <div class="v main">${media(p, "front")}</div>
        <div class="v alt">${media(p, p.photos ? (p.photos[1] || p.photos[0]) : "back")}</div>
        <span class="quick" data-quick="${p.id}">Quick add · Size ${p.sizes[2]}</span>
      </a>
      <button class="wish ${wish.has(p.id) ? "on" : ""}" data-wish="${p.id}" aria-label="Add to wishlist">${I.heart}</button>
      <div class="info">
        <h3><a href="product.html?id=${p.id}">${p.name}</a></h3>
        <div class="meta">${p.fabric} · ${p.work}</div>
        <div class="price">${inr(p.price)}${p.mrp ? `<s>${inr(p.mrp)}</s><span class="off">${off}% off</span>` : ""}</div>
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
        toast(on ? "Added to wishlist" : "Removed from wishlist");
        return;
      }
      const q = e.target.closest("[data-quick]");
      if (q) {
        e.preventDefault();
        const p = byId(q.dataset.quick);
        cart.add(p.id, p.sizes[2]);
        toast(`${p.name} (size ${p.sizes[2]}) added to bag`);
      }
    });
  }

  /* ---------- Reveal on scroll ---------- */
  function reveal() {
    if (!("IntersectionObserver" in window)) { $$(".reveal").forEach(x => x.classList.add("in")); return; }
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { rootMargin: "0px 0px -40px 0px" });
    $$(".reveal:not(.in)").forEach(x => io.observe(x));
  }
  S.reveal = reveal;

  /* =====================================================================
     HOME
     ===================================================================== */
  function home() {
    // hero
    $("#hero-bg").innerHTML = sitePhoto("images/site/hero.jpg", "A Sanskaar bride in a hand-embroidered red lehenga",
      Art.scene({ colors: ["#3a0d14", "#c8a45c"], w: 1600, h: 900, seed: 5, sunX: .68, sun: "#e0a85a",
        figure: Art.figureGroup(byId("SK-M-SHW-002"), 860, 300, 1.45) + Art.figureGroup(byId("SK-W-LHG-001"), 1110, 290, 1.5) }), true);

    // bride / groom panels
    $("#duo-bride .art").innerHTML = sitePhoto("images/site/bride.jpg", "Bridal couture",
      Art.scene({ colors: ["#4a0f1c", "#c8a45c"], w: 600, h: 750, seed: 21, sunX: .5, sun: "#e7b07a",
        figure: Art.figureGroup(byId("SK-W-LHG-002"), 150, 260, 1.05) }));
    $("#duo-groom .art").innerHTML = sitePhoto("images/site/groom.jpg", "Groom couture",
      Art.scene({ colors: ["#1d1a2e", "#c8a45c"], w: 600, h: 750, seed: 4, sunX: .5, sun: "#d9b06a",
        figure: Art.figureGroup(byId("SK-M-SHW-001"), 150, 260, 1.05) }));

    // couture catalog with tabs + search
    const tabs = [["all", "All Collections"], ["lehenga", "Lehengas"], ["saree", "Royal Saris"], ["sharara", "Shararas"], ["anarkali", "Anarkalis"],
      ["sherwani", "Sherwanis"], ["bandhgala", "Bandhgalas"], ["indowestern", "Indo-Western"]];
    let active = "all", q = "";
    $("#cc-tabs").innerHTML = tabs.map(([k, l], i) => `<button class="tab ${i ? "" : "active"}" data-k="${k}">${l}</button>`).join("");
    const grid = $("#cc-grid");
    const draw = () => {
      let list = S.products.filter(p => active === "all" || p.category === active);
      if (q) list = list.filter(p => (p.name + " " + p.fabric + " " + p.work + " " + p.colorName + " " + catName(p.category)).toLowerCase().includes(q));
      if (active === "all" && !q) list = list.filter(p => p.tag === "bestseller" || p.tag === "new");
      list = list.slice(0, 8);
      grid.innerHTML = list.length ? list.map(card).join("") : `<div class="empty"><h3>No match yet</h3><p>Try another word, or <a href="catalog.html" style="color:var(--gold-2)">browse the full catalog</a>.</p></div>`;
      reveal();
    };
    $$("#cc-tabs .tab").forEach(t => t.onclick = () => {
      active = t.dataset.k; $$("#cc-tabs .tab").forEach(x => x.classList.toggle("active", x === t)); draw();
    });
    $("#cc-search").addEventListener("input", e => { q = e.target.value.trim().toLowerCase(); draw(); });
    bindCards(grid);
    draw();

    advisor();
    $("#cta-wa").href = `https://wa.me/${S.config.whatsapp}?text=${encodeURIComponent("Namaste SANSKAAR, I would like to book a consultation.")}`;

    // collections
    $("#coll-row").innerHTML = S.collections.map((c, i) => {
      const p = S.products.find(x => x.collection === c.key && x.gender === (i % 2 ? "men" : "women"));
      return `<a class="coll-card reveal" href="catalog.html?collection=${c.key}">
        <div class="art">${sitePhoto(`images/collections/${c.key}.jpg`, `${c.name} collection`,
          Art.scene({ colors: [Art.shade(c.colors[0], -.45), c.colors[1]], w: 300, h: 465, seed: i * 7 + 3, sunX: .5,
            figure: p ? Art.figureGroup(p, 30, 120, .8) : "" }))}</div>
        <div class="txt"><span class="deva">${c.deva}</span><h3>${c.name}</h3><small>${c.hint}</small></div></a>`;
    }).join("");

    reveal();
  }

  /* ---------- Style advisor (3-step quiz → recommendations) ---------- */
  function advisor() {
    const root = $("#advisor-card"); if (!root) return;
    const palettes = {
      classic: { label: "Classic Reds & Maroons", hint: "Timeless bridal tradition", colors: ["red", "maroon", "wine"] },
      pastel: { label: "Soft Pastels", hint: "Blush, mint, lilac & ivory", colors: ["blush", "mint", "lilac", "peach", "ivory", "beige"] },
      jewel: { label: "Jewel Tones", hint: "Emerald, sapphire & peacock", colors: ["green", "teal", "blue", "navy", "black"] },
      sunshine: { label: "Sunshine & Rani", hint: "Haldi yellow, kesariya & pink", colors: ["yellow", "orange", "gold", "pink"] }
    };
    const steps = [
      { key: "who", q: "Who are we dressing?", opts: [
        ["women", "The Bride", "Lehengas, sarees & trousseau"], ["men", "The Groom", "Sherwanis & bandhgalas"],
        ["any", "The Family", "Parents, siblings & friends"], ["festive", "A Festive Guest", "Diwali, Eid, Teej & more"]] },
      { key: "occ", q: "Select the ceremony or event you are dressing for:", opts: [
        ["wedding", "The Sacred Vows", "Main wedding ceremony / Pheras"], ["reception", "The Grand Soirée", "Reception dinner / Formal after-party"],
        ["sangeet", "The Rhythmic Celebration", "Sangeet night / Cocktail / Dance gala"], ["mehendi", "The Henna Festival", "Mehendi / Haldi / Pre-wedding lunch"]] },
      { key: "pal", q: "Which palette speaks to you?", opts: Object.entries(palettes).map(([k, v]) => [k, v.label, v.hint, v.colors]) }
    ];
    const ans = {};
    let i = 0;
    function render() {
      if (i >= steps.length) return result();
      const st = steps[i];
      root.innerHTML = `<div class="progress"><i style="width:${(i + 1) / steps.length * 100}%"></i></div>
        <div class="advisor-step active">
          <span class="q-num">Question ${i + 1} of ${steps.length}</span>
          <h3>${st.q}</h3>
          <div class="advisor-opts">${st.opts.map(([k, l, h, cols]) => `<button class="advisor-opt" data-v="${k}"><b>${l}</b><span>${h}</span>${cols ? `<div class="sw">${cols.slice(0, 4).map(c => `<i style="background:${S.colors[c].hex}"></i>`).join("")}</div>` : ""}</button>`).join("")}</div>
          ${i ? `<button class="advisor-back">← Back</button>` : ""}
        </div>`;
      $$(".advisor-opt", root).forEach(b => b.onclick = () => { ans[st.key] = b.dataset.v; i++; render(); });
      const back = $(".advisor-back", root); if (back) back.onclick = () => { i--; render(); };
    }
    function result() {
      const pal = palettes[ans.pal].colors;
      const occ = ans.who === "festive" ? ["festive", ans.occ] : ans.occ === "mehendi" ? ["mehendi", "haldi"] : [ans.occ];
      const scored = S.products
        .filter(p => ans.who === "women" || ans.who === "men" ? p.gender === ans.who : true)
        .map(p => ({ p, s: (p.occasions.some(o => occ.includes(o)) ? 3 : 0) + (pal.includes(p.color) ? 2 : 0) + (p.tag === "bestseller" ? .5 : 0) }))
        .sort((a, b) => b.s - a.s).slice(0, 3).map(x => x.p);
      const who = { women: "bride", men: "groom", any: "family", festive: "festive guest" }[ans.who];
      root.innerHTML = `<div class="advisor-result advisor-step active">
        <span class="q-num">Your curated edit</span>
        <h3>Three looks for the ${who}, in ${palettes[ans.pal].label.toLowerCase()}</h3>
        <div class="product-grid">${scored.map(card).join("")}</div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:36px">
          <a href="#" data-open="appointment" class="btn btn-gold">Book a consultation</a>
          <button class="btn btn-outline" id="advisor-restart">Start again</button>
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
    const params = new URLSearchParams(location.search);
    const state = {
      gender: params.getAll("gender"),
      category: params.getAll("category"),
      occasion: params.getAll("occasion"),
      collection: params.getAll("collection"),
      color: params.getAll("color"),
      tag: params.get("tag") || "",
      q: (params.get("q") || "").trim(),
      wishlist: params.get("wishlist") === "1",
      max: +params.get("max") || 0,
      sort: params.get("sort") || "featured"
    };
    const maxPrice = Math.max(...S.products.map(p => p.price));
    const priceCeil = Math.ceil(maxPrice / 10000) * 10000;
    if (!state.max) state.max = priceCeil;

    // title
    let title = "The Couture Catalog", sub = "Wedding and festive couture for the bride, the groom and the family, handcrafted in Rajasthan.";
    if (state.wishlist) { title = "Your Wishlist"; sub = "The pieces you've saved."; }
    else if (state.q) { title = `Results for “${state.q}”`; sub = ""; }
    else if (state.category.length === 1) { title = catName(state.category[0]); }
    else if (state.collection.length === 1) { const c = collOf(state.collection[0]); title = `${c.name} Collection`; sub = c.hint; }
    else if (state.occasion.length === 1) { const o = S.occasions.find(o => o.key === state.occasion[0]); title = `${o.name} Edit`; sub = o.hint; }
    else if (state.tag === "new") title = "New Arrivals";
    else if (state.tag === "bestseller") title = "Bestsellers";
    else if (state.gender.length === 1) { const m = state.gender[0] === "men"; title = m ? "Men's Ethnic Wear" : "Women's Ethnic Wear"; sub = m ? "Sherwanis, bandhgalas, kurtas and more, handcrafted in Rajasthan." : "Lehengas, sarees, anarkalis and more, handcrafted in Rajasthan."; }
    $("#cat-title").textContent = title;
    $("#cat-sub").textContent = sub;
    document.title = `${title} · SANSKAAR`;

    const groups = [
      { key: "gender", label: "Shop for", opts: [["men", "Men"], ["women", "Women"]] },
      { key: "category", label: "Category", opts: [...S.categories.men, ...S.categories.women].map(c => [c.key, c.name]) },
      { key: "occasion", label: "Occasion", opts: S.occasions.map(o => [o.key, o.name]) },
      { key: "collection", label: "Collection", opts: S.collections.map(c => [c.key, c.name]) }
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
        <details class="filter-group" open><summary>Colour</summary><div class="opts color-opts">
          ${usedColors.map(k => `<label class="color-opt" style="background:${S.colors[k].hex}" title="${S.colors[k].name}"><input type="checkbox" data-g="color" value="${k}" ${state.color.includes(k) ? "checked" : ""} aria-label="${S.colors[k].name}"></label>`).join("")}
        </div></details>
        <details class="filter-group price-range" open><summary>Price</summary><div class="opts">
          <input type="range" id="price-max" min="5000" max="${priceCeil}" step="1000" value="${state.max}" aria-label="Maximum price">
          <div class="vals"><span>₹5,000</span><span>Up to <b id="price-val">${inr(state.max)}</b></span></div>
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
        const label = g === "color" ? S.colors[v].name : g === "gender" ? (v === "men" ? "Men" : "Women") :
          g === "category" ? catName(v) : g === "occasion" ? S.occasions.find(o => o.key === v).name : collOf(v).name;
        chips.push(`<button data-rmg="${g}" data-v="${v}">${label}</button>`);
      }));
      if (state.tag) chips.push(`<button data-rmg="tag">${state.tag === "new" ? "New in" : "Bestseller"}</button>`);
      if (state.q) chips.push(`<button data-rmg="q">“${state.q}”</button>`);
      if (state.max < priceCeil) chips.push(`<button data-rmg="max">Under ${inr(state.max)}</button>`);
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
      $("#result-count").textContent = `${list.length} ${list.length === 1 ? "design" : "designs"}`;
      $("#catalog-grid").innerHTML = list.length ? list.map(card).join("") :
        `<div class="empty">${ornament}<h3>${state.wishlist ? "No saved pieces yet" : "Nothing matches just yet"}</h3><p>${state.wishlist ? "Tap the heart on any outfit to save it here." : "Try removing a filter or two."}</p><a class="btn btn-outline" href="catalog.html">View full catalogue</a></div>`;
      reveal();
    }

    function syncURL() {
      const u = new URLSearchParams();
      ["gender", "category", "occasion", "collection", "color"].forEach(g => state[g].forEach(v => u.append(g, v)));
      if (state.tag) u.set("tag", state.tag);
      if (state.q) u.set("q", state.q);
      if (state.wishlist) u.set("wishlist", "1");
      if (state.max < priceCeil) u.set("max", state.max);
      if (state.sort !== "featured") u.set("sort", state.sort);
      history.replaceState(null, "", "catalog.html" + (u.toString() ? "?" + u : ""));
    }

    function update() { drawFilters(); drawActive(); drawGrid(); syncURL(); }

    const si = $("#search-input");
    if (si) {
      si.value = state.q;
      let t; si.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { state.q = si.value.trim(); update(); }, 200); });
      if (location.hash === "#search") si.focus();
    }
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
    const id = new URLSearchParams(location.search).get("id");
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

    $("#breadcrumb").innerHTML = `<a href="index.html">Home</a> / <a href="catalog.html?gender=${p.gender}">${p.gender === "men" ? "Men" : "Women"}</a> / <a href="catalog.html?gender=${p.gender}&category=${p.category}">${catName(p.category)}</a> / <span>${p.name}</span>`;

    $("#pdp").innerHTML = `
      <div class="gallery">
        <div class="thumbs">${views.map((v, i) => `<button class="${i ? "" : "active"}" data-view="${v}" aria-label="${viewNames[v]} view">${media(p, v)}<small>${viewNames[v]}</small></button>`).join("")}</div>
        <div class="main-view" id="main-view">${media(p, "front", true)}<span class="view-label" id="view-label">Front</span><span class="ai-note" id="ai-note">Preview · photoshoot coming</span></div>
      </div>
      <div class="pdp-info">
        <div class="coll">${c.name} Collection · <span class="deva">${c.deva}</span></div>
        <h1>${p.name}</h1>
        <div class="sku">SKU ${p.id} · ${p.colorName}</div>
        <span class="price">${inr(p.price)}${p.mrp ? `<s>${inr(p.mrp)}</s><span class="off">${off}% off</span>` : ""}</span>
        <div class="tax">Inclusive of all taxes · Free alterations</div>
        <p class="desc">${p.description}</p>

        <div class="opt-label"><span>Colour: ${p.colorName}</span></div>
        <div class="color-row">
          ${[p, ...siblings.filter(s => s.color !== p.color).slice(0, 4)].map(s => `<a href="product.html?id=${s.id}" class="${s.id === p.id ? "active" : ""}" style="background:${s.hex}" title="${s.colorName} — ${s.name}" aria-label="${s.colorName}"></a>`).join("")}
        </div>

        <div class="opt-label"><span>Select size</span><a href="#" data-open="sizeguide">Size guide</a></div>
        <div class="sizes" id="sizes">${p.sizes.map(s => `<button data-size="${s}">${s}</button>`).join("")}<button data-size="Custom">Made to measure</button></div>

        <div class="pdp-actions">
          <button class="btn btn-gold" id="add-cart">Add to bag</button>
          <button class="btn btn-outline" id="add-wish">${wish.has(p.id) ? "♥ Wishlisted" : "♡ Wishlist"}</button>
          <a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="https://wa.me/${S.config.whatsapp}?text=${encodeURIComponent(`Namaste! I'm interested in ${p.name} (${p.id}). Could you share more details?`)}">${I.whatsapp.replace("<svg", '<svg width="18" height="18"')} Enquire on WhatsApp</a>
        </div>

        <div class="pdp-perks">
          <div>${I.truck}Ships in 7–10 days</div><div>${I.scissors}Free alterations</div><div>${I.shield}Quality assured</div>
        </div>

        <div class="accordion">
          <details open><summary>Product details</summary><div class="body"><ul>
            <li><b>Fabric:</b> ${p.fabric}</li><li><b>Work:</b> ${p.work}</li><li><b>Colour:</b> ${p.colorName}</li>
            <li><b>Includes:</b> ${includes}</li><li><b>Occasion:</b> ${p.occasions.map(o => S.occasions.find(x => x.key === o).name).join(", ")}</li>
          </ul></div></details>
          <details><summary>Size & fit</summary><div class="body">Tailored to a classic fit. Every Sanskaar outfit includes free alterations, or choose <i>Made to measure</i> and our master tailor will call you for measurements.</div></details>
          <details><summary>Shipping & exchange</summary><div class="body">Free shipping across India above ${inr(S.config.freeShippingAbove)}. International shipping available. 7-day size exchange on unworn pieces with tags intact.</div></details>
          <details><summary>Care</summary><div class="body">Dry clean only. Store folded in a muslin bag, away from direct sunlight and moisture. Refold every few months to protect the zari.</div></details>
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
      if (!size) { toast("Please select a size"); $("#sizes").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
      cart.add(p.id, size); toast(`${p.name} added to your bag`);
      setTimeout(() => open("cart"), 500);
    };
    $("#add-wish").onclick = e => {
      const on = wish.toggle(p.id);
      e.target.textContent = on ? "♥ Wishlisted" : "♡ Wishlist";
      toast(on ? "Added to wishlist" : "Removed from wishlist");
    };

    // complete the look: same collection, opposite gender
    const look = S.products.filter(x => x.collection === p.collection && x.gender !== p.gender).slice(0, 4);
    $("#look-grid").innerHTML = look.map(card).join("");
    $("#look-sub").textContent = `Coordinated pieces from the ${c.name} collection for your ${p.gender === "men" ? "partner" : "partner"}.`;
    const similar = siblings.slice(0, 4);
    $("#similar-grid").innerHTML = similar.map(card).join("");
    bindCards($("#look-grid")); bindCards($("#similar-grid"));

    // recently viewed
    const rv = store.get("sk_recent", []).filter(x => x !== p.id);
    store.set("sk_recent", [p.id, ...rv].slice(0, 8));
    reveal();
  }

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;
    header(document.body.dataset.nav);
    footer();
    overlays();
    updateCounts();
    if (page === "home") home();
    if (page === "catalog") catalog();
    if (page === "product") product();
    reveal();
  });
})();
