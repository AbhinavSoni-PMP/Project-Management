/* ==========================================================================
   SANSKAAR — Product catalogue
   --------------------------------------------------------------------------
   Every product lives in this one file. To add your real photography, give a
   product a `photos` object, e.g.

     photos: {
       front:  "images/products/SK-M-SHW-001/front.jpg",
       back:   "images/products/SK-M-SHW-001/back.jpg",
       side:   "images/products/SK-M-SHW-001/side.jpg",
       detail: "images/products/SK-M-SHW-001/detail.jpg"
     }

   Any view you leave out falls back to the illustrated preview, so you can
   add photos one product at a time. See images/README.md.
   ========================================================================== */

window.SANSKAAR = window.SANSKAAR || {};

SANSKAAR.categories = {
  men: [
    { key: "sherwani",    name: "Sherwani",            hint: "For the groom" },
    { key: "bandhgala",   name: "Bandhgala & Jodhpuri", hint: "Royal Rajput cut" },
    { key: "indowestern", name: "Indo-Western",        hint: "Modern drape" },
    { key: "kurta",       name: "Kurta Pajama",        hint: "Festive essentials" },
    { key: "jacket",      name: "Nehru Jacket Sets",   hint: "Layered elegance" }
  ],
  women: [
    { key: "lehenga",  name: "Bridal Lehenga", hint: "For the bride" },
    { key: "saree",    name: "Saree",          hint: "Six yards of grace" },
    { key: "anarkali", name: "Anarkali",       hint: "Mughal flare" },
    { key: "sharara",  name: "Sharara & Gharara", hint: "Sangeet ready" },
    { key: "suit",     name: "Kurta & Palazzo", hint: "Everyday festive" }
  ]
};

SANSKAAR.occasions = [
  { key: "wedding",   name: "Wedding",   hint: "Pheras & baraat",     color: "#9b1b30" },
  { key: "reception", name: "Reception", hint: "Evening glamour",     color: "#3a2a6b" },
  { key: "sangeet",   name: "Sangeet",   hint: "Dance the night",     color: "#0f5257" },
  { key: "mehendi",   name: "Mehendi",   hint: "Greens & florals",    color: "#4f7a2a" },
  { key: "haldi",     name: "Haldi",     hint: "Sunshine yellows",    color: "#d1951a" },
  { key: "festive",   name: "Festive",   hint: "Diwali, Eid, Teej",   color: "#c2531b" }
];

SANSKAAR.collections = [
  { key: "rajwada",    name: "Rajwada",      deva: "रजवाड़ा",     hint: "Royal heirloom couture",   colors: ["#6b0f1a", "#c9a24a"] },
  { key: "gulabi",     name: "Gulabi Nagar", deva: "गुलाबी नगर", hint: "The pink city of Jaipur",  colors: ["#d9677f", "#f3c6cf"] },
  { key: "marwar",     name: "Marwar",       deva: "मारवाड़",     hint: "Jodhpur blues & bandhej", colors: ["#1f3f7a", "#e8d39a"] },
  { key: "thar",       name: "Thar Sands",   deva: "थार",        hint: "Desert ivory & gold",     colors: ["#e9d8b4", "#a8782b"] },
  { key: "udaipur",    name: "Udaipur Lakes",deva: "उदयपुर",     hint: "Pastels of the lake palace", colors: ["#7fb2a8", "#f6efe0"] }
];

SANSKAAR.colors = {
  maroon:  { name: "Maroon",       hex: "#6b0f1a" },
  red:     { name: "Bridal Red",   hex: "#b3122e" },
  ivory:   { name: "Ivory",        hex: "#efe4cc" },
  gold:    { name: "Antique Gold", hex: "#c9a24a" },
  pink:    { name: "Rani Pink",    hex: "#c8336b" },
  blush:   { name: "Blush Pink",   hex: "#e8a9b4" },
  blue:    { name: "Royal Blue",   hex: "#1f3f7a" },
  navy:    { name: "Midnight Navy",hex: "#1a2340" },
  green:   { name: "Emerald",      hex: "#0f6b4f" },
  mint:    { name: "Mint",         hex: "#a9d5c1" },
  yellow:  { name: "Haldi Yellow", hex: "#e9b425" },
  peach:   { name: "Peach",        hex: "#f0b48f" },
  wine:    { name: "Wine",         hex: "#4a1030" },
  black:   { name: "Black",        hex: "#1c1a1a" },
  teal:    { name: "Peacock Teal", hex: "#0f5257" },
  lilac:   { name: "Lilac",        hex: "#b7a3d1" },
  orange:  { name: "Kesariya",     hex: "#df6d1d" },
  beige:   { name: "Sand Beige",   hex: "#d8c3a0" }
};

