/* ==========================================================================
   SANSKAAR — Account (log in / sign up, my orders, delivery tracking)
   and Checkout (address → Razorpay → confirmed order)
   ========================================================================== */
(function () {
  const S = window.SANSKAAR;
  const $ = (sel, root = document) => root.querySelector(sel);
  const t = (k, v) => S.t(k, v), esc = S.esc;
  const inr = n => "₹" + Number(n).toLocaleString("en-IN");
  const hashParams = () => new URLSearchParams(location.hash.replace(/^#/, "").split("~").map(x => x.replace(".", "=")).join("&"));
  const STEPS = ["confirmed", "tailoring", "shipped", "out_for_delivery", "delivered"];
  const wa = text => `https://wa.me/${S.config.whatsapp}?text=${encodeURIComponent(text)}`;
  const notReady = `<div class="panel center"><h3>${t("co.notConfigured")}</h3><p class="muted">SANSKAAR.config.apiUrl</p></div>`;

  /* ---------- Log in / sign up ---------- */
  function authForms(root, onDone, intro) {
    let mode = "login";
    const draw = () => {
      const login = mode === "login";
      root.innerHTML = `<div class="panel auth">
        <h2>${login ? t("auth.loginTitle") : t("auth.signupTitle")}</h2>
        <p class="muted">${intro || t("auth.why")}</p>
        <form id="auth-form" class="form-grid" novalidate>
          ${login ? `
            <div class="field full"><label for="a-login">${t("auth.emailOrMobile")}</label><input id="a-login" name="login" autocomplete="username" required></div>
            <div class="field full"><label for="a-pass">${t("auth.password")}</label><input id="a-pass" name="password" type="password" autocomplete="current-password" required></div>` : `
            <div class="field full"><label for="a-name">${t("auth.name")}</label><input id="a-name" name="name" autocomplete="name" required></div>
            <div class="field"><label for="a-email">${t("auth.email")}</label><input id="a-email" name="email" type="email" autocomplete="email" required></div>
            <div class="field"><label for="a-phone">${t("auth.mobile")}</label><input id="a-phone" name="phone" type="tel" autocomplete="tel" required></div>
            <div class="field full"><label for="a-pass">${t("auth.password")}</label><input id="a-pass" name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="${esc(t("auth.passwordHint"))}"></div>`}
          <p class="form-error full" id="auth-error" role="alert" hidden></p>
          <div class="full"><button class="btn btn-gold btn-block" id="auth-submit">${login ? t("auth.login") : t("auth.signup")}</button></div>
        </form>
        <button class="link-btn" id="auth-switch">${login ? t("auth.newHere") : t("auth.haveAccount")}</button>
        ${login ? `<a class="link-btn muted" href="${wa("Namaste SANSKAAR, I forgot my account password.")}" target="_blank" rel="noopener">${t("auth.forgot")}</a>` : ""}
      </div>`;
      $("#auth-switch", root).onclick = () => { mode = login ? "signup" : "login"; draw(); };
      $("#auth-form", root).onsubmit = async e => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        const err = $("#auth-error", root), btn = $("#auth-submit", root);
        if (!login && String(f.password).length < 8) { err.textContent = t("err.password"); err.hidden = false; return; }
        btn.disabled = true; err.hidden = true;
        try {
          const r = await S.api(login ? "/api/auth/login" : "/api/auth/signup", { method: "POST", body: f });
          S.saveSession(r.token, r.user);
          onDone(r.user);
        } catch (ex) {
          err.textContent = ex.message; err.hidden = false;
        } finally { btn.disabled = false; }
      };
    };
    draw();
  }

  /* ---------- Orders ---------- */
  const statusBadge = s => `<span class="status status-${s}">${t("status." + s)}</span>`;
  const itemsLabel = n => n === 1 ? t("ord.item") : t("ord.items", { n });

  function orderCard(o) {
    const n = o.items.reduce((s, i) => s + i.qty, 0);
    return `<a class="order-card" href="account.html#order.${encodeURIComponent(o.receipt)}">
      <div class="oc-top"><b>${t("ord.order", { id: esc(o.receipt) })}</b>${statusBadge(o.status)}</div>
      <div class="oc-items">${o.items.map(i => esc(i.name)).join(" · ")}</div>
      <div class="oc-meta"><span>${t("ord.placedOn", { date: S.fmtDate(o.createdAt) })} · ${itemsLabel(n)}</span><b>${inr(o.total)}</b></div>
      ${o.expectedDelivery && !["delivered", "cancelled"].includes(o.status) ? `<div class="oc-eta">${t("ord.expected")}: <b>${S.fmtDate(o.expectedDelivery)}</b></div>` : ""}
    </a>`;
  }

  function timeline(o) {
    if (o.status === "cancelled") return `<ol class="timeline"><li class="done cancelled"><b>${t("status.cancelled")}</b>${noteFor(o, "cancelled")}</li></ol>`;
    const at = STEPS.indexOf(o.status);
    return `<ol class="timeline">${STEPS.map((s, i) => {
      const h = [...o.history].reverse().find(x => x.status === s);
      return `<li class="${i <= at ? "done" : ""} ${i === at ? "current" : ""}"><b>${t("status." + s)}</b>${h ? `<small>${S.fmtDate(h.at)}</small>` : ""}${noteFor(o, s)}</li>`;
    }).join("")}</ol>`;
  }
  const noteFor = (o, s) => o.history.filter(h => h.status === s && h.note).map(h => `<p>${esc(h.note)}</p>`).join("");

  function orderDetail(root, o, justPaid) {
    const c = o.customer;
    root.innerHTML = `
      ${justPaid ? `<div class="panel success"><span class="eyebrow">${t("ok.eyebrow")}</span><h2>${S.rich("ok.title")}</h2><p>${t("ok.text")}</p></div>` : ""}
      <a class="link-btn" href="account.html#orders">← ${t("nav.orders")}</a>
      <div class="panel">
        <div class="oc-top"><h2>${t("ord.order", { id: esc(o.receipt) })}</h2>${statusBadge(o.status)}</div>
        <p class="muted">${t("ord.placedOn", { date: S.fmtDate(o.createdAt) })}</p>
        ${o.status !== "cancelled" ? `<div class="eta">${o.status === "delivered" ? t("ord.deliveredOn") : t("ord.expected")}<b>${o.status === "delivered" ? S.fmtDate((o.history.find(h => h.status === "delivered") || {}).at) : S.fmtDate(o.expectedDelivery)}</b></div>` : ""}
        <h3>${t("ord.status")}</h3>
        ${timeline(o)}
        ${o.courier || o.trackingNo ? `<div class="tracking"><div><span class="muted">${t("ord.courier")}</span><b>${esc(o.courier || "—")}</b></div><div><span class="muted">${t("ord.tracking")}</span><b>${esc(o.trackingNo || "—")}</b></div>
          ${o.trackingUrl ? `<a class="btn btn-ghost-gold" href="${esc(o.trackingUrl)}" target="_blank" rel="noopener">${t("ord.trackCourier")}</a>` : ""}</div>` : ""}
      </div>
      <div class="panel two-col">
        <div><h3>${t("co.summary")}</h3>
          ${o.items.map(i => `<div class="sum-line"><span>${esc(i.name)}<small>${t("bag.size", { size: i.size === "Custom" ? t("p.madeToMeasure") : esc(i.size) })} · × ${i.qty}</small></span><b>${inr(i.price * i.qty)}</b></div>`).join("")}
          <div class="sum-line"><span>${t("co.shipping")}</span><b>${o.shipping ? inr(o.shipping) : t("co.free")}</b></div>
          <div class="sum-line total"><span>${t("co.total")}</span><b>${inr(o.total)}</b></div>
          <p class="muted">${t("ord.paid", { amount: inr(o.total) })} · ${esc(o.paymentId || "")}</p>
        </div>
        <div><h3>${t("ord.address")}</h3>
          <p>${esc(c.name)}<br>${esc(c.line1)}${c.line2 ? "<br>" + esc(c.line2) : ""}<br>${esc(c.city)}, ${esc(c.state)} ${esc(c.pincode)}<br>${esc(c.phone)}</p>
          <a class="btn btn-wa" href="${wa(`Namaste SANSKAAR! I need help with order ${o.receipt}.`)}" target="_blank" rel="noopener">${t("ord.help")}</a>
        </div>
      </div>`;
  }

  async function account() {
    const root = $("#account-root");
    if (!S.apiReady()) { root.innerHTML = notReady; return; }
    const params = hashParams();
    if (!S.session.token) {
      authForms(root, () => {
        if (params.get("next") === "checkout") location.href = "checkout.html";
        else location.reload();
      });
      return;
    }
    const user = S.session.user;
    const receipt = params.get("order");
    if (receipt) {
      root.innerHTML = `<div class="panel center"><p class="muted">…</p></div>`;
      try {
        const { order } = await S.api(`/api/orders/${encodeURIComponent(receipt)}`);
        orderDetail(root, order, params.get("new") === "1");
      } catch (e) {
        root.innerHTML = `<div class="panel center"><p class="form-error">${esc(e.message)}</p><a class="btn btn-outline" href="account.html#orders">${t("nav.orders")}</a></div>`;
      }
      return;
    }
    root.innerHTML = `
      <div class="panel account-head">
        <div><span class="eyebrow">${t("acc.title")}</span><h2>${esc(t("acc.hello", { name: user.name.split(" ")[0] }))}</h2>
          <p class="muted">${esc(user.email)} · ${esc(user.phone)}</p></div>
        <div class="account-actions">
          ${user.isOwner ? `<a class="btn btn-ghost-gold" href="admin.html">${t("nav.admin")}</a>` : ""}
          <button class="btn btn-outline" id="logout">${t("nav.logout")}</button>
        </div>
      </div>
      <h2 class="orders-title" id="orders">${t("ord.title")}</h2>
      <div id="orders-list"><p class="muted">…</p></div>`;
    $("#logout").onclick = () => { S.logout(); location.href = "index.html"; };
    try {
      const { orders } = await S.api("/api/orders");
      $("#orders-list").innerHTML = orders.length ? orders.map(orderCard).join("")
        : `<div class="panel center"><h3>${t("acc.noOrders")}</h3><p class="muted">${t("acc.noOrdersText")}</p><a class="btn btn-ghost-gold" href="catalog.html">${t("bag.explore")}</a></div>`;
    } catch (e) {
      $("#orders-list").innerHTML = `<p class="form-error">${esc(e.message)}</p>`;
    }
  }

  /* ---------- Checkout ---------- */
  const blank = { name: "", phone: "", email: "", line1: "", line2: "", city: "", state: "", pincode: "" };
  function problem(a) {
    if (!a.name.trim()) return ["name", "err.name"];
    if (!/^[6-9]\d{9}$/.test(a.phone.replace(/[\s-]/g, "").replace(/^(\+91|0)/, ""))) return ["phone", "err.phone"];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim())) return ["email", "err.email"];
    if (!a.line1.trim()) return ["line1", "err.street"];
    if (!a.city.trim()) return ["city", "err.city"];
    if (!a.state.trim()) return ["state", "err.state"];
    if (!/^\d{6}$/.test(a.pincode.trim())) return ["pincode", "err.pin"];
    return null;
  }
  function loadRazorpay() {
    if (window.Razorpay) return Promise.resolve(window.Razorpay);
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error()));
      s.onerror = () => reject(new Error(t("err.network")));
      document.head.appendChild(s);
    });
  }

  async function checkout() {
    const root = $("#checkout-root");
    if (!S.apiReady()) { root.innerHTML = notReady; return; }
    if (!S.session.token) { authForms(root, () => location.reload(), t("co.loginTitle")); return; }
    const items = S.cart.items().filter(i => S.products.some(p => p.id === i.id));
    if (!items.length) {
      root.innerHTML = `<div class="panel center"><h3>${t("bag.empty")}</h3><a class="btn btn-ghost-gold" href="catalog.html">${t("bag.explore")}</a></div>`;
      return;
    }
    const user = S.session.user;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem("sk_address")) || {}; } catch (e) { /* no saved address */ }
    // last used address first, then the account's own name, phone and email
    const a = { ...blank };
    Object.keys(blank).forEach(k => { a[k] = saved[k] || ""; });
    a.name = a.name || user.name; a.phone = a.phone || user.phone; a.email = a.email || user.email;
    const lines = items.map(i => ({ ...i, p: S.products.find(p => p.id === i.id) }));
    const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
    const shipping = subtotal >= S.config.freeShippingAbove ? 0 : S.config.shippingFee;
    const total = subtotal + shipping;
    const days = Math.max(...lines.map(l => l.p.deliveryDays || 10));
    const f = (k, label, extra = "") => `<div class="field ${k === "line1" || k === "line2" ? "full" : ""}"><label for="c-${k}">${t(label)}</label><input id="c-${k}" name="${k}" value="${esc(a[k])}" ${extra}></div>`;

    root.innerHTML = `<div class="checkout-grid">
      <form class="panel" id="co-form" novalidate>
        <span class="eyebrow">${t("co.step1")}</span><h2>${t("co.delivery")}</h2>
        <div class="form-grid">
          ${f("name", "co.fullName", 'autocomplete="name"')}
          ${f("phone", "co.mobile", 'type="tel" autocomplete="tel"')}
          ${f("email", "co.email", 'type="email" autocomplete="email"')}
          ${f("pincode", "co.pin", 'inputmode="numeric" maxlength="6" autocomplete="postal-code"')}
          ${f("line1", "co.address", `autocomplete="street-address" placeholder="${esc(t("co.addressHint"))}"`)}
          ${f("line2", "co.landmark")}
          ${f("city", "co.city", 'autocomplete="address-level2"')}
          ${f("state", "co.state", 'autocomplete="address-level1"')}
        </div>
      </form>
      <aside class="panel">
        <span class="eyebrow">${t("co.step2")}</span><h2>${t("co.summary")}</h2>
        ${lines.map(l => `<div class="sum-line"><span>${esc(l.p.name)}<small>${t("bag.size", { size: l.size === "Custom" ? t("p.madeToMeasure") : esc(l.size) })} · × ${l.qty}</small></span><b>${inr(l.p.price * l.qty)}</b></div>`).join("")}
        <div class="sum-line"><span>${t("co.subtotal")}</span><b>${inr(subtotal)}</b></div>
        <div class="sum-line"><span>${t("co.shipping")}</span><b>${shipping ? inr(shipping) : t("co.free")}</b></div>
        <div class="sum-line total"><span>${t("co.total")}</span><b>${inr(total)}</b></div>
        <p class="muted small">${t("co.taxes")} · ${t("co.deliveryBy", { date: S.fmtDate(S.inDays(days)) })}</p>
        <p class="secure">${t("co.secure")}</p>
        <p class="form-error" id="co-error" role="alert" hidden></p>
        <div id="co-unconfirmed" hidden></div>
        <button class="btn btn-gold btn-block" id="pay">${t("co.pay", { amount: inr(total) })}</button>
        <a class="link-btn" href="${wa("Namaste SANSKAAR! I have a question about my order.")}" target="_blank" rel="noopener">${t("co.help")}</a>
      </aside>
    </div>`;

    const err = $("#co-error"), btn = $("#pay");
    const fail = msg => { err.textContent = msg; err.hidden = false; btn.disabled = false; btn.textContent = t("co.pay", { amount: inr(total) }); };
    btn.onclick = async () => {
      const addr = Object.fromEntries(new FormData($("#co-form")));
      document.querySelectorAll("#co-form input").forEach(i => i.classList.remove("invalid"));
      const bad = problem(addr);
      if (bad) { $(`#c-${bad[0]}`).classList.add("invalid"); $(`#c-${bad[0]}`).focus(); return fail(t(bad[1])); }
      try { localStorage.setItem("sk_address", JSON.stringify(addr)); } catch (e) { /* not saved */ }
      err.hidden = true; btn.disabled = true;
      let order, Razorpay;
      try {
        [order, Razorpay] = await Promise.all([
          S.api("/api/orders", { method: "POST", body: { items: items.map(({ id, size, qty }) => ({ id, size, qty })), customer: addr } }),
          loadRazorpay()
        ]);
      } catch (e) { return fail(e.message); }
      const rzp = new Razorpay({
        key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency,
        name: "SANSKAAR", description: `Order ${order.receipt}`,
        prefill: { name: addr.name, email: addr.email, contact: addr.phone },
        notes: { receipt: order.receipt },
        theme: { color: "#c8a45c" },
        modal: { confirm_close: true, ondismiss: () => { btn.disabled = false; } },
        handler: async r => {
          btn.textContent = t("co.confirming");
          try {
            await S.api("/api/verify", { method: "POST", body: r });
            S.cart.save([]);
            location.href = `account.html#order.${encodeURIComponent(order.receipt)}~new.1`;
          } catch (e) {
            // paid, but not confirmed: never let them pay again
            btn.hidden = true;
            const box = $("#co-unconfirmed");
            box.innerHTML = `<p>${esc(t("co.unconfirmed", { ref: r.razorpay_payment_id }))}</p>
              <a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="${wa(`Namaste SANSKAAR! I paid for my order but it wasn't confirmed. Payment reference: ${r.razorpay_payment_id}`)}">${t("co.sendRef")}</a>`;
            box.hidden = false;
          }
        }
      });
      rzp.on("payment.failed", r => fail(t("co.failed", { reason: (r.error && r.error.description) || "" })));
      rzp.open();
    };
  }

  S.pages.account = () => {
    window.addEventListener("hashchange", () => { account(); window.scrollTo(0, 0); });
    return account();
  };
  S.pages.checkout = checkout;
})();
