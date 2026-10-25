// Compares artifact/engine.js with the Python engine on exported cases.
// Usage: python tests/export_engine_cases.py cases.json && node artifact/compare_engine.js cases.json
const fs = require("fs");
const NSE = require("./engine.js");
const cases = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
let failures = 0, checks = 0;
const fail = (c, what, a, b) => { failures++; if (failures < 40) console.log(`[${c}] ${what}: py=${JSON.stringify(a)} js=${JSON.stringify(b)}`); };
const close = (a, b) => (a === null ? b === null || Number.isNaN(b) : typeof b === "number" && Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a)));
const pick = (p) => ({ name: p.name, stage: p.stage, start: p.formation_start, end: p.formation_end, bl: p.breakout_level, inv: p.invalidation_level, tgt: p.target_textbook, status: p.breakout.status, bdate: p.breakout.breakout_date, checks: p.breakout.checks, conf: p.confidence, reasons: p.reasons, boundary: p.boundary });
for (const c of cases) {
  const { bars, issues } = NSE.normalizeBars(c.bars);
  if (bars.length !== c.bars.length) fail(c.name, "normalize dropped bars", c.bars.length, bars.length, issues);
  const ind = NSE.computeAll(bars);
  for (const [k, arr] of Object.entries(c.indicators)) {
    if (!ind[k]) { fail(c.name, "missing indicator " + k); continue; }
    for (let i = 0; i < arr.length; i++) { checks++; if (!close(arr[i], ind[k][i])) { fail(c.name, `${k}[${i}]`, arr[i], ind[k][i]); break; } }
  }
  const sw = NSE.findSwings(bars).map((s) => [s.idx, s.kind, s.price]);
  const psw = c.swings.map((s) => [s.idx, s.kind, s.price]);
  checks++; if (JSON.stringify(sw) !== JSON.stringify(psw)) fail(c.name, "swings", psw.length, sw.length);
  const pats = NSE.detectPatterns(bars, ind).map(pick), ppats = c.patterns.map(pick);
  checks++; if (JSON.stringify(pats) !== JSON.stringify(ppats)) fail(c.name, "patterns", ppats, pats);
  const wt = NSE.weeklyTrend(bars);
  checks++; if (wt !== c.weekly_trend) fail(c.name, "weekly trend", c.weekly_trend, wt);
  const wk = NSE.resampleWeekly(bars).map((w) => [w.date, w.close]);
  checks++; if (JSON.stringify(wk) !== JSON.stringify(c.weekly.map((w) => [w.date, w.close]))) fail(c.name, "weekly bars", c.weekly.length, wk.length);
  const cd = NSE.detectCandles(bars, ind, 20, wt).map((x) => [x.date, x.name, x.bias, x.weight, x.context]);
  const pcd = c.candles.map((x) => [x.date, x.name, x.bias, x.weight, x.context]);
  checks++; if (JSON.stringify(cd) !== JSON.stringify(pcd)) fail(c.name, "candles", pcd, cd);
  console.log(`${c.name}: ${ppats.length} patterns, ${pcd.length} candles`);
}
console.log(`${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
