# Screenshots & demo media

Assets linked from the root README.

| File | Content |
|------|---------|
| `orders.png` | Orders list |
| `clients.png` | Clients list |
| `catalog.png` | Lens catalog |
| `sales-by-sku.png` | Sales report |
| `settings.png` | Settings + demo data controls |
| `proforma-pdf-demo.gif` | PDF flow (full viewport + cursor) |
| `proforma-pdf.png` | Still of generated proforma |

Regenerate the GIF (dev server must be running). Captures at **1440×900** (16:9 desktop):

```bash
npm run dev
npx tsx scripts/build-pdf-demo-gif.ts http://localhost:5173
```

Intermediate frames land in `gif-frames/` (safe to delete).