(function () {
  const C = SANSKAAR.colors;
  const MEN_SIZES = ["36", "38", "40", "42", "44", "46"];
  const WOMEN_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

  // p(id, name, gender, category, collection, occasions, colour, accentHex, secondHex, price, mrp, fabric, work, tag, description)
  function p(id, name, gender, category, collection, occasions, color, accent, second, price, mrp, fabric, work, tag, description) {
    return {
      id, name, gender, category, collection, occasions,
      color: color, colorName: C[color].name, hex: C[color].hex,
      accent, second, price, mrp, fabric, work, tag, description,
      sizes: gender === "men" ? MEN_SIZES : WOMEN_SIZES,
      photos: null
    };
  }

  const G = "#d4af5a"; // zari gold
  const S = "#e8e2d6"; // silver zari

  SANSKAAR.products = [
    /* ---------------- MEN · STUDIO-PHOTOGRAPHED (real product photos) ---------------- */
    p("SK-M-IWS-101", "Neel Kamal Velvet Indo-Western", "men", "indowestern", "marwar", ["reception", "sangeet", "wedding"], "black", "#8fb3e0", "#1c1a1a", 24999, 28999, "Velvet with sequin jaal", "Blue & silver floral thread embroidery", "new",
      "Midnight-black velvet worked with an all-over sequin jaal and cascading blue and silver florals along the hem and sleeves. Open-front cut over a black satin bandhgala kurta with antique-gold buttons, paired with tailored satin trousers."),
    p("SK-M-IWS-102", "Gulnaar Velvet Indo-Western", "men", "indowestern", "rajwada", ["reception", "sangeet", "festive"], "black", "#e46a8f", "#1c1a1a", 24999, 28999, "Velvet with sequin jaal", "Multicolour floral thread embroidery", "new",
      "Black sequinned velvet blooming with rose, coral and sage florals across the hem, cuffs and shoulders, finished with an embroidered border. Worn open over a black satin inner kurta with gold buttons."),
    p("SK-M-IWS-103", "Phoolbagh Sequin Velvet Jacket", "men", "indowestern", "gulabi", ["sangeet", "reception", "festive"], "black", "#e7a3c4", "#1c1a1a", 23999, 27999, "Velvet with sequin jaal", "Pastel daisy thread embroidery", "new",
      "A garden of pink, lilac and ivory daisies scattered over black sequinned velvet, growing into a dense floral border at the hem. Open-front jacket over a black satin inner kurta."),
    p("SK-M-IWS-104", "Chandni Ivory Indo-Western", "men", "indowestern", "thar", ["wedding", "reception", "festive"], "ivory", "#c9b28a", "#efe4cc", 26999, 30999, "Silk blend", "Champagne threadwork & scalloped sequin border", "new",
      "Ivory silk-blend with delicate champagne butis, a floral vine at the hem and a scalloped sequin border. Layered over a matching ivory bandhgala kurta with pearl-tone buttons and a pocket square."),
    p("SK-M-IWS-105", "Gulabi Chandni Ivory Indo-Western", "men", "indowestern", "udaipur", ["wedding", "reception", "festive"], "ivory", "#a8737f", "#efe4cc", 26999, 30999, "Silk blend", "Rosewood threadwork & scalloped sequin border", "new",
      "Ivory silk-blend embroidered in soft rosewood tones: scattered butis, a blossoming vine and a scalloped sequin border at the hem and cuffs. Over a matching ivory bandhgala kurta with a pocket square."),
    /* ---------------- MEN · SHERWANI ---------------- */
    p("SK-M-SHW-001", "Maharaja Zardozi Sherwani", "men", "sherwani", "rajwada", ["wedding"], "ivory", G, "#efe4cc", 64999, 79999, "Raw silk", "Hand zardozi, dabka & sequin", "bestseller",
      "An heirloom ivory sherwani hand-embroidered with zardozi peacocks along the hem and cuffs. Paired with a matching churidar and a silk stole."),
    p("SK-M-SHW-002", "Shahi Maroon Velvet Sherwani", "men", "sherwani", "rajwada", ["wedding", "reception"], "maroon", G, "#efe4cc", 72999, null, "Silk velvet", "Antique gold marodi & cutdana", "new",
      "Rich maroon velvet with dense antique-gold embroidery at the collar and placket, inspired by the durbar halls of Amer."),
    p("SK-M-SHW-003", "Gulabi Rose Sherwani", "men", "sherwani", "gulabi", ["wedding"], "blush", G, "#f6efe0", 54999, 61999, "Silk blend", "Resham threadwork & pearl", null,
      "A soft blush sherwani with tonal resham jaal and pearl buttons — made for the day-wedding groom."),
    p("SK-M-SHW-004", "Thar Gold Brocade Sherwani", "men", "sherwani", "thar", ["wedding", "reception"], "gold", "#7a5a1e", "#efe4cc", 58999, null, "Banarasi brocade", "Woven zari brocade", null,
      "Woven Banarasi brocade in antique gold, finished with a hand-knotted silk button loop."),
    p("SK-M-SHW-005", "Mewar Wine Sherwani", "men", "sherwani", "rajwada", ["reception"], "wine", G, "#efe4cc", 61999, 69999, "Raw silk", "Kasab & sequin", null,
      "Deep wine raw silk with kasab-embroidered lotus borders, cut close in the Mewar tradition."),
    p("SK-M-SHW-006", "Udaipur Mint Sherwani", "men", "sherwani", "udaipur", ["wedding"], "mint", S, "#f6efe0", 49999, null, "Silk blend", "Silver threadwork", "new",
      "A cool mint sherwani with silver threadwork that recalls the lake palace at dusk."),

    /* ---------------- MEN · BANDHGALA ---------------- */
    p("SK-M-BND-001", "Jodhpuri Navy Bandhgala", "men", "bandhgala", "marwar", ["reception", "festive"], "navy", G, "#efe4cc", 28999, 32999, "Terry rayon", "Antique metal buttons", "bestseller",
      "The classic Jodhpuri bandhgala in midnight navy with antique brass buttons and breeches-style trousers."),
    p("SK-M-BND-002", "Royal Blue Jodhpuri Suit", "men", "bandhgala", "marwar", ["reception", "sangeet"], "blue", G, "#1a2340", 31999, null, "Wool silk", "Embroidered collar", null,
      "Royal blue wool-silk with a gold embroidered mandarin collar."),
    p("SK-M-BND-003", "Black Rajputana Bandhgala", "men", "bandhgala", "rajwada", ["reception"], "black", G, "#1c1a1a", 33999, 37999, "Velvet", "Zari collar & cuffs", "new",
      "Black velvet bandhgala with zari-edged collar and cuffs — evening royalty."),
    p("SK-M-BND-004", "Ivory Thar Bandhgala", "men", "bandhgala", "thar", ["wedding", "festive"], "ivory", G, "#d8c3a0", 26999, null, "Linen silk", "Tonal threadwork", null,
      "Ivory linen-silk with tonal threadwork, paired with sand-beige trousers."),
    p("SK-M-BND-005", "Emerald Jodhpuri Bandhgala", "men", "bandhgala", "rajwada", ["mehendi", "festive"], "green", G, "#efe4cc", 29999, null, "Jacquard", "Woven buti", null,
      "Emerald jacquard with woven gold buti, a statement for mehendi."),

    /* ---------------- MEN · INDO-WESTERN ---------------- */
    p("SK-M-IWS-001", "Asymmetric Drape Indo-Western", "men", "indowestern", "udaipur", ["sangeet", "reception"], "beige", G, "#efe4cc", 34999, 39999, "Silk blend", "Sequin placket", "bestseller",
      "An asymmetric overlap with a sequinned diagonal placket and draped stole."),
    p("SK-M-IWS-002", "Midnight Mirror Indo-Western", "men", "indowestern", "marwar", ["sangeet"], "navy", S, "#1a2340", 36999, null, "Suede", "Mirror & thread", "new",
      "Midnight suede with mirror-work from Kutch artisans — built for the dance floor."),
    p("SK-M-IWS-003", "Wine Cape Indo-Western", "men", "indowestern", "rajwada", ["reception"], "wine", G, "#1c1a1a", 39999, 44999, "Velvet", "Cutdana", null,
      "Wine velvet long-line jacket with cutdana embroidery and a cape detail."),
    p("SK-M-IWS-004", "Peacock Teal Indo-Western", "men", "indowestern", "udaipur", ["sangeet", "mehendi"], "teal", G, "#efe4cc", 32999, null, "Jacquard silk", "Peacock motif", null,
      "Peacock teal with jacquard motifs and a dhoti-style trouser."),

    /* ---------------- MEN · KURTA ---------------- */
    p("SK-M-KUR-001", "Haldi Yellow Kurta Set", "men", "kurta", "thar", ["haldi", "festive"], "yellow", "#fff4c2", "#efe4cc", 6999, 8499, "Cotton silk", "Chikankari yoke", "bestseller",
      "Sunshine yellow cotton-silk with a hand chikankari yoke — the haldi essential."),
    p("SK-M-KUR-002", "Ivory Chikankari Kurta Set", "men", "kurta", "thar", ["festive", "mehendi"], "ivory", "#ffffff", "#efe4cc", 7999, null, "Georgette", "Lucknowi chikankari", null,
      "All-over Lucknowi chikankari on soft georgette, paired with an ivory pajama."),
    p("SK-M-KUR-003", "Kesariya Festive Kurta", "men", "kurta", "marwar", ["festive", "haldi"], "orange", G, "#efe4cc", 5999, 6999, "Art silk", "Gota patti placket", null,
      "Kesariya saffron kurta with a gota-patti placket from Jaipur."),
    p("SK-M-KUR-004", "Mint Mehendi Kurta Set", "men", "kurta", "udaipur", ["mehendi"], "mint", "#ffffff", "#f6efe0", 6499, null, "Cotton linen", "Thread embroidery", "new",
      "Breathable cotton-linen in mint with tonal thread embroidery."),
    p("SK-M-KUR-005", "Maroon Silk Kurta Set", "men", "kurta", "rajwada", ["festive"], "maroon", G, "#efe4cc", 8499, 9999, "Dupion silk", "Woven buti", null,
      "Dupion silk kurta in maroon with a woven gold buti, made for Diwali evenings."),
    p("SK-M-KUR-006", "Lilac Pastel Kurta Set", "men", "kurta", "udaipur", ["sangeet", "festive"], "lilac", "#ffffff", "#f6efe0", 6999, null, "Silk blend", "Mirror placket", null,
      "Lilac silk-blend with a mirror-work placket."),

    /* ---------------- MEN · JACKET SETS ---------------- */
    p("SK-M-JKT-001", "Bandhani Nehru Jacket Set", "men", "jacket", "marwar", ["mehendi", "festive"], "red", G, "#efe4cc", 12999, 14999, "Silk", "Bandhani print & zari", "bestseller",
      "Hand-tied bandhani Nehru jacket over an ivory kurta — pure Rajasthan."),
    p("SK-M-JKT-002", "Emerald Brocade Jacket Set", "men", "jacket", "rajwada", ["sangeet", "festive"], "green", G, "#efe4cc", 13999, null, "Brocade", "Woven zari", null,
      "Emerald brocade jacket with an ivory silk kurta and churidar."),
    p("SK-M-JKT-003", "Navy Velvet Jacket Set", "men", "jacket", "marwar", ["reception", "festive"], "navy", G, "#efe4cc", 14999, 16999, "Velvet", "Zari edging", "new",
      "Navy velvet Nehru jacket edged in zari, layered over a cream kurta."),
    p("SK-M-JKT-004", "Gulabi Printed Jacket Set", "men", "jacket", "gulabi", ["haldi", "mehendi"], "pink", G, "#efe4cc", 11999, null, "Chanderi", "Block print", null,
      "Hand block-printed Jaipur jacket in rani pink over an ivory kurta."),

    /* ---------------- WOMEN · LEHENGA ---------------- */
    p("SK-W-LHG-001", "Rajkumari Bridal Lehenga", "women", "lehenga", "rajwada", ["wedding"], "red", G, "#b3122e", 184999, 219999, "Raw silk", "Zardozi, dabka, nakshi", "bestseller",
      "Bridal red raw silk lehenga with 52 kalis, hand-embroidered in zardozi and dabka. Comes with a double-border net dupatta."),
    p("SK-W-LHG-002", "Gulabi Nagar Lehenga", "women", "lehenga", "gulabi", ["wedding", "sangeet"], "pink", G, "#e8a9b4", 124999, 139999, "Silk organza", "Gota patti & mirror", "new",
      "Rani pink organza with Jaipuri gota-patti florals and tiny mirrors that catch every light."),
    p("SK-W-LHG-003", "Maroon Heritage Lehenga", "women", "lehenga", "rajwada", ["wedding"], "maroon", G, "#b3122e", 164999, null, "Velvet", "Antique zardozi", null,
      "Maroon velvet with antique-gold zardozi — for the bride who loves old-world grandeur."),
    p("SK-W-LHG-004", "Udaipur Pastel Lehenga", "women", "lehenga", "udaipur", ["reception", "sangeet"], "mint", S, "#f6efe0", 98999, 109999, "Georgette", "Sequin & pearl", null,
      "Mint georgette with silver sequin jaal and pearl tassels."),
    p("SK-W-LHG-005", "Blush Floral Lehenga", "women", "lehenga", "gulabi", ["reception", "mehendi"], "blush", G, "#f6efe0", 89999, null, "Organza", "3D floral appliqué", "new",
      "Blush organza with hand-cut 3D florals — light, romantic and photogenic."),
    p("SK-W-LHG-006", "Wine Velvet Reception Lehenga", "women", "lehenga", "rajwada", ["reception"], "wine", G, "#4a1030", 134999, 149999, "Velvet", "Cutdana & kasab", null,
      "Wine velvet with cutdana and kasab work — dramatic for the reception."),
    p("SK-W-LHG-007", "Emerald Bandhej Lehenga", "women", "lehenga", "marwar", ["mehendi", "sangeet"], "green", G, "#c9a24a", 74999, null, "Gaji silk", "Bandhej & gota", null,
      "Gaji silk bandhej in emerald with gota-trimmed tiers from Marwar."),
    p("SK-W-LHG-008", "Lilac Dreams Lehenga", "women", "lehenga", "udaipur", ["sangeet", "reception"], "lilac", S, "#f6efe0", 84999, 92999, "Net", "Sequin & thread", null,
      "Lilac net with silver sequin waves, a lehenga made for twirling."),

    /* ---------------- WOMEN · SAREE ---------------- */
    p("SK-W-SAR-001", "Banarasi Kadhua Saree", "women", "saree", "rajwada", ["wedding", "festive"], "red", G, "#6b0f1a", 38999, 44999, "Katan silk", "Kadhua woven zari", "bestseller",
      "Handwoven Banarasi katan silk in bridal red with kadhua zari motifs."),
    p("SK-W-SAR-002", "Leheriya Chiffon Saree", "women", "saree", "marwar", ["haldi", "festive"], "yellow", "#df6d1d", "#e9b425", 12999, null, "Chiffon", "Leheriya tie-dye & gota", null,
      "Rajasthani leheriya waves on chiffon with a gota border."),
    p("SK-W-SAR-003", "Ivory Gota Saree", "women", "saree", "thar", ["reception", "festive"], "ivory", G, "#efe4cc", 18999, 21999, "Organza", "Gota patti", "new",
      "Sheer ivory organza bordered in gota patti — understated luxury."),
    p("SK-W-SAR-004", "Royal Blue Kanjeevaram", "women", "saree", "marwar", ["wedding", "reception"], "blue", G, "#c9a24a", 34999, null, "Kanjeevaram silk", "Temple border", null,
      "Royal blue Kanjeevaram with a contrast temple border."),
    p("SK-W-SAR-005", "Rani Pink Bandhani Saree", "women", "saree", "gulabi", ["mehendi", "sangeet"], "pink", G, "#c8336b", 15999, 17999, "Gaji silk", "Bandhani & zari", null,
      "Rani pink gaji silk with thousands of hand-tied bandhani dots."),
    p("SK-W-SAR-006", "Black Sequin Saree", "women", "saree", "rajwada", ["reception"], "black", G, "#1c1a1a", 21999, null, "Georgette", "All-over sequin", null,
      "Black georgette with all-over gold sequins for the cocktail night."),

    /* ---------------- WOMEN · ANARKALI ---------------- */
    p("SK-W-ANK-001", "Mughal Maroon Anarkali", "women", "anarkali", "rajwada", ["wedding", "festive"], "maroon", G, "#efe4cc", 32999, 36999, "Silk", "Zari & resham", "bestseller",
      "A floor-length maroon anarkali with zari kalis and a resham yoke."),
    p("SK-W-ANK-002", "Peach Floral Anarkali", "women", "anarkali", "udaipur", ["mehendi", "sangeet"], "peach", G, "#f6efe0", 24999, null, "Georgette", "Thread & sequin", "new",
      "Peach georgette with a floral thread hem — light enough to dance in."),
    p("SK-W-ANK-003", "Peacock Teal Anarkali", "women", "anarkali", "udaipur", ["festive", "reception"], "teal", G, "#efe4cc", 27999, 29999, "Silk blend", "Zari border", null,
      "Peacock teal anarkali with a broad zari border and organza dupatta."),
    p("SK-W-ANK-004", "Ivory Chikankari Anarkali", "women", "anarkali", "thar", ["mehendi", "festive"], "ivory", "#ffffff", "#efe4cc", 19999, null, "Georgette", "Lucknowi chikankari", null,
      "All-over Lucknowi chikankari in ivory with a mukaish dupatta."),
    p("SK-W-ANK-005", "Navy Gota Anarkali", "women", "anarkali", "marwar", ["festive", "sangeet"], "navy", G, "#efe4cc", 22999, 25999, "Chanderi silk", "Gota patti", null,
      "Midnight navy chanderi edged in Jaipuri gota."),

    /* ---------------- WOMEN · SHARARA ---------------- */
    p("SK-W-SHR-001", "Haldi Gota Sharara Set", "women", "sharara", "marwar", ["haldi"], "yellow", G, "#e9b425", 16999, 18999, "Mul cotton", "Gota patti", "bestseller",
      "Marigold yellow sharara with gota-patti tiers — haldi's favourite."),
    p("SK-W-SHR-002", "Mint Mirror Sharara", "women", "sharara", "udaipur", ["mehendi", "sangeet"], "mint", S, "#a9d5c1", 18999, null, "Georgette", "Mirror & sequin", "new",
      "Mint georgette with mirror-work kurti and flared sharara."),
    p("SK-W-SHR-003", "Rani Pink Gharara Set", "women", "sharara", "gulabi", ["sangeet", "mehendi"], "pink", G, "#c8336b", 21999, 23999, "Silk", "Zari & gota", null,
      "A Lucknowi-style gharara in rani pink with zari gota at the knee."),
    p("SK-W-SHR-004", "Lilac Sequin Sharara", "women", "sharara", "udaipur", ["sangeet", "reception"], "lilac", S, "#b7a3d1", 19999, null, "Georgette", "Sequin", null,
      "Lilac sequins from yoke to hem — built for the sangeet stage."),

    /* ---------------- WOMEN · SUIT ---------------- */
    p("SK-W-SUT-001", "Jaipuri Block Print Suit", "women", "suit", "gulabi", ["festive", "haldi"], "blush", "#c8336b", "#f6efe0", 6999, 7999, "Cotton", "Sanganeri block print", "bestseller",
      "Hand block-printed Sanganeri cotton suit with palazzo and mulmul dupatta."),
    p("SK-W-SUT-002", "Emerald Silk Kurta Set", "women", "suit", "rajwada", ["festive"], "green", G, "#c9a24a", 9999, null, "Chanderi silk", "Zari yoke", null,
      "Emerald chanderi with a zari yoke and golden palazzo."),
    p("SK-W-SUT-003", "Kesariya Leheriya Suit", "women", "suit", "marwar", ["haldi", "festive"], "orange", G, "#e9b425", 7499, 8499, "Cotton silk", "Leheriya & gota", "new",
      "Kesariya leheriya in cotton silk with gota-trimmed sleeves."),
    p("SK-W-SUT-004", "Ivory Mukaish Kurta Set", "women", "suit", "thar", ["mehendi", "festive"], "ivory", S, "#efe4cc", 8999, null, "Georgette", "Mukaish work", null,
      "Ivory georgette sprinkled with silver mukaish."),
  ];

})();

// Real studio photos (images/products/<SKU>/<shot>.jpg) for these products
[["SK-M-IWS-101", ["front", "detail"]], ["SK-M-IWS-102", ["front", "detail"]], ["SK-M-IWS-103", ["flatlay", "detail"]],
 ["SK-M-IWS-104", ["front", "detail"]], ["SK-M-IWS-105", ["front", "detail"]]]
  .forEach(([id, shots]) => { SANSKAAR.products.find(p => p.id === id).photos = shots; });
