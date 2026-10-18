/* ==========================================================================
   SANSKAAR — Owner admin
   Prices, discounts, delivery days, sizes and stock; order delivery status;
   Excel download / upload. Only accounts listed in OWNER_EMAILS on the API
   can use it.
   ========================================================================== */
(function () {
  const S = window.SANSKAAR;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = S.esc;
  const inr = n => "₹" + Number(n).toLocaleString("en-IN");
  const UNITS = ["Standard", "Inches", "CM", "UK", "US"];
  const STATUS_LABEL = { confirmed: "Order confirmed", tailoring: "Being tailored", shipped: "Shipped", out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled" };
  const price = (mrp, pct, amt) => Math.max(0, Math.round(mrp * (1 - pct / 100)) - amt);
  const info = id => S.allProducts.find(p => p.id === id) || {};

  let products = [], orders = [], statuses = [];
  // Preview: until the API is online the page runs on the website's own catalogue
  // and one example order. Nothing is saved and customers don't see any change.
  let preview = false;
  const PREVIEW_STATUSES = Object.keys(STATUS_LABEL);
  function previewProduct(p, edits = {}) {
    const x = { id: p.id, name: p.name, mrp: p.mrp || p.price, discountPct: 0, discountAmt: (p.mrp || p.price) - p.price,
      deliveryDays: 10, sizes: p.sizes || [], sizeUnit: p.sizeUnit || "Standard", inventory: 10, sold: 0, active: true, ...edits };
    x.price = price(x.mrp, x.discountPct, x.discountAmt);
    x.remaining = Math.max(0, x.inventory - x.sold);
    return x;
  }
  function previewData() {
    products = S.allProducts.map(p => previewProduct(p));
    const p = S.allProducts[0], d = new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10);
    statuses = PREVIEW_STATUSES;
    orders = [{ receipt: "EXAMPLE-0001", status: "tailoring", createdAt: new Date().toISOString(), total: p.price, paymentId: "example order",
      expectedDelivery: d, courier: "", trackingNo: "", trackingUrl: "",
      customer: { name: "Example Customer", phone: "9876543210", email: "customer@example.com", line1: "12 MG Road", line2: "", city: "Jaipur", state: "Rajasthan", pincode: "302001" },
      items: [{ id: p.id, name: p.name, size: (p.sizes || ["M"])[0], qty: 1 }] }];
  }

  function flash(msg, bad) {
    const el = $("#admin-flash");
    el.textContent = msg; el.className = "admin-flash " + (bad ? "bad" : "good"); el.hidden = false;
    clearTimeout(flash.t); flash.t = setTimeout(() => { el.hidden = true; }, 5000);
  }

  /* ---------- Products ---------- */
  function productRow(p) {
    return `<tr data-id="${p.id}" class="${p.remaining === 0 ? "out" : p.remaining <= 3 ? "low" : ""}">
      <td><b>${p.id}</b><small>${esc(p.name)}</small><small class="muted">${esc(info(p.id).category || "")}</small></td>
      <td><input type="number" min="1" name="mrp" value="${p.mrp}"></td>
      <td><input type="number" min="0" max="90" step="0.5" name="discountPct" value="${p.discountPct}"></td>
      <td><input type="number" min="0" name="discountAmt" value="${p.discountAmt}"></td>
      <td class="calc" data-price>${inr(p.price)}</td>
      <td><input type="number" min="1" max="120" name="deliveryDays" value="${p.deliveryDays}"></td>
      <td><input name="sizes" value="${esc(p.sizes.join(", "))}"></td>
      <td><select name="sizeUnit">${UNITS.map(u => `<option ${u === p.sizeUnit ? "selected" : ""}>${u}</option>`).join("")}</select></td>
      <td><input type="number" min="0" name="inventory" value="${p.inventory}"></td>
      <td class="calc">${p.sold}</td>
      <td class="calc" data-remaining><b>${p.remaining}</b></td>
      <td><input type="checkbox" name="active" ${p.active ? "checked" : ""} aria-label="Show in store"></td>
      <td><button class="btn btn-ghost-gold btn-sm" data-save>Save</button></td>
    </tr>`;
  }

  function drawProducts() {
    const q = ($("#p-search").value || "").toLowerCase();
    const filter = $("#p-filter").value;
    const list = products.filter(p => (!q || (p.id + " " + p.name + " " + (info(p.id).category || "")).toLowerCase().includes(q))
      && (filter === "all" || (filter === "low" && p.remaining <= 3) || (filter === "hidden" && !p.active)));
    $("#p-body").innerHTML = list.map(productRow).join("") || `<tr><td colspan="13" class="muted">No products match.</td></tr>`;
    const sold = products.reduce((s, p) => s + p.sold, 0), stock = products.reduce((s, p) => s + p.remaining, 0);
    $("#p-stats").innerHTML = `<span><b>${products.length}</b> products</span><span><b>${sold}</b> sold</span><span><b>${stock}</b> in stock</span><span><b>${products.filter(p => p.remaining === 0).length}</b> sold out</span>`;
  }

  async function saveRow(tr) {
    const val = n => $(`[name=${n}]`, tr);
    const body = {
      mrp: Number(val("mrp").value), discountPct: Number(val("discountPct").value), discountAmt: Number(val("discountAmt").value),
      deliveryDays: Number(val("deliveryDays").value), sizes: val("sizes").value, sizeUnit: val("sizeUnit").value,
      inventory: Number(val("inventory").value), active: val("active").checked
    };
    const btn = $("[data-save]", tr);
    btn.disabled = true;
    if (preview) {
      const product = previewProduct(info(tr.dataset.id), { ...body, sizes: body.sizes.split(",").map(x => x.trim()).filter(Boolean) });
      products = products.map(p => (p.id === product.id ? product : p));
      tr.outerHTML = productRow(product);
      return flash(`Preview: ${product.id} would now cost ${inr(product.price)} with ${product.remaining} in stock. Not saved — connect the API to save.`);
    }
    try {
      const { product } = await S.api(`/api/admin/products/${encodeURIComponent(tr.dataset.id)}`, { method: "PUT", body });
      products = products.map(p => (p.id === product.id ? product : p));
      tr.outerHTML = productRow(product);
      flash(`Saved ${product.id} — now ${inr(product.price)}, ${product.remaining} in stock.`);
    } catch (e) { flash(e.message, true); btn.disabled = false; }
  }

  /* ---------- Orders ---------- */
  function orderRow(o) {
    const c = o.customer;
    return `<div class="panel admin-order" data-receipt="${esc(o.receipt)}">
      <div class="oc-top"><b>${esc(o.receipt)}</b><span class="status status-${o.status}">${STATUS_LABEL[o.status] || o.status}</span></div>
      <p class="muted">${new Date(o.createdAt).toLocaleString("en-IN")} · ${inr(o.total)} · ${esc(o.paymentId || "")}</p>
      <div class="two-col">
        <div><b>${esc(c.name)}</b> · <a href="tel:${esc(c.phone)}">${esc(c.phone)}</a> · ${esc(c.email)}<br>${esc(c.line1)}${c.line2 ? ", " + esc(c.line2) : ""}, ${esc(c.city)}, ${esc(c.state)} ${esc(c.pincode)}
          <ul>${o.items.map(i => `<li>${esc(i.id)} · ${esc(i.name)} · size ${esc(i.size)} × ${i.qty}</li>`).join("")}</ul></div>
        <div class="form-grid">
          <div class="field"><label>Status</label><select name="status">${statuses.map(s => `<option value="${s}" ${s === o.status ? "selected" : ""}>${STATUS_LABEL[s] || s}</option>`).join("")}</select></div>
          <div class="field"><label>Expected delivery</label><input type="date" name="expectedDelivery" value="${o.expectedDelivery || ""}"></div>
          <div class="field"><label>Courier</label><input name="courier" value="${esc(o.courier)}" placeholder="e.g. Blue Dart"></div>
          <div class="field"><label>Tracking number</label><input name="trackingNo" value="${esc(o.trackingNo)}"></div>
          <div class="field full"><label>Tracking link</label><input name="trackingUrl" value="${esc(o.trackingUrl)}" placeholder="https://"></div>
          <div class="field full"><label>Note for the customer (optional)</label><input name="note" placeholder="e.g. Final fitting done"></div>
          <div class="full"><button class="btn btn-gold" data-save-order>Update order</button></div>
        </div>
      </div>
    </div>`;
  }
  function drawOrders() {
    const f = $("#o-filter").value;
    const list = orders.filter(o => f === "all" || (f === "open" ? !["delivered", "cancelled"].includes(o.status) : o.status === f));
    $("#o-list").innerHTML = list.map(orderRow).join("") || `<div class="panel center muted">No orders here yet.</div>`;
  }
  async function saveOrder(box) {
    const body = Object.fromEntries($$("input, select", box).map(i => [i.name, i.value]));
    if (!body.note) delete body.note;
    const btn = $("[data-save-order]", box);
    btn.disabled = true;
    if (preview) {
      const order = { ...orders.find(o => o.receipt === box.dataset.receipt), ...body };
      orders = orders.map(o => (o.receipt === order.receipt ? order : o));
      box.outerHTML = orderRow(order);
      return flash(`Preview: the customer would now see “${STATUS_LABEL[order.status]}”. Not saved — connect the API to save.`);
    }
    try {
      const { order } = await S.api(`/api/admin/orders/${encodeURIComponent(box.dataset.receipt)}`, { method: "PUT", body });
      orders = orders.map(o => (o.receipt === order.receipt ? order : o));
      box.outerHTML = orderRow(order);
      flash(`Order ${order.receipt} updated — the customer can see it now.`);
    } catch (e) { flash(e.message, true); btn.disabled = false; }
  }

  /* ---------- Excel ---------- */
  async function download() {
    if (preview) return flash("Excel download and upload work once the API is online.", true);
    try {
      const blob = await S.api("/api/admin/catalog.xlsx", { blob: true });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `sanskaar-catalogue-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) { flash(e.message, true); }
  }
  async function upload(file) {
    if (preview) return flash("Excel download and upload work once the API is online.", true);
    const out = $("#x-result");
    out.innerHTML = `<p class="muted">Uploading ${esc(file.name)}…</p>`;
    const b64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    try {
      const r = await S.api("/api/admin/catalog.xlsx", { method: "POST", body: { file: b64 } });
      out.innerHTML = `<p class="admin-flash good">Updated ${r.updated} products. The app and website now show the new prices and stock.</p>`;
      await loadProducts();
    } catch (e) {
      out.innerHTML = `<p class="admin-flash bad">${esc(e.message)}</p>${e.details ? `<ul>${e.details.map(d => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}`;
    }
  }

  async function loadProducts() { products = (await S.api("/api/admin/products")).products; drawProducts(); }
  async function loadOrders() { const r = await S.api("/api/admin/orders"); orders = r.orders; statuses = r.statuses; drawOrders(); }

  async function admin() {
    const root = $("#admin-root");
    preview = !S.apiReady();
    if (!preview && !S.session.token) { root.innerHTML = `<div class="panel center"><h3>Owner admin</h3><p class="muted">Log in with your owner account.</p><a class="btn btn-gold" href="account.html">${S.t("nav.login")}</a></div>`; return; }
    if (!preview) try { await S.api("/api/auth/me"); } catch (e) { root.innerHTML = `<div class="panel center"><p class="form-error">${esc(e.message)}</p></div>`; return; }

    root.innerHTML = `${preview ? `<div class="admin-flash bad"><b>Preview mode.</b> The backend (API) isn't connected yet, so this page shows your catalogue with starting values and one example order. You can try every control, but nothing is saved and customers see no change. Once the API is online, log in with your owner email and changes save for real.</div>` : ""}
      <p class="admin-flash" id="admin-flash" hidden></p>
      <div class="tabs" role="tablist">
        <button class="tab active" data-tab="products">Products &amp; prices</button>
        <button class="tab" data-tab="orders">Orders &amp; delivery</button>
        <button class="tab" data-tab="excel">Excel</button>
      </div>
      <section data-pane="products">
        <div class="admin-tools"><input id="p-search" type="search" placeholder="Search ID, name or category">
          <select id="p-filter"><option value="all">All products</option><option value="low">Low stock (≤ 3)</option><option value="hidden">Hidden from store</option></select>
          <div class="admin-stats" id="p-stats"></div></div>
        <p class="muted small">Selling price = MRP − Discount % − Discount ₹. Remaining = Stock received − Sold (counted from paid app and website orders).</p>
        <div class="table-wrap"><table class="admin-table">
          <thead><tr><th>Product</th><th>MRP ₹</th><th>Disc %</th><th>Disc ₹</th><th>Price</th><th>Delivery days</th><th>Sizes</th><th>Size unit</th><th>Stock received</th><th>Sold</th><th>Remaining</th><th>Show</th><th></th></tr></thead>
          <tbody id="p-body"><tr><td colspan="13" class="muted">Loading…</td></tr></tbody>
        </table></div>
      </section>
      <section data-pane="orders" hidden>
        <div class="admin-tools"><select id="o-filter"><option value="open">Open orders</option><option value="all">All orders</option>${Object.entries(STATUS_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div>
        <div id="o-list"><p class="muted">Loading…</p></div>
      </section>
      <section data-pane="excel" hidden>
        <div class="panel">
          <h3>1. Download the catalogue</h3>
          <p class="muted">An Excel file with every product: ID, name, MRP, discount % and ₹, selling price, delivery days and tentative date, sizes and size unit, stock received, sold and remaining. It also has an Orders sheet.</p>
          <button class="btn btn-gold" id="x-download">Download Excel</button>
          <h3 style="margin-top:28px">2. Edit the yellow columns</h3>
          <p class="muted">Grey columns are calculated (or counted from orders) and are ignored on upload.</p>
          <h3 style="margin-top:28px">3. Upload it back</h3>
          <input type="file" id="x-file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
          <div id="x-result"></div>
        </div>
      </section>`;

    $$(".tab", root).forEach(b => b.onclick = () => {
      $$(".tab", root).forEach(x => x.classList.toggle("active", x === b));
      $$("[data-pane]", root).forEach(p => { p.hidden = p.dataset.pane !== b.dataset.tab; });
    });
    $("#p-search").oninput = drawProducts;
    $("#p-filter").onchange = drawProducts;
    $("#o-filter").onchange = drawOrders;
    $("#p-body").addEventListener("click", e => { const b = e.target.closest("[data-save]"); if (b) saveRow(b.closest("tr")); });
    $("#p-body").addEventListener("input", e => {
      const tr = e.target.closest("tr"); if (!tr) return;
      const v = n => Number($(`[name=${n}]`, tr).value) || 0;
      $("[data-price]", tr).textContent = inr(price(v("mrp"), v("discountPct"), v("discountAmt")));
    });
    $("#o-list").addEventListener("click", e => { const b = e.target.closest("[data-save-order]"); if (b) saveOrder(b.closest("[data-receipt]")); });
    $("#x-download").onclick = download;
    $("#x-file").onchange = e => { if (e.target.files[0]) upload(e.target.files[0]); e.target.value = ""; };

    if (preview) { previewData(); drawProducts(); drawOrders(); return; }
    try { await Promise.all([loadProducts(), loadOrders()]); }
    catch (e) { root.innerHTML = `<div class="panel center"><h3>Owner admin</h3><p class="form-error">${esc(e.message)}</p></div>`; }
  }

  S.pages.admin = admin;
})();
