/* ==========================================================================
   SANSKAAR — Illustrated previews
   Draws garment previews (front / back / side / detail) and Rajasthani
   scenery as inline SVG. Used wherever a real photo has not been added yet.
   ========================================================================== */

(function () {
  let uidCounter = 0;
  const uid = () => "a" + (++uidCounter).toString(36) + Math.random().toString(36).slice(2, 6);

  function hexToRgb(h) {
    h = h.replace("#", "");
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  }
  // amt > 0 lightens towards white, amt < 0 darkens towards black
  function shade(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
  }
  function luminance(hex) {
    const [r, g, b] = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  const SKIN = "#e9dcc7"; // ghost-mannequin form

  /* ---------- Garment shape library (viewBox 0 0 300 400) ---------- */
  // Each layer: { d, fill: main|second|accent|skin|dupatta, pat?, front?, back?, stroke? }
  const M_SLEEVES = [
    { d: "M96,84 L78,98 L68,236 L88,238 L100,130 Z", fill: "main", pat: 1 },
    { d: "M204,84 L222,98 L232,236 L212,238 L200,130 Z", fill: "main", pat: 1 },
    { d: "M68,222 L88,224 L88,238 L68,236 Z", fill: "accent", band: 1 },
    { d: "M212,224 L232,222 L232,236 L212,238 Z", fill: "accent", band: 1 }
  ];
  const NECK = [
    { d: "M138,36 L162,36 L163,64 L137,64 Z", fill: "skin" },
    { d: "M138,36 Q150,30 162,36 Q150,42 138,36 Z", fill: "skinDark" }
  ];
  const MANDARIN = { d: "M133,56 L167,56 L169,72 Q150,80 131,72 Z", fill: "main", stroke: "accent" };
  const W_NECK = [
    { d: "M140,40 L160,40 L162,74 L138,74 Z", fill: "skin" },
    { d: "M140,40 Q150,35 160,40 Q150,45 140,40 Z", fill: "skinDark" }
  ];

  function buttons(x, y0, y1, n, r) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const y = y0 + (y1 - y0) * (i / Math.max(1, n - 1));
      out.push({ circle: [x, y, r || 2.8], fill: "accent", front: 1 });
    }
    return out;
  }
  function placket(x, y0, y1) { return { line: [x, y0, x, y1], stroke: "accent", w: 1.6, front: 1 }; }
  function kalis(cx, y0, xs, y1) {
    return xs.map(x => ({ line: [cx + (x - cx) * 0.12, y0, x, y1], stroke: "fold", w: 1.2 }));
  }
  function dupattaFront() {
    return [
      { d: "M104,82 L124,76 Q176,170 216,252 L196,264 Q156,184 104,82 Z", fill: "dupatta", front: 1, edge: 1 },
      { d: "M102,86 L88,92 L72,334 L94,336 Z", fill: "dupatta", edge: 1 }
    ];
  }
  function blouseBackTie() {
    return [
      { line: [142, 96, 136, 132], stroke: "accent", w: 1.4, back: 1 },
      { line: [158, 96, 164, 132], stroke: "accent", w: 1.4, back: 1 },
      { circle: [136, 134, 3.4], fill: "accent", back: 1 },
      { circle: [164, 134, 3.4], fill: "accent", back: 1 }
    ];
  }

  const SHAPES = {
    sherwani: () => [
      ...NECK, ...M_SLEEVES,
      { d: "M120,68 L96,84 L100,200 L92,322 L208,322 L200,200 L204,84 L180,68 Q150,82 120,68 Z", fill: "main", pat: 1 },
      { d: "M92,304 L208,304 L208,322 L92,322 Z", fill: "accent", band: 1 },
      { d: "M100,196 L200,196 L200,200 L100,200 Z", fill: "accent", op: .5 },
      MANDARIN,
      placket(150, 74, 322), ...buttons(150, 88, 196, 7, 2.6),
      { d: "M124,322 L130,392 L148,392 L149,322 Z", fill: "second" },
      { d: "M151,322 L152,392 L170,392 L176,322 Z", fill: "second" },
      ...[350, 360, 370, 380].map(y => ({ line: [130, y, 148, y + 2], stroke: "fold", w: 1 })),
      ...[350, 360, 370, 380].map(y => ({ line: [152, y + 2, 170, y], stroke: "fold", w: 1 })),
      { d: "M108,80 L128,74 L124,334 L104,336 Z", fill: "dupatta", front: 1, edge: 1 }
    ],
    bandhgala: () => [
      ...NECK, ...M_SLEEVES,
      { d: "M120,350 L118,300 L118,212 L182,212 L182,300 L180,350 Z", fill: "second" },
      { d: "M118,212 L122,392 L148,392 L150,226 Z", fill: "second" },
      { d: "M182,212 L178,392 L152,392 L150,226 Z", fill: "second" },
      { line: [150, 226, 150, 392], stroke: "fold", w: 1 },
      { d: "M120,68 L96,84 L100,214 L146,220 L150,214 L154,220 L200,214 L204,84 L180,68 Q150,82 120,68 Z", fill: "main", pat: 0.4 },
      MANDARIN,
      placket(150, 74, 214), ...buttons(150, 86, 200, 6, 3.4),
      { d: "M108,176 L130,176 L130,179 L108,179 Z", fill: "accent", front: 1 },
      { d: "M170,176 L192,176 L192,179 L170,179 Z", fill: "accent", front: 1 },
      { d: "M110,104 L128,104 L128,107 L110,107 Z", fill: "accent", front: 1 }
    ],
    indowestern: () => [
      ...NECK, ...M_SLEEVES,
      { d: "M116,296 L110,392 L148,392 L150,306 Z", fill: "second" },
      { d: "M184,296 L190,392 L152,392 L150,306 Z", fill: "second" },
      ...kalis(150, 300, [120, 132], 390),
      { d: "M120,68 L96,84 L100,200 L94,298 L206,298 L200,200 L204,84 L180,68 Q150,82 120,68 Z", fill: "main", pat: 0.6 },
      { d: "M166,72 L172,76 L132,298 L124,298 Z", fill: "accent", band: 1, front: 1 },
      MANDARIN,
      ...[0, 1, 2, 3, 4].map(i => ({ circle: [166 - i * 8, 92 + i * 34, 2.8], fill: "accent", front: 1 })),
      { d: "M94,284 L206,284 L206,298 L94,298 Z", fill: "accent", band: 1, op: .85 }
    ],
    kurta: () => [
      ...NECK, ...M_SLEEVES,
      { d: "M118,272 L120,392 L148,392 L150,272 Z", fill: "second" },
      { d: "M182,272 L180,392 L152,392 L150,272 Z", fill: "second" },
      ...[352, 364, 376].map(y => ({ line: [122, y, 146, y + 2], stroke: "fold", w: 1 })),
      ...[352, 364, 376].map(y => ({ line: [154, y + 2, 178, y], stroke: "fold", w: 1 })),
      { d: "M120,68 L96,84 L98,200 L92,272 L208,272 L202,200 L204,84 L180,68 Q150,82 120,68 Z", fill: "main", pat: 0.5 },
      { d: "M132,72 Q150,84 168,72 L172,150 L128,150 Z", fill: "accent", op: .25, front: 1 },
      { line: [98, 236, 96, 272], stroke: "fold", w: 1.2 }, { line: [202, 236, 204, 272], stroke: "fold", w: 1.2 },
      MANDARIN,
      placket(150, 74, 146), ...buttons(150, 86, 138, 4, 2.4),
      { d: "M92,262 L208,262 L208,272 L92,272 Z", fill: "accent", band: 1, op: .8 }
    ],
    jacket: () => [
      ...NECK,
      { d: "M96,84 L78,98 L68,236 L88,238 L100,130 Z", fill: "second" },
      { d: "M204,84 L222,98 L232,236 L212,238 L200,130 Z", fill: "second" },
      { d: "M118,272 L122,392 L148,392 L150,272 Z", fill: "second" },
      { d: "M182,272 L178,392 L152,392 L150,272 Z", fill: "second" },
      { d: "M120,68 L96,84 L98,200 L92,272 L208,272 L202,200 L204,84 L180,68 Q150,82 120,68 Z", fill: "second" },
      ...[352, 364, 376].map(y => ({ line: [124, y, 146, y + 2], stroke: "fold", w: 1 })),
      { d: "M133,56 L167,56 L169,72 Q150,80 131,72 Z", fill: "second" },
      { d: "M124,64 L150,120 L176,64 L198,80 L198,210 L102,210 L102,80 Z", fill: "main", pat: 1, front: 1 },
      { d: "M124,64 L176,64 L198,80 L198,210 L102,210 L102,80 Z", fill: "main", pat: 1, back: 1 },
      { d: "M128,64 L150,114 L172,64 L176,66 L150,124 L124,66 Z", fill: "accent", front: 1 },
      ...buttons(150, 132, 198, 5, 2.8),
      { d: "M110,166 L130,166 L130,169 L110,169 Z", fill: "accent", front: 1 },
      { d: "M170,166 L190,166 L190,169 L170,169 Z", fill: "accent", front: 1 },
      { d: "M102,202 L198,202 L198,210 L102,210 Z", fill: "accent", op: .8 }
    ],
    lehenga: () => [
      ...W_NECK,
      { d: "M106,84 L90,96 L84,160 L100,162 L110,112 Z", fill: "main", pat: 1 },
      { d: "M194,84 L210,96 L216,160 L200,162 L190,112 Z", fill: "main", pat: 1 },
      { d: "M84,152 L100,154 L100,162 L84,160 Z", fill: "accent", band: 1 },
      { d: "M216,152 L200,154 L200,162 L216,160 Z", fill: "accent", band: 1 },
      { d: "M112,136 L188,136 L184,158 L116,158 Z", fill: "skin" },
      { d: "M126,72 L106,84 L110,138 L190,138 L194,84 L174,72 Q150,96 126,72 Z", fill: "main", pat: 1 },
      { d: "M126,72 L106,84 L110,138 L190,138 L194,84 L174,72 Q150,80 126,72 Z", fill: "main", pat: 1, back: 1 },
      ...blouseBackTie(),
      { d: "M114,154 L186,154 Q230,262 262,392 L38,392 Q70,262 114,154 Z", fill: "main", pat: 1 },
      ...kalis(150, 158, [56, 76, 96, 116, 136, 164, 184, 204, 224, 244], 390),
      { d: "M50,344 L250,344 L256,362 L44,362 Z", fill: "second" },
      { d: "M44,360 L256,360 L262,392 L38,392 Z", fill: "accent", band: 1 },
      { d: "M112,152 L188,152 L188,160 L112,160 Z", fill: "accent", band: 1 },
      { path: "M132,86 Q150,104 168,86", stroke: "accent", w: 2.4, dash: "1 4", front: 1 },
      ...dupattaFront()
    ],
    saree: () => [
      ...W_NECK,
      { d: "M106,84 L94,94 L90,128 L104,130 L110,108 Z", fill: "main", pat: .6 },
      { d: "M194,84 L206,94 L210,128 L196,130 L190,108 Z", fill: "main", pat: .6 },
      { d: "M112,136 L188,136 L184,158 L116,158 Z", fill: "skin" },
      { d: "M126,72 L106,84 L110,138 L190,138 L194,84 L174,72 Q150,96 126,72 Z", fill: "main", pat: .6 },
      ...blouseBackTie(),
      { d: "M114,154 L186,154 Q196,280 208,392 L92,392 Q104,280 114,154 Z", fill: "main", pat: 1 },
      ...[138, 144, 150, 156, 162].map((x, i) => ({ line: [x, 200, x + (i - 2) * 5, 390], stroke: "fold", w: 1.4, front: 1 })),
      { d: "M92,370 L208,370 L208,392 L92,392 Z", fill: "accent", band: 1 },
      { d: "M176,70 L198,84 L188,170 L112,166 L118,150 Z", fill: "main", pat: 1, front: 1, edgeAccent: 1 },
      { d: "M196,84 L212,92 L236,310 L214,316 Z", fill: "main", pat: 1, edgeAccent: 1 },
      { d: "M226,290 L236,310 L214,316 L212,296 Z", fill: "accent", band: 1 },
      { d: "M120,72 L176,70 L198,84 L198,200 L120,190 Z", fill: "main", pat: 1, back: 1, edgeAccent: 1 }
    ],
    anarkali: () => [
      ...W_NECK,
      { d: "M106,84 L90,96 L80,232 L98,234 L108,120 Z", fill: "main", pat: 1 },
      { d: "M194,84 L210,96 L220,232 L202,234 L192,120 Z", fill: "main", pat: 1 },
      { d: "M80,220 L98,222 L98,234 L80,232 Z", fill: "accent", band: 1 },
      { d: "M220,220 L202,222 L202,234 L220,232 Z", fill: "accent", band: 1 },
      { d: "M126,368 L132,394 L148,394 L149,368 Z", fill: "second" },
      { d: "M151,368 L152,394 L168,394 L174,368 Z", fill: "second" },
      { d: "M126,72 L106,84 L110,150 L190,150 L194,84 L174,72 Q150,98 126,72 Z", fill: "main", pat: 1 },
      { d: "M110,146 L190,146 Q236,252 252,370 L48,370 Q64,252 110,146 Z", fill: "main", pat: 1 },
      ...kalis(150, 150, [64, 84, 104, 124, 140, 160, 176, 196, 216, 236], 368),
      { d: "M108,142 L192,142 L192,152 L108,152 Z", fill: "accent", band: 1 },
      { d: "M52,346 L248,346 L252,370 L48,370 Z", fill: "accent", band: 1 },
      { path: "M130,86 Q150,108 170,86", stroke: "accent", w: 2.4, dash: "1 4", front: 1 },
      ...dupattaFront()
    ],
    sharara: () => [
      ...W_NECK,
      { d: "M114,236 L148,236 L146,300 L152,392 L92,392 L118,300 Z", fill: "second", pat: .5 },
      { d: "M152,236 L186,236 L182,300 L208,392 L148,392 L154,300 Z", fill: "second", pat: .5 },
      { d: "M118,294 L146,294 L146,304 L117,304 Z", fill: "accent", band: 1 },
      { d: "M154,294 L182,294 L183,304 L154,304 Z", fill: "accent", band: 1 },
      ...kalis(132, 304, [100, 116, 136], 390), ...kalis(168, 304, [164, 184, 200], 390),
      { d: "M94,378 L148,378 L150,392 L92,392 Z", fill: "accent", band: 1 },
      { d: "M152,378 L206,378 L208,392 L150,392 Z", fill: "accent", band: 1 },
      { d: "M106,84 L90,96 L84,196 L100,198 L108,116 Z", fill: "main", pat: 1 },
      { d: "M194,84 L210,96 L216,196 L200,198 L192,116 Z", fill: "main", pat: 1 },
      { d: "M126,72 L106,84 L108,150 L94,244 L206,244 L192,150 L194,84 L174,72 Q150,98 126,72 Z", fill: "main", pat: 1 },
      ...kalis(150, 152, [100, 124, 150, 176, 200], 242),
      { d: "M94,232 L206,232 L206,244 L94,244 Z", fill: "accent", band: 1 },
      { path: "M130,86 Q150,108 170,86", stroke: "accent", w: 2.4, dash: "1 4", front: 1 },
      ...dupattaFront()
    ],
    suit: () => [
      ...W_NECK,
      { d: "M108,296 L148,296 L146,392 L96,392 Z", fill: "second" },
      { d: "M192,296 L152,296 L154,392 L204,392 Z", fill: "second" },
      ...kalis(126, 300, [104, 120], 390), ...kalis(174, 300, [180, 196], 390),
      { d: "M106,84 L90,96 L84,210 L100,212 L108,116 Z", fill: "main", pat: 1 },
      { d: "M194,84 L210,96 L216,210 L200,212 L192,116 Z", fill: "main", pat: 1 },
      { d: "M84,200 L100,202 L100,212 L84,210 Z", fill: "accent", band: 1 },
      { d: "M216,200 L200,202 L200,212 L216,210 Z", fill: "accent", band: 1 },
      { d: "M126,72 L106,84 L108,180 L104,300 L196,300 L192,180 L194,84 L174,72 Q150,98 126,72 Z", fill: "main", pat: 1 },
      { d: "M128,74 Q150,104 172,74 L178,80 Q150,124 122,80 Z", fill: "accent", band: 1, front: 1 },
      { d: "M104,288 L196,288 L196,300 L104,300 Z", fill: "accent", band: 1 },
      { line: [106, 250, 105, 300], stroke: "fold", w: 1.2 }, { line: [194, 250, 195, 300], stroke: "fold", w: 1.2 },
      { d: "M104,82 L88,90 L74,330 L94,332 Z", fill: "dupatta", edge: 1 },
      { d: "M196,82 L212,90 L226,330 L206,332 Z", fill: "dupatta", edge: 1 }
    ]
  };

  /* ---------- Defs ---------- */
  function defs(id, c) {
    const main = c.main, acc = c.accent;
    const motifOpacity = luminance(main) > 0.75 ? 0.75 : 0.5;
    return `
    <defs>
      <radialGradient id="${id}-spot" cx=".5" cy=".18" r=".75">
        <stop offset="0" stop-color="#4a3826" stop-opacity=".95"/><stop offset=".55" stop-color="#231a13" stop-opacity=".6"/><stop offset="1" stop-color="#0e0b09" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${id}-alcove" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3a2c1f" stop-opacity=".7"/><stop offset="1" stop-color="#16110d" stop-opacity=".9"/>
      </linearGradient>
      <linearGradient id="${id}-main" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${shade(main, .14)}"/>
        <stop offset=".55" stop-color="${main}"/>
        <stop offset="1" stop-color="${shade(main, -.28)}"/>
      </linearGradient>
      <linearGradient id="${id}-second" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${shade(c.second, .1)}"/>
        <stop offset="1" stop-color="${shade(c.second, -.18)}"/>
      </linearGradient>
      <linearGradient id="${id}-acc" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${shade(acc, .35)}"/>
        <stop offset=".5" stop-color="${acc}"/>
        <stop offset="1" stop-color="${shade(acc, -.3)}"/>
      </linearGradient>
      <pattern id="${id}-buti" width="22" height="22" patternUnits="userSpaceOnUse">
        <g fill="${acc}" opacity="${motifOpacity}">
          <ellipse cx="11" cy="7.5" rx="1.6" ry="2.8"/><ellipse cx="11" cy="14.5" rx="1.6" ry="2.8"/>
          <ellipse cx="7.5" cy="11" rx="2.8" ry="1.6"/><ellipse cx="14.5" cy="11" rx="2.8" ry="1.6"/>
          <circle cx="11" cy="11" r="1.5" fill="${shade(acc, .4)}"/>
          <circle cx="0" cy="0" r="1.1"/><circle cx="22" cy="0" r="1.1"/><circle cx="0" cy="22" r="1.1"/><circle cx="22" cy="22" r="1.1"/>
        </g>
      </pattern>
      <pattern id="${id}-band" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="url(#${id}-acc)"/>
        <path d="M5 1 L9 5 L5 9 L1 5 Z" fill="${shade(main, -.1)}" opacity=".55"/>
        <circle cx="5" cy="5" r="1.3" fill="${shade(acc, .5)}"/>
      </pattern>
      <filter id="${id}-soft" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity=".55"/>
      </filter>
    </defs>`;
  }

  function fillFor(layer, id, c) {
    switch (layer.fill) {
      case "main": return `url(#${id}-main)`;
      case "second": return `url(#${id}-second)`;
      case "accent": return layer.band ? `url(#${id}-band)` : `url(#${id}-acc)`;
      case "skin": return SKIN;
      case "skinDark": return shade(SKIN, -.18);
      case "dupatta": return c.dupatta || c.main;
      default: return layer.fill;
    }
  }
  function strokeFor(name, c) {
    if (name === "accent") return c.accent;
    if (name === "fold") return shade(c.main, -.45);
    return name;
  }

  function renderLayers(layers, id, c, view) {
    const back = view === "back";
    return layers.map(l => {
      if (l.front && back) return "";
      if (l.back && !back) return "";
      if (l.fill === "dupatta" && back && !l.back) {
        // back view shows a single long fall
      }
      const op = l.op != null ? ` opacity="${l.op}"` : "";
      if (l.circle) {
        const [x, y, r] = l.circle;
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fillFor(l, id, c)}" stroke="${shade(c.accent, -.4)}" stroke-width=".6"${op}/>`;
      }
      if (l.line) {
        const [x1, y1, x2, y2] = l.line;
        const so = l.stroke === "fold" ? .35 : 1;
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${strokeFor(l.stroke, c)}" stroke-width="${l.w || 1}" stroke-linecap="round" opacity="${so}"/>`;
      }
      if (l.path) {
        return `<path d="${l.path}" fill="none" stroke="${strokeFor(l.stroke, c)}" stroke-width="${l.w || 1}" stroke-linecap="round" ${l.dash ? `stroke-dasharray="${l.dash}"` : ""}/>`;
      }
      let s = "";
      if (l.fill === "dupatta") {
        s += `<path d="${l.d}" fill="${shade(c.dupatta || c.main, .05)}" opacity=".62"/>`;
        s += `<path d="${l.d}" fill="url(#${id}-buti)" opacity=".7"/>`;
        s += `<path d="${l.d}" fill="none" stroke="${c.accent}" stroke-width="2.4" stroke-dasharray="1.5 3" stroke-linecap="round"/>`;
        return s;
      }
      const stroke = l.stroke ? ` stroke="${strokeFor(l.stroke, c)}" stroke-width="1.6"` : ` stroke="${shade(fillHex(l, c), -.35)}" stroke-width=".7" stroke-opacity=".5"`;
      s += `<path d="${l.d}" fill="${fillFor(l, id, c)}"${stroke}${op}/>`;
      if (l.pat) s += `<path d="${l.d}" fill="url(#${id}-buti)" opacity="${l.pat}"/>`;
      if (l.edgeAccent) s += `<path d="${l.d}" fill="none" stroke="${c.accent}" stroke-width="3" stroke-dasharray="2 2.5"/>`;
      return s;
    }).join("");
  }
  function fillHex(l, c) {
    return ({ main: c.main, second: c.second, accent: c.accent, skin: SKIN, skinDark: SKIN })[l.fill] || "#888888";
  }

  function backdrop(id, opts) {
    if (opts.transparent) return "";
    // dark boutique alcove with a warm spotlight from above
    return `
      <rect width="300" height="400" fill="#120f0d"/>
      <rect width="300" height="400" fill="url(#${id}-spot)"/>
      <path d="M46,400 L46,150 Q46,46 150,26 Q254,46 254,150 L254,400" fill="url(#${id}-alcove)" stroke="#c8a45c" stroke-opacity=".28" stroke-width="1"/>
      <path d="M58,400 L58,154 Q58,60 150,40 Q242,60 242,154 L242,400" fill="none" stroke="#c8a45c" stroke-opacity=".12" stroke-width="1"/>
      <rect y="384" width="300" height="16" fill="#0b0908"/>
      <rect y="384" width="300" height="1" fill="#c8a45c" opacity=".18"/>`;
  }

  function colorsOf(product) {
    return {
      main: product.hex,
      accent: product.accent || "#d4af5a",
      second: product.second || "#efe4cc",
      dupatta: product.dupatta || product.second || product.hex
    };
  }

  /* Detail (close-up of embroidery) */
  function detailView(product, id, c) {
    const isMen = product.gender === "men";
    let extra = "";
    if (isMen) {
      extra = [0, 1, 2].map(i => `<circle cx="150" cy="${70 + i * 70}" r="11" fill="url(#${id}-acc)" stroke="${shade(c.accent, -.4)}" stroke-width="1.2"/><circle cx="146" cy="${66 + i * 70}" r="3" fill="#fff" opacity=".5"/>`).join("") +
        `<line x1="150" y1="0" x2="150" y2="270" stroke="${c.accent}" stroke-width="3"/>`;
    } else {
      extra = Array.from({ length: 7 }, (_, i) => {
        const x = 30 + i * 40;
        return `<circle cx="${x}" cy="200" r="13" fill="${shade(c.accent, .45)}" stroke="url(#${id}-acc)" stroke-width="4"/><circle cx="${x}" cy="200" r="6" fill="#ffffff" opacity=".7"/>`;
      }).join("");
    }
    return `
      <rect width="300" height="400" fill="url(#${id}-main)"/>
      <g transform="scale(2.6)"><rect width="300" height="400" fill="url(#${id}-buti)" opacity=".9"/></g>
      ${extra}
      <rect y="276" width="300" height="70" fill="url(#${id}-band)"/>
      <g transform="translate(0,276) scale(2)"><rect width="150" height="35" fill="url(#${id}-band)"/></g>
      <rect y="272" width="300" height="4" fill="${c.accent}"/><rect y="346" width="300" height="4" fill="${c.accent}"/>
      <rect y="350" width="300" height="50" fill="url(#${id}-second)"/>
      ${Array.from({ length: 16 }, (_, i) => `<circle cx="${10 + i * 19}" cy="372" r="2.4" fill="${c.accent}"/>`).join("")}`;
  }

  /**
   * garment(product, view, opts) -> SVG string
   * view: "front" | "back" | "side" | "detail"
   */
  function garment(product, view = "front", opts = {}) {
    const id = uid();
    const c = colorsOf(product);
    const build = SHAPES[product.category] || SHAPES.kurta;
    let body;
    if (view === "detail") {
      body = detailView(product, id, c);
    } else {
      const layers = renderLayers(build(), id, c, view);
      let tf = "";
      if (view === "side") tf = "translate(150 0) scale(.66 1) translate(-150 0)";
      if (view === "back") tf = "";
      body = `${backdrop(id, opts)}
        <ellipse cx="150" cy="390" rx="${view === "side" ? 60 : 96}" ry="8" fill="#000" opacity=".55"/>
        <g filter="url(#${id}-soft)" transform="${tf}">${layers}</g>`;
    }
    const label = `${product.name} — ${view} view`;
    return `<svg viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label.replace(/"/g, "")}" preserveAspectRatio="xMidYMid slice">${defs(id, c)}${body}</svg>`;
  }

  /* ---------- Scenery: Rajasthani palace skyline ---------- */
  function palaceSkyline(fill, w, h, seed) {
    // procedurally builds towers with chhatri domes along the bottom
    let s = seed || 7;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    let x = -20, out = "";
    while (x < w + 20) {
      const tw = 40 + rnd() * 70;
      const th = h * (0.18 + rnd() * 0.26);
      const top = h - th;
      out += `<rect x="${x}" y="${top}" width="${tw}" height="${th}" />`;
      // chhatri: pillars + dome + finial
      const cx = x + tw / 2, dr = tw * 0.32;
      out += `<rect x="${cx - dr}" y="${top - dr * 0.9}" width="${dr * 2}" height="${dr * 0.9}" />`;
      out += `<path d="M${cx - dr * 1.15},${top - dr * 0.9} Q${cx - dr * 1.1},${top - dr * 2.4} ${cx},${top - dr * 2.6} Q${cx + dr * 1.1},${top - dr * 2.4} ${cx + dr * 1.15},${top - dr * 0.9} Z" />`;
      out += `<rect x="${cx - 1.5}" y="${top - dr * 3.3}" width="3" height="${dr * 0.8}" />`;
      // arched windows (cut-outs)
      const wins = Math.floor(tw / 22);
      for (let i = 0; i < wins; i++) {
        const wx = x + 8 + i * 22, wy = top + 22;
        out += `<path d="M${wx},${wy + 22} L${wx},${wy + 8} Q${wx + 6},${wy} ${wx + 12},${wy + 8} L${wx + 12},${wy + 22} Z" fill="${'#ffd58a'}" opacity="${rnd() > .45 ? .55 : .12}"/>`;
      }
      x += tw + rnd() * 8;
    }
    return `<g fill="${fill}">${out}</g>`;
  }

  function scene(opts = {}) {
    const id = uid();
    const w = opts.w || 600, h = opts.h || 600;
    const [c1, c2] = opts.colors || ["#6b0f1a", "#c9a24a"];
    const sky1 = shade(c1, .05), sky2 = shade(c1, -.55);
    const sunC = opts.sun || "#f2a93b";
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${sky2}"/><stop offset=".65" stop-color="${sky1}"/><stop offset="1" stop-color="${shade(c2, -.1)}"/>
        </linearGradient>
        <radialGradient id="${id}-sun" cx=".5" cy=".5" r=".5">
          <stop offset="0" stop-color="${sunC}" stop-opacity=".95"/><stop offset=".6" stop-color="${sunC}" stop-opacity=".25"/><stop offset="1" stop-color="${sunC}" stop-opacity="0"/>
        </radialGradient>
        <pattern id="${id}-jaali" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M12 2 L22 12 L12 22 L2 12 Z" fill="none" stroke="${c2}" stroke-opacity=".18" stroke-width="1"/>
          <circle cx="12" cy="12" r="2" fill="${c2}" fill-opacity=".15"/>
        </pattern>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#${id}-sky)"/>
      <rect width="${w}" height="${h}" fill="url(#${id}-jaali)"/>
      <circle cx="${w * (opts.sunX || .72)}" cy="${h * .38}" r="${Math.min(w, h) * .36}" fill="url(#${id}-sun)"/>
      <circle cx="${w * (opts.sunX || .72)}" cy="${h * .38}" r="${Math.min(w, h) * .09}" fill="${sunC}" opacity=".85"/>
      ${palaceSkyline(shade(c1, -.45), w, h * 1.0, opts.seed || 11)}
      ${palaceSkyline(shade(c1, -.7), w, h * 0.9 + h * .1, (opts.seed || 11) + 5).replace("<g ", `<g transform="translate(0 ${h * .1})" `)}
      ${opts.figure ? `<g transform="${opts.figureTransform || ""}">${opts.figure}</g>` : ""}
    </svg>`;
  }

  // Inline (no outer <svg>) garment, for placing inside scenes
  function figureGroup(product, x, y, scale) {
    const svg = garment(product, "front", { transparent: true });
    const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    return `<g transform="translate(${x} ${y}) scale(${scale})">${inner}</g>`;
  }

  window.SanskaarArt = { garment, scene, figureGroup, shade };
})();
