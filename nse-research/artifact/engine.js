/*
 * NSE research engine, JavaScript port of nse_research/ (normalize, indicators,
 * swings, breakout, patterns, candles). Same rules and version tags as the
 * Python package; tests/compare_engine.py checks the two agree.
 * Pure functions only: nothing here fetches data.
 */
(function (root) {
  "use strict";

  const NaN_ = Number.NaN;
  const isNum = (v) => typeof v === "number" && !Number.isNaN(v);
  const nan = (n) => new Array(n).fill(NaN_);

  const LABELS = {
    SOURCE_TAPETIDE: "Tapetide (secondary source)",
    CALCULATED: "CALCULATED FROM OHLCV DATA",
    DATA_NOT_AVAILABLE: "DATA NOT AVAILABLE",
    SOURCE_UNAVAILABLE: "DATA SOURCE UNAVAILABLE",
    NOT_AVAILABLE_WITH_SOURCE: "NOT AVAILABLE WITH CURRENT DATA SOURCE",
    NO_SIGNAL_DATA: "NO SIGNAL — DATA QUALITY/FRESHNESS INSUFFICIENT",
    NOT_BACKTESTED: "NOT YET BACKTESTED",
    CLASSIFICATION_PENDING:
      "NOT AVAILABLE — research classification needs regime, news and validated strategies, which are not built yet",
    FREQUENCY_EOD: "End-of-day (daily bars)",
    DISCLAIMER:
      "Research and paper trading only. Not financial advice. This tool is not a SEBI-registered research analyst or investment adviser.",
  };

  // ---------------------------------------------------------------- dates
  const dayMs = 864e5;
  const toDay = (s) => Math.round(Date.parse(s + "T00:00:00Z") / dayMs); // days since epoch
  const fromDay = (d) => new Date(d * dayMs).toISOString().slice(0, 10);
  const weekday = (d) => (new Date(d * dayMs).getUTCDay() + 6) % 7; // Mon=0

  // -------------------------------------------------------- normalisation
  const ABNORMAL_MOVE = 0.2;
  const EOD_READY_MIN = 18 * 60; // 18:00 IST

  function normalizeBars(rows) {
    const issues = [];
    const add = (date, field, problem) => issues.push({ date, field, problem });
    const num = (v) => (v === null || v === undefined || v === "" ? NaN_ : Number(v));
    const byDate = new Map();
    for (const r of rows || []) {
      if (!r || !r.date) continue;
      const d = String(r.date).slice(0, 10);
      if (byDate.has(d)) add(d, "date", "duplicate bar; later row kept");
      byDate.set(d, r);
    }
    const dates = [...byDate.keys()].sort();
    const bars = [];
    for (const d of dates) {
      const r = byDate.get(d);
      const b = { date: d, open: num(r.open), high: num(r.high), low: num(r.low), close: num(r.close), raw_close: num(r.raw_close), volume: num(r.volume) };
      let bad = false;
      for (const f of ["open", "high", "low", "close"]) {
        if (!isNum(b[f]) || b[f] <= 0) { add(d, f, "missing or non-positive price; bar dropped"); bad = true; }
      }
      if (!bad && b.high < Math.max(b.open, b.close) - 1e-9) { add(d, "high", "high is below open or close; bar dropped"); bad = true; }
      if (!bad && b.low > Math.min(b.open, b.close) + 1e-9) { add(d, "low", "low is above open or close; bar dropped"); bad = true; }
      if (!isNum(b.volume) || b.volume < 0) {
        if (!bad) add(d, "volume", "missing or negative volume; kept, volume treated as unknown");
        b.volume = NaN_;
      }
      if (!bad) bars.push(b);
    }
    for (let i = 1; i < bars.length; i++) {
      if (Math.abs(bars[i].close / bars[i - 1].close - 1) > ABNORMAL_MOVE) {
        add(bars[i].date, "close", `close moved more than ${ABNORMAL_MOVE * 100}% in one session; check for a corporate action`);
      }
    }
    return { bars, issues };
  }

  function resampleWeekly(bars) {
    const out = [];
    let cur = null;
    for (const b of bars) {
      const d = toDay(b.date);
      const key = d + ((4 - weekday(d) + 7) % 7); // week ending Friday
      if (!cur || cur.key !== key) {
        cur = { key, date: b.date, open: b.open, high: b.high, low: b.low, close: b.close, raw_close: b.raw_close, volume: isNum(b.volume) ? b.volume : NaN_ };
        out.push(cur);
      } else {
        cur.date = b.date;
        cur.high = Math.max(cur.high, b.high);
        cur.low = Math.min(cur.low, b.low);
        cur.close = b.close;
        cur.raw_close = b.raw_close;
        if (isNum(b.volume)) cur.volume = isNum(cur.volume) ? cur.volume + b.volume : b.volume;
      }
    }
    return out.map(({ key, ...rest }) => rest);
  }

  /** nowIst: {date: "YYYY-MM-DD", minutes: minutes past midnight IST}.
   *  sessions: Set of trading dates, valid up to calendarEnd. */
  function freshness(lastBar, nowIst, sessions, calendarEnd) {
    const end = sessions && sessions.size ? toDay(calendarEnd || [...sessions].sort().at(-1)) : null;
    const covers = (d) => end !== null && d <= end;
    const isSession = (d) => (covers(d) ? sessions.has(fromDay(d)) : weekday(d) < 5);
    let day = toDay(nowIst.date);
    if (nowIst.minutes < EOD_READY_MIN) day -= 1;
    let expected = null;
    for (let k = 0; k < 30; k++, day--) {
      if (isSession(day)) { expected = day; break; }
    }
    const basis = expected !== null && covers(expected) ? "exchange calendar" : "weekdays (calendar not fetched for this date)";
    if (!lastBar) return { status: "NO_DATA", last_bar: null, expected_session: fromDay(expected), sessions_behind: null, calendar_basis: basis, usable_for_signals: false };
    let behind = 0;
    for (let d = toDay(lastBar) + 1; d <= expected; d++) behind += isSession(d) ? 1 : 0;
    const status = behind === 0 ? "CURRENT" : behind === 1 ? "ONE_SESSION_BEHIND" : "STALE";
    return { status, last_bar: lastBar, expected_session: fromDay(expected), sessions_behind: behind, calendar_basis: basis, usable_for_signals: behind <= 1 };
  }

  function nowIst(date = new Date()) {
    const t = new Date(date.getTime() + 330 * 60000);
    return { date: t.toISOString().slice(0, 10), minutes: t.getUTCHours() * 60 + t.getUTCMinutes(), iso: t.toISOString().slice(0, 16).replace("T", " ") + " IST" };
  }

  // ------------------------------------------------------------ indicators
  const IND_VERSION = "indicators-v1";

  function sma(s, n) {
    const out = nan(s.length);
    for (let i = n - 1; i < s.length; i++) {
      let sum = 0, ok = true;
      for (let j = i - n + 1; j <= i; j++) { if (!isNum(s[j])) { ok = false; break; } sum += s[j]; }
      if (ok) out[i] = sum / n;
    }
    return out;
  }

  function seeded(s, n, step) {
    const out = nan(s.length);
    const start = s.findIndex(isNum);
    if (start < 0 || s.length - start < n) return out;
    const seedEnd = start + n - 1;
    let prev = 0;
    for (let j = start; j <= seedEnd; j++) prev += s[j];
    prev /= n;
    out[seedEnd] = prev;
    for (let i = seedEnd + 1; i < s.length; i++) { prev = step(prev, s[i]); out[i] = prev; }
    return out;
  }
  const ema = (s, n) => { const a = 2 / (n + 1); return seeded(s, n, (p, x) => a * x + (1 - a) * p); };
  const wilder = (s, n) => seeded(s, n, (p, x) => p + (x - p) / n);
  const diff = (s) => s.map((v, i) => (i === 0 ? NaN_ : v - s[i - 1]));

  function rsi(close, n = 14) {
    const d = diff(close);
    const g = wilder(d.map((v) => (isNum(v) ? Math.max(v, 0) : NaN_)), n);
    const l = wilder(d.map((v) => (isNum(v) ? Math.max(-v, 0) : NaN_)), n);
    return g.map((gv, i) => {
      const lv = l[i];
      if (!isNum(gv) || !isNum(lv)) return NaN_;
      if (lv === 0) return gv > 0 ? 100 : 50;
      return 100 - 100 / (1 + gv / lv);
    });
  }

  function macd(close, fast = 12, slow = 26, signal = 9) {
    const f = ema(close, fast), s = ema(close, slow);
    const line = f.map((v, i) => v - s[i]);
    const sig = ema(line, signal);
    return { macd: line, macd_signal: sig, macd_hist: line.map((v, i) => v - sig[i]) };
  }

  function trueRange(b) {
    return b.map((x, i) => {
      if (i === 0) return x.high - x.low;
      const pc = b[i - 1].close;
      return Math.max(x.high - x.low, Math.abs(x.high - pc), Math.abs(x.low - pc));
    });
  }
  const atr = (b, n = 14) => wilder(trueRange(b), n);

  function adx(b, n = 14) {
    const pdm = nan(b.length), mdm = nan(b.length), tr = trueRange(b);
    tr[0] = NaN_;
    for (let i = 1; i < b.length; i++) {
      const up = b[i].high - b[i - 1].high, down = b[i - 1].low - b[i].low;
      pdm[i] = up > down && up > 0 ? up : 0;
      mdm[i] = down > up && down > 0 ? down : 0;
    }
    const a = wilder(tr, n), sp = wilder(pdm, n), sm = wilder(mdm, n);
    const pdi = sp.map((v, i) => (100 * v) / a[i]);
    const mdi = sm.map((v, i) => (100 * v) / a[i]);
    const dx = pdi.map((v, i) => (100 * Math.abs(v - mdi[i])) / (v + mdi[i]));
    return { plus_di: pdi, minus_di: mdi, adx: wilder(dx, n) };
  }

  function rollingStd(s, n, ddof) {
    const out = nan(s.length);
    for (let i = n - 1; i < s.length; i++) {
      const w = s.slice(i - n + 1, i + 1);
      if (!w.every(isNum)) continue;
      const m = w.reduce((a, c) => a + c, 0) / n;
      out[i] = Math.sqrt(w.reduce((a, c) => a + (c - m) ** 2, 0) / (n - ddof));
    }
    return out;
  }

  function bollinger(close, n = 20, k = 2) {
    const mid = sma(close, n), sd = rollingStd(close, n, 0);
    return { bb_mid: mid, bb_upper: mid.map((m, i) => m + k * sd[i]), bb_lower: mid.map((m, i) => m - k * sd[i]) };
  }

  function rollMin(s, n) { const o = nan(s.length); for (let i = n - 1; i < s.length; i++) o[i] = Math.min(...s.slice(i - n + 1, i + 1)); return o; }
  function rollMax(s, n) { const o = nan(s.length); for (let i = n - 1; i < s.length; i++) o[i] = Math.max(...s.slice(i - n + 1, i + 1)); return o; }

  function stochastic(b, n = 14, smoothK = 3, d = 3) {
    const lo = rollMin(b.map((x) => x.low), n), hi = rollMax(b.map((x) => x.high), n);
    const raw = b.map((x, i) => (100 * (x.close - lo[i])) / (hi[i] - lo[i]));
    const k = sma(raw, smoothK);
    return { stoch_k: k, stoch_d: sma(k, d) };
  }

  const roc = (c, n = 12) => c.map((v, i) => (i < n ? NaN_ : 100 * (v / c[i - n] - 1)));

  function obv(b) {
    let acc = 0;
    return b.map((x, i) => {
      if (i > 0) acc += Math.sign(x.close - b[i - 1].close) * (isNum(x.volume) ? x.volume : 0);
      return acc;
    });
  }

  function histVol(c, n = 20) {
    const r = c.map((v, i) => (i === 0 ? NaN_ : Math.log(v / c[i - 1])));
    return rollingStd(r, n, 1).map((v) => 100 * v * Math.sqrt(252));
  }

  function rollingMedian(s, n) {
    const out = nan(s.length);
    for (let i = n - 1; i < s.length; i++) {
      const w = s.slice(i - n + 1, i + 1);
      if (!w.every(isNum)) continue;
      w.sort((a, b) => a - b);
      out[i] = n % 2 ? w[(n - 1) / 2] : (w[n / 2 - 1] + w[n / 2]) / 2;
    }
    return out;
  }

  function computeAll(b) {
    const c = b.map((x) => x.close), v = b.map((x) => x.volume);
    const o = {};
    for (const n of [20, 50, 100, 200]) o["sma" + n] = sma(c, n);
    for (const n of [20, 50, 200]) o["ema" + n] = ema(c, n);
    Object.assign(o, macd(c), adx(b));
    o.rsi14 = rsi(c);
    Object.assign(o, stochastic(b));
    o.roc12 = roc(c);
    o.atr14 = atr(b);
    o.atr_pct = o.atr14.map((a, i) => (100 * a) / c[i]);
    Object.assign(o, bollinger(c));
    o.hv20 = histVol(c, 20);
    o.hv60 = histVol(c, 60);
    o.vol_sma20 = sma(v, 20);
    o.rel_volume = v.map((x, i) => x / o.vol_sma20[i]);
    o.obv = obv(b);
    o.traded_value_cr_median20 = rollingMedian(b.map((x) => x.close * x.volume), 20).map((x) => x / 1e7);
    return o;
  }
  const latest = (ind) => Object.fromEntries(Object.entries(ind).map(([k, arr]) => [k, isNum(arr.at(-1)) ? arr.at(-1) : null]));

  // --------------------------------------------------------------- swings
  function findSwings(b, k = 5) {
    const raw = [];
    for (let i = k; i < b.length - k; i++) {
      let lh = -Infinity, rh = -Infinity, ll = Infinity, rl = Infinity;
      for (let j = i - k; j < i; j++) { lh = Math.max(lh, b[j].high); ll = Math.min(ll, b[j].low); }
      for (let j = i + 1; j <= i + k; j++) { rh = Math.max(rh, b[j].high); rl = Math.min(rl, b[j].low); }
      if (b[i].high > lh && b[i].high >= rh) raw.push({ idx: i, date: b[i].date, price: b[i].high, kind: "H", confirmed_idx: i + k });
      if (b[i].low < ll && b[i].low <= rl) raw.push({ idx: i, date: b[i].date, price: b[i].low, kind: "L", confirmed_idx: i + k });
    }
    raw.sort((a, c) => a.idx - c.idx || (a.kind < c.kind ? -1 : a.kind > c.kind ? 1 : 0));
    const merged = [];
    for (const s of raw) {
      const prev = merged.at(-1);
      if (prev && prev.kind === s.kind) {
        if (s.kind === "H" ? s.price > prev.price : s.price < prev.price) merged[merged.length - 1] = s;
      } else merged.push(s);
    }
    return merged;
  }

  // ------------------------------------------------------------- breakout
  const BREAKOUT = { RULES_VERSION: "breakout-v1", MIN_DISTANCE_PCT: 0.02, MIN_DISTANCE_ATR: 1.0, CLOSES_REQUIRED: 2, VOLUME_MULT: 1.5, CONFIRM_WINDOW: 3, RETURN_WINDOW: 5 };

  function evaluateBreakout(b, ind, startIdx, level, direction, invalidation) {
    const B = BREAKOUT, n = b.length, sign = direction === "up" ? 1 : -1;
    const close = b.map((x) => x.close);
    let first = null;
    for (let i = startIdx; i < n; i++) {
      if (invalidation !== null && invalidation !== undefined && sign * (close[i] - invalidation) < 0) {
        return { status: "INVALIDATED", breakout_date: null, checks: {}, notes: [`Closed ${sign > 0 ? "below" : "above"} the invalidation level ${invalidation.toFixed(2)} on ${b[i].date} before any breakout.`], rules_version: B.RULES_VERSION };
      }
      if (sign * (close[i] - level(i)) > 0) { first = i; break; }
    }
    if (first === null) return { status: "NO_BREAKOUT", breakout_date: null, checks: {}, notes: ["No close beyond the boundary yet."], rules_version: B.RULES_VERSION };

    const win = [];
    for (let j = first; j < Math.min(n, first + B.CONFIRM_WINDOW); j++) win.push(j);
    let dist = null;
    for (const j of win) {
      const lvl = level(j);
      let need = B.MIN_DISTANCE_PCT * lvl;
      if (isNum(ind.atr14[j])) need = Math.min(need, B.MIN_DISTANCE_ATR * ind.atr14[j]);
      if (sign * (close[j] - lvl) >= need) { dist = true; break; }
      dist = false;
    }
    if (dist === false && win.length < B.CONFIRM_WINDOW) dist = null;
    const checks = { distance: dist };
    const after = [];
    for (let j = first; j < Math.min(n, first + B.CLOSES_REQUIRED); j++) after.push(j);
    checks.multiple_closes = after.length < B.CLOSES_REQUIRED ? null : after.every((j) => sign * (close[j] - level(j)) > 0);
    const ratios = win.filter((j) => isNum(b[j].volume) && isNum(ind.vol_sma20[j]) && ind.vol_sma20[j] > 0).map((j) => b[j].volume / ind.vol_sma20[j]);
    checks.volume = ratios.length ? Math.max(...ratios) >= B.VOLUME_MULT : null;

    const res = { status: "POSSIBLE_BREAKOUT", breakout_date: b[first].date, checks, notes: [], rules_version: B.RULES_VERSION };
    for (let j = first + 1; j < Math.min(n, first + 1 + B.RETURN_WINDOW); j++) {
      if (sign * (close[j] - level(j)) <= 0) {
        res.status = "FALSE_BREAKOUT_RISK";
        res.notes.push(`Closed back inside the boundary on ${b[j].date}.`);
        return res;
      }
    }
    if (Object.values(checks).every((v) => v === true)) res.status = "BREAKOUT";
    else res.notes.push("Not yet confirmed: " + Object.entries(checks).filter(([, v]) => v !== true).map(([k]) => k).join(", ") + ".");
    return res;
  }

  // ------------------------------------------------------------- patterns
  const P = { RULES_VERSION: "patterns-v1", SWING_K: 5, PEAK_TOL: 0.03, SHOULDER_TOL: 0.05, MIN_SEPARATION: 10, MIN_DEPTH_ATR: 1.0, RECT_BAND: 0.03, RECT_MIN_HEIGHT_ATR: 2.0, RECT_MAX_HEIGHT: 0.2, LOOKBACK_BARS: 120 };
  const CATALOGUE = {
    "Double Top": true, "Double Bottom": true, "Triple Top": true, "Triple Bottom": true,
    "Head and Shoulders": true, "Inverse Head and Shoulders": true, Rectangle: true,
    "Ascending Triangle": false, "Descending Triangle": false, "Symmetrical Triangle": false,
    "Rising Wedge": false, "Falling Wedge": false, Flag: false, Pennant: false, "Cup and Handle": false,
    Gap: false, "Narrow Range (NR4/NR7)": false, "Pipe Bottom": false,
  };
  const STAGE = { NO_BREAKOUT: "CANDIDATE", POSSIBLE_BREAKOUT: "DEVELOPING", BREAKOUT: "CONFIRMED", FALSE_BREAKOUT_RISK: "FAILED", INVALIDATED: "FAILED" };
  const r2 = (v) => (v === null || v === undefined ? null : Math.round(v * 100) / 100);
  const pt = (s, label) => ({ date: s.date, price: r2(s.price), label });
  const within = (a, c, tol) => Math.abs(a - c) / Math.max(a, c) <= tol;
  const pct = (v) => (v * 100).toFixed(1) + "%";

  function build(b, ind, name, family, bias, tf, points, boundary, level, direction, startIdx, invalidation, target, reasons) {
    const br = evaluateBreakout(b, ind, startIdx, level, direction, invalidation);
    const stage = STAGE[br.status];
    return {
      name, family, bias, timeframe: tf, points, boundary,
      formation_start: points[0].date, formation_end: points.at(-1).date,
      breakout_level: r2(level(b.length - 1)),
      invalidation_level: r2(invalidation),
      stage, breakout: br,
      volume_confirmation: br.checks.volume ?? null,
      target_textbook: r2(target),
      target_note: "Textbook measured move from the reference; not validated by backtest.",
      historical_reliability: LABELS.NOT_BACKTESTED,
      confidence: stage === "CONFIRMED" ? "medium" : "low",
      reasons: reasons.concat(br.notes),
      rules_version: `${P.RULES_VERSION}/${BREAKOUT.RULES_VERSION}`,
      label: LABELS.CALCULATED,
    };
  }

  function doubles(b, ind, sw, tf) {
    const out = [];
    for (let i = 0; i + 2 < sw.length; i++) {
      const [a, m, c] = [sw[i], sw[i + 1], sw[i + 2]];
      const top = a.kind === "H";
      if (c.idx - a.idx < P.MIN_SEPARATION || !within(a.price, c.price, P.PEAK_TOL)) continue;
      const atrv = ind.atr14[m.idx];
      const extreme = top ? Math.max(a.price, c.price) : Math.min(a.price, c.price);
      const depth = top ? Math.min(a.price, c.price) - m.price : m.price - Math.max(a.price, c.price);
      if (!isNum(atrv) || depth < P.MIN_DEPTH_ATR * atrv) continue;
      const neck = m.price, height = Math.abs(extreme - neck), label = top ? "peak" : "trough";
      out.push(build(b, ind, top ? "Double Top" : "Double Bottom", "reversal", top ? "bearish" : "bullish", tf,
        [pt(a, `${label} 1`), pt(m, "neckline"), pt(c, `${label} 2`)], { neckline: r2(neck) },
        () => neck, top ? "down" : "up", c.confirmed_idx, extreme, top ? neck - height : neck + height,
        [
          `Two ${label}s ${pct(Math.abs(a.price - c.price) / Math.max(a.price, c.price))} apart, ${c.idx - a.idx} bars between them.`,
          `Middle ${top ? "trough" : "peak"} ${depth.toFixed(2)} (${(depth / atrv).toFixed(1)} ATR) from the nearer ${label}.`,
          `Neckline at ${neck.toFixed(2)}; the pattern completes only on a close ${top ? "below" : "above"} it.`,
        ]));
    }
    return out;
  }

  function fivePoint(b, ind, sw, tf) {
    const out = [];
    for (let i = 0; i + 4 < sw.length; i++) {
      const [a, bb, c, d, e] = sw.slice(i, i + 5);
      const top = a.kind === "H";
      const atrv = ind.atr14[c.idx];
      if (!isNum(atrv)) continue;
      const shoulder = top ? Math.max(a.price, e.price) : Math.min(a.price, e.price);
      const headGap = top ? c.price - shoulder : shoulder - c.price;
      if (headGap >= P.MIN_DEPTH_ATR * atrv && within(a.price, e.price, P.SHOULDER_TOL)) {
        const slope = (d.price - bb.price) / (d.idx - bb.idx);
        const line = (k) => bb.price + slope * (k - bb.idx);
        const height = Math.abs(c.price - line(c.idx));
        const last = b.length - 1;
        out.push(build(b, ind, top ? "Head and Shoulders" : "Inverse Head and Shoulders", "reversal", top ? "bearish" : "bullish", tf,
          [pt(a, "left shoulder"), pt(bb, "neckline"), pt(c, "head"), pt(d, "neckline"), pt(e, "right shoulder")],
          { neckline_start: r2(line(bb.idx)), neckline_now: r2(line(last)), slope_per_bar: Math.round(slope * 1e4) / 1e4 },
          line, top ? "down" : "up", e.confirmed_idx, e.price, top ? line(last) - height : line(last) + height,
          [
            `Head ${headGap.toFixed(2)} (${(headGap / atrv).toFixed(1)} ATR) beyond the ${top ? "higher" : "lower"} shoulder.`,
            `Shoulders ${pct(Math.abs(a.price - e.price) / Math.max(a.price, e.price))} apart.`,
            `Neckline drawn through ${bb.date} and ${d.date}.`,
          ]));
        continue;
      }
      const peaks = [a.price, c.price, e.price];
      if (Math.max(...peaks) / Math.min(...peaks) - 1 > P.PEAK_TOL || e.idx - a.idx < 2 * P.MIN_SEPARATION) continue;
      const neck = top ? Math.min(bb.price, d.price) : Math.max(bb.price, d.price);
      const extreme = top ? Math.max(...peaks) : Math.min(...peaks);
      if (Math.abs(extreme - neck) < P.MIN_DEPTH_ATR * atrv) continue;
      const height = Math.abs(extreme - neck), label = top ? "peak" : "trough";
      out.push(build(b, ind, top ? "Triple Top" : "Triple Bottom", "reversal", top ? "bearish" : "bullish", tf,
        [pt(a, `${label} 1`), pt(bb, "reaction"), pt(c, `${label} 2`), pt(d, "reaction"), pt(e, `${label} 3`)],
        { breakout_line: r2(neck) }, () => neck, top ? "down" : "up", e.confirmed_idx, extreme,
        top ? neck - height : neck + height,
        [
          `Three ${label}s within ${pct(Math.max(...peaks) / Math.min(...peaks) - 1)} of each other.`,
          `Breakout line at the ${top ? "lower" : "higher"} intervening ${top ? "trough" : "peak"}, ${neck.toFixed(2)}.`,
        ]));
    }
    return out;
  }

  function rectangles(b, ind, sw, tf) {
    const found = [];
    for (let size = 8; size > 3; size--) {
      for (let s = 0; s + size <= sw.length; s++) {
        const win = sw.slice(s, s + size);
        const hs = win.filter((w) => w.kind === "H").map((w) => w.price);
        const ls = win.filter((w) => w.kind === "L").map((w) => w.price);
        if (hs.length < 2 || ls.length < 2) continue;
        if (Math.max(...hs) / Math.min(...hs) - 1 > P.RECT_BAND || Math.max(...ls) / Math.min(...ls) - 1 > P.RECT_BAND) continue;
        const top = Math.max(...hs), bot = Math.min(...ls), atrv = ind.atr14[win.at(-1).idx], height = top - bot;
        if (!isNum(atrv) || height < P.RECT_MIN_HEIGHT_ATR * atrv || height / top > P.RECT_MAX_HEIGHT) continue;
        const span = [win[0].idx, win.at(-1).idx];
        if (found.some(([f]) => f[0] <= span[0] && span[1] <= f[1])) continue;
        const lastConf = Math.max(...win.map((w) => w.confirmed_idx));
        const up = evaluateBreakout(b, ind, lastConf, () => top, "up", null);
        const down = evaluateBreakout(b, ind, lastConf, () => bot, "down", null);
        let direction, level, target, invalid;
        if (up.breakout_date && (!down.breakout_date || up.breakout_date <= down.breakout_date)) [direction, level, target, invalid] = ["up", top, top + height, bot];
        else if (down.breakout_date) [direction, level, target, invalid] = ["down", bot, bot - height, top];
        else [direction, level, target, invalid] = ["up", top, null, null];
        const p = build(b, ind, "Rectangle", "continuation", "either", tf,
          win.map((w) => pt(w, w.kind === "H" ? "resistance touch" : "support touch")),
          { resistance: r2(top), support: r2(bot) }, () => level, direction, lastConf, invalid, target,
          [
            `${hs.length} touches near resistance ${top.toFixed(2)} and ${ls.length} near support ${bot.toFixed(2)}.`,
            `Range height ${height.toFixed(2)} (${(height / atrv).toFixed(1)} ATR).`,
            "Rectangles often have false breakouts, so confirmation matters (reference, p. 23).",
          ]);
        if (target === null) p.boundary.note = "No breakout in either direction yet.";
        found.push([span, p]);
      }
    }
    return found.map(([, p]) => p);
  }

  function detectPatterns(b, ind, tf = "daily") {
    if (b.length < 60) return [];
    const sw = findSwings(b, P.SWING_K);
    const cutoff = b[Math.max(0, b.length - P.LOOKBACK_BARS)].date;
    const pats = fivePoint(b, ind, sw, tf);
    const covered = new Set(pats.filter((p) => p.name.startsWith("Triple")).flatMap((p) => p.points.map((q) => q.date)));
    for (const p of doubles(b, ind, sw, tf)) {
      if (covered.has(p.points[0].date) && covered.has(p.points.at(-1).date)) continue;
      pats.push(p);
    }
    pats.push(...rectangles(b, ind, sw, tf));
    const order = { CONFIRMED: 0, DEVELOPING: 1, CANDIDATE: 2, FAILED: 3 };
    return pats
      .filter((p) => p.formation_end >= cutoff)
      .sort((x, y) => (x.formation_end < y.formation_end ? 1 : x.formation_end > y.formation_end ? -1 : 0))
      .sort((x, y) => order[x.stage] - order[y.stage]);
  }

  // -------------------------------------------------------------- candles
  const C = { RULES_VERSION: "candles-v1", DOJI_BODY: 0.1, LONG_SHADOW: 2.0, SMALL_SHADOW: 0.25, TREND_BARS: 10, ZONE_ATR: 1.0 };

  function shapes(o, h, l, c, po, pc) {
    const rng = h - l;
    if (rng <= 0) return [];
    const body = Math.abs(c - o), upper = h - Math.max(o, c), lower = Math.min(o, c) - l;
    const out = [];
    if (body <= C.DOJI_BODY * rng) out.push(["Doji", "neutral"]);
    else if (lower >= C.LONG_SHADOW * body && upper <= C.SMALL_SHADOW * rng) out.push(["Hammer-shape", "depends"]);
    else if (upper >= C.LONG_SHADOW * body && lower <= C.SMALL_SHADOW * rng) out.push(["Shooting-star-shape", "depends"]);
    const pbody = Math.abs(pc - po), prevBear = pc < po, prevBull = pc > po;
    if (prevBear && c > o && o <= pc && c >= po && body > pbody) out.push(["Bullish Engulfing", "bullish"]);
    if (prevBull && c < o && o >= pc && c <= po && body > pbody) out.push(["Bearish Engulfing", "bearish"]);
    if (pbody > 0 && body < pbody && Math.max(o, c) <= Math.max(po, pc) && Math.min(o, c) >= Math.min(po, pc)) {
      out.push(prevBear ? ["Bullish Harami", "bullish"] : ["Bearish Harami", "bearish"]);
    }
    const mid = (po + pc) / 2;
    if (prevBull && c < o && o > pc && c < mid && c > po) out.push(["Dark Cloud Cover", "bearish"]);
    if (prevBear && c > o && o < pc && c > mid && c < po) out.push(["Piercing Line", "bullish"]);
    return out;
  }

  function detectCandles(b, ind, lastN = 20, weeklyTrend = null) {
    if (b.length < C.TREND_BARS + 2) return [];
    const swings = findSwings(b);
    const out = [];
    for (let i = Math.max(C.TREND_BARS + 1, b.length - lastN); i < b.length; i++) {
      const x = b[i], p = b[i - 1];
      const prior = p.close / b[i - 1 - C.TREND_BARS].close - 1;
      const trend = prior > 0.03 ? "up" : prior < -0.03 ? "down" : "sideways";
      for (let [name, bias] of shapes(x.open, x.high, x.low, x.close, p.open, p.close)) {
        if (name === "Hammer-shape") {
          if (trend === "down") [name, bias] = ["Hammer", "bullish"];
          else if (trend === "up") [name, bias] = ["Hanging Man", "bearish"];
          else continue;
        }
        if (name === "Shooting-star-shape") {
          if (trend === "up") [name, bias] = ["Shooting Star", "bearish"];
          else if (trend === "down") [name, bias] = ["Inverted Hammer", "bullish"];
          else continue;
        }
        const known = swings.filter((s) => s.confirmed_idx <= i);
        let zone = null;
        if (isNum(ind.atr14[i])) {
          const kind = bias === "bullish" ? "L" : bias === "bearish" ? "H" : null;
          const ref = bias === "bullish" ? x.low : x.high;
          zone = known.some((s) => (kind === null || s.kind === kind) && Math.abs(s.price - ref) <= C.ZONE_ATR * ind.atr14[i]);
        }
        const volOk = !isNum(x.volume) || !isNum(ind.vol_sma20[i]) ? null : x.volume >= ind.vol_sma20[i];
        let nxt = null;
        if (i + 1 < b.length) nxt = bias === "bullish" ? b[i + 1].close > x.high : bias === "bearish" ? b[i + 1].close < x.low : null;
        const trendFit = bias === "bullish" ? trend === "down" : bias === "bearish" ? trend === "up" : null;
        const weeklyFit = weeklyTrend && (bias === "bullish" || bias === "bearish") ? (weeklyTrend === "up") === (bias === "bullish") : null;
        const context = {
          preceding_trend: trend, fits_preceding_trend: trendFit, near_support_or_resistance: zone,
          volume_above_average: volOk, next_candle_confirmed: nxt, agrees_with_weekly_trend: weeklyFit,
        };
        const score = Object.values(context).filter((v) => v === true).length;
        const weight = score >= 4 ? "context-supported" : score >= 2 ? "some context" : "isolated (low weight)";
        out.push({ date: x.date, name, bias, context, weight, rules_version: C.RULES_VERSION, label: LABELS.CALCULATED, reliability: LABELS.NOT_BACKTESTED });
      }
    }
    return out;
  }

  function weeklyTrend(b) {
    const w = resampleWeekly(b);
    if (w.length < 24) return null;
    const s = sma(w.map((x) => x.close), 20);
    if (!isNum(s.at(-1)) || !isNum(s.at(-5))) return null;
    const rising = s.at(-1) > s.at(-5), last = w.at(-1).close;
    if (last > s.at(-1) && rising) return "up";
    if (last < s.at(-1) && !rising) return "down";
    return "sideways";
  }

  const NSE = {
    LABELS, IND_VERSION, BREAKOUT, PATTERNS: P, CANDLES: C, CATALOGUE,
    normalizeBars, resampleWeekly, freshness, nowIst,
    sma, ema, wilder, rsi, macd, atr, adx, bollinger, stochastic, roc, obv, histVol, computeAll, latest,
    findSwings, evaluateBreakout, detectPatterns, detectCandles, weeklyTrend,
  };
  root.NSE = NSE;
  if (typeof module !== "undefined" && module.exports) module.exports = NSE;
})(typeof window !== "undefined" ? window : globalThis);
