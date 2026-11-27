# Mangala Enterprises — Unified Design System

**Design Identity:** Contemporary Premium Retail — Mangala Enterprises  
**Applies To:** Customer Website (`apps/customer-web`), Admin Control Center (`apps/admin-web`), and Android Customer App (`apps/android`).

---

## 1. Brand Palette & Surface Tokens

| Token | Hex Value | Role & Usage |
| :--- | :--- | :--- |
| **Forest Green** (`--color-forest`) | `#143E2B` | Primary brand authority, navigation anchor, active controls, primary CTAs |
| **Forest Green Hover** (`--color-forest-light`) | `#1E573D` | Hover states, secondary forest surfaces |
| **Forest Green Dark** (`--color-forest-dark`) | `#0D2B1E` | Deep control-center headers, pressed states |
| **Forest Subtle** (`--color-forest-surface`) | `#EDF4F0` | Soft tinted pills, active navigation highlights |
| **Warm Ivory** (`--color-canvas`) | `#FAF7F2` | Primary light background surface |
| **Pure White** (`--color-surface`) | `#FFFFFF` | Elevated cards, modals, drawers, tabular data |
| **Warm Neutral Surface** (`--color-surface-elevated`) | `#F5EFE6` | Secondary panels, table headers, input backgrounds |
| **Warm Border** (`--color-card-border`) | `#E5DCD0` | Restrained 1px borders & hairlines |
| **Mangala Orange** (`--color-accent-orange`) | `#D8561C` | Restrained accent for highlights, primary retail actions, active indicators |
| **Mangala Orange Hover** | `#BE4612` | Accent hover & pressed state |
| **Heritage Gold** (`--color-gold`) | `#C99738` | Subtle editorial highlights and dark-mode accent |
| **Deep Charcoal / Obsidian** (`--color-obsidian`) | `#111A15` | Atmospheric dark sections & dark-mode canvas |
| **Charcoal Surface** (`--color-charcoal`) | `#17241E` | Dark-mode cards & panels |
| **Charcoal Elevated** (`--color-charcoal-elevated`) | `#22322A` | Dark-mode interactive surfaces |

### Text Contrast Hierarchy
- **Light Mode:** Primary `#14231A` • Body `#334439` • Muted `#617367` • Subtle `#8A9C91`
- **Dark Mode:** Primary `#FAF7F2` • Secondary `#DDE6E0` • Muted `#9CB0A3`

### Statutory & Operational Semantics
- **Vegetarian (FSSAI):** `#15803D` on `#ECFDF5`
- **Non-Vegetarian (FSSAI):** `#B91C1C` on `#FEF2F2`
- **Success / Captured / In Stock:** `#15803D` on `#ECFDF5`
- **Warning / Preparing / Low Stock:** `#B45309` on `#FEF3C7`
- **Danger / Cancelled / Out of Stock:** `#B91C1C` on `#FEF2F2`
- **Info / Ready for Pickup:** `#0369A1` on `#E0F2FE`

---

## 2. Typography System

- **Display / Editorial Serif:** `Playfair Display` (Web) / `FontFamily.Serif` (Android)
  - Used selectively for hero headlines, section titles, category headings, and brand wordmark.
- **Operational & Body Sans-Serif:** `Plus Jakarta Sans` (Web) / `FontFamily.SansSerif` (Android)
  - Used for navigation, product titles, prices, tabular data, forms, and operational controls.
  - Numeric prices and stock quantities use `font-variant-numeric: tabular-nums` on web for clean vertical alignment.

---

## 3. Platform Adaptation

1. **Customer Website (`apps/customer-web`)**: Editorial asymmetric hero mosaic, dynamic multi-category discovery, interactive showcase, warm ivory catalog with restrained forest green & orange CTAs, smooth reduced-motion-aware transitions.
2. **Admin Control Center (`apps/admin-web`)**: Forest green (`#143E2B`) operational header & navigation bar, warm ivory (`#FAF7F2`) workspace, crisp white (`#FFFFFF`) data cards and tables, tabular numerals for INR totals and stock counts, clear status pills and RBAC role badges.
3. **Android Customer App (`apps/android`)**: Native Jetpack Compose Material 3 adapted to `LightMangalaColors` and `DarkMangalaColors` (`#111A15` obsidian dark canvas, `#143E2B` / `#3CA374` forest green, `#D8561C` Mangala orange), spring-damped tactile interactions, edge-to-edge status/navigation bars, and 48dp+ accessible touch targets.
