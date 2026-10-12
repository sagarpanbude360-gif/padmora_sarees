# Padmora: image and layout sizes

Measured on the running site on 12 Oct 2026 (desktop = 1440 px wide window, phone = 375 px wide). "Shown at" is the size on screen in CSS pixels.
"Upload" is a suggested file size: about twice the shown size, so it stays sharp on high-density phone screens. The site converts
uploads to WebP and serves a smaller copy to each screen, so a larger file does no harm, but do not go below the shown size.

| Where | Desktop shown at | Phone shown at | Shape | Upload this |
|---|---|---|---|---|
| Home banner (hero) | 1425 x 401 (always 32:9, so 1920 px wide = 540 px tall) | 375 x 195 (never shorter than 52% of the screen width; a taller picture keeps its own height) | very wide strip | Desktop picture 2560 x 720 (32:9) for no cropping. A normal 16:9 picture (2400 x 1350) also works, but only a 32:9 strip of it shows, from the upper-middle, so keep the saree and any text inside that band. Phone picture about 1080 x 562, or taller such as 1080 x 1350 if you want a taller banner (choose the visible side in Admin > Storefront > Hero) |
| "Shop by Weave" circle (home) | 280 x 280 (4 across) | 104 x 104 (3 across) | square, shown as a circle | 800 x 800 square, subject in the middle |
| Collection card (Collections page) | 580 x 363 picture, 580 x 475 whole card (2 across) | 339 x 212 picture, 339 x 345 whole card (1 across) | 16:10 | 1600 x 1000. Uses the collection's Thumbnail; if none, its Banner |
| Collection page banner (top of a collection) | 1425 x 320 | 375 x 230 | wide, centred and cropped to fit | 2400 x 800 with the subject in the middle band; the title is written over it, so keep it calm |
| Product card (shop, wishlist, sale) | 285 x 380 picture, 285 x 529 whole card (3 across) | 163 x 217 picture, 163 x 388 whole card (2 across) | 3:4 portrait | 1200 x 1600 |
| Product page main photo | 567 x 756 | 339 x 424 | 3:4 on desktop, a little shorter on phone | 1200 x 1600 (the site serves 640 px wide on desktop, 750 px on phone) |
| Reel card (home) | 190 x 338 | 190 x 338 | 9:16 portrait | Video and cover picture 1080 x 1920 (720 x 1280 is enough) |
| "Shop all sarees" fan card (home) | 210 x 300 each, three fanned | same, inside a 339 x 250 stage | 7:10 | Uses the product's own photo, nothing to upload |
| Page title strip (Shop, Contact, FAQ, and so on) | 1425 x 205 | 375 x 205 | plain colour, no picture | none |

Page frame: content is at most 1240 px wide and centred, with 28 px of side padding on desktop and 18 px on phones. The top
announcement bar is 35 px and the header 79 px on desktop.

Where each picture is set: banner in Admin > Storefront > Hero; circle in Catalog > Fabrics (Circle picture);
collection pictures in Catalog > Collections; product photos in each colour's media; reels in Storefront > Sarees in Motion.

Note: the hint text in the admin hero form says "2400 x 1000" for desktop and "1080 x 1350" for phone. The desktop banner is actually
a 32:9 strip (2560 x 720 fits it exactly), so 2400 x 1000 gets trimmed top and bottom. The 1080 x 1350 phone suggestion gives a tall banner
(about 469 px high at 375 px wide); use about 1080 x 562 for a short one.

Upload note (fixed 12 Oct 2026): the admin used to shrink every uploaded picture to 1600 px on its long side, which made a 2400 px banner look
soft. The homepage banner now keeps up to 2560 px (collection banners 2400 px) at higher quality, and the page asks for the width the visitor's
screen needs. A banner uploaded before this change is stored at 1600 px, so upload it again from the original file.
