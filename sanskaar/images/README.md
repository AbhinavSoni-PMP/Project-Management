# Photography: how to add real photos

**No code editing needed.** Save a photo with the right name in the right folder
and it appears on the site automatically. Until then, the illustrated preview shows.

## Product photos

Create a folder named after the product's SKU (shown on every product page, and in
`js/catalog-data.js`), e.g. `images/products/SK-W-LHG-001/`, and add:

| File         | Shot                                             |
|--------------|--------------------------------------------------|
| `front.jpg`  | Full-length front, model facing camera           |
| `back.jpg`   | Full-length back (also used as the hover image)  |
| `side.jpg`   | Three-quarter or side angle                      |
| `detail.jpg` | Close-up of embroidery / fabric / buttons        |

If a product has only some shots (e.g. no back view), list the ones you have in
`js/catalog-data.js` (see the `photos` list at the bottom of that file, e.g.
`["front", "detail"]`) and the site shows exactly those. A flat-lay shot can be
named `flatlay.jpg`.

## Site photos (home page)

| File                                  | Where it appears                          |
|---------------------------------------|-------------------------------------------|
| `images/site/hero.jpg`                | Full-screen banner at the top (landscape, 2400 × 1350 px, subject on the right half) |
| `images/site/bride.jpg`               | "The Bridal Trousseau" panel (portrait 4:5) |
| `images/site/groom.jpg`               | "The Groom's Durbar" panel (portrait 4:5)   |
| `images/collections/rajwada.jpg` (also `gulabi`, `marwar`, `thar`, `udaipur`) | Collection arches (portrait 2:3) |

File names are case-sensitive, and must be `.jpg`.

## Image specs (keeps the site looking consistent)

- **Portrait 3:4**, at least **1200 × 1600 px**, JPG or WebP, under ~400 KB each.
- Same mood for the whole catalogue: warm, low-key light against a dark or richly
  textured Rajasthani interior (palace arches, jharokha, carved sandstone). This
  matches the dark-and-gold site design.
- Model centred, full outfit visible head to toe, same camera height for every product.

## AI-editing your raw photos

For each garment photo, the AI tool should produce:

- **Clean product shot:** background removed, colours true to the fabric, creases fixed.
- **On-model shots:** an AI model (Indian groom / bride) wearing the exact garment
  from front, back, side, plus an embroidery close-up.

Example prompt (adjust per garment):

> Professional Indian wedding-wear catalogue photo. A handsome Indian groom model
> wearing exactly this ivory zardozi sherwani with matching churidar, safa and mojari.
> Full-length, front view, standing straight, neutral expression. Background: a dimly lit
> Rajasthani palace corridor with carved arches and warm lamp light. Studio lighting, 85mm lens, 3:4
> portrait, high detail on embroidery. Do not change the garment's colour, pattern
> or embroidery.

Repeat with "back view", "three-quarter side view" and "macro close-up of the
embroidery". Always check the result against the real garment: AI tools can
alter embroidery or colours, and customers must receive what they see.
