# Product photography: how to add real photos

Every product currently shows an **illustrated preview** generated from its colours.
To replace one with real photography:

1. Create a folder named after the product's SKU (find SKUs in `js/catalog-data.js`
   or on each product page), e.g. `images/products/SK-M-SHW-001/`.
2. Add up to four images with these exact names:

   | File         | Shot                                             |
   |--------------|--------------------------------------------------|
   | `front.jpg`  | Full-length front, model facing camera           |
   | `back.jpg`   | Full-length back                                 |
   | `side.jpg`   | Three-quarter or side angle                      |
   | `detail.jpg` | Close-up of embroidery / fabric / buttons        |

3. In `js/catalog-data.js`, set that product's `photos` (or add it right after the
   product list):

   ```js
   SANSKAAR.products.find(p => p.id === "SK-M-SHW-001").photos = {
     front:  "images/products/SK-M-SHW-001/front.jpg",
     back:   "images/products/SK-M-SHW-001/back.jpg",
     side:   "images/products/SK-M-SHW-001/side.jpg",
     detail: "images/products/SK-M-SHW-001/detail.jpg"
   };
   ```

   Any view you leave out keeps the illustrated version.

## Image specs (keeps the site looking consistent)

- **Portrait 3:4**, at least **1200 × 1600 px**, JPG or WebP, under ~400 KB each.
- Same backdrop for the whole catalogue: warm ivory / beige (#F3E7CF) or a soft
  Rajasthani interior (arches, jharokha, sandstone).
- Model centred, full outfit visible head to toe, same camera height for every product.

## AI-editing your raw photos

For each garment photo, the AI tool should produce:

- **Clean product shot:** background removed, colours true to the fabric, creases fixed.
- **On-model shots:** an AI model (Indian groom / bride) wearing the exact garment
  from front, back, side, plus an embroidery close-up.

Example prompt (adjust per garment):

> Professional Indian wedding-wear catalogue photo. A handsome Indian groom model
> wearing exactly this ivory zardozi sherwani with matching churidar, safa and mojari.
> Full-length, front view, standing straight, neutral expression. Background: soft-lit
> Rajasthani palace arch in warm ivory sandstone. Studio lighting, 85mm lens, 3:4
> portrait, high detail on embroidery. Do not change the garment's colour, pattern
> or embroidery.

Repeat with "back view", "three-quarter side view" and "macro close-up of the
embroidery". Always check the result against the real garment: AI tools can
alter embroidery or colours, and customers must receive what they see.
