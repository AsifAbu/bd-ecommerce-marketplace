# Design direction (UI redesign, phase 1)

Simple, quiet, product-first: clean fashion/eyewear shop feel. White space does the grouping; chrome is almost invisible. Light only (the app is intentionally light). Live reference: `/design` (test mode only). Source of tokens: `web/src/app/globals.css` (`@theme`). Kit: `web/src/components/ui/` (import from `@/components/ui`).

## Rules for page work
- Use semantic tokens: `bg-paper text-ink bg-surface border-line text-muted bg-jade text-vermilion`. Do not use `blue-*`, `gray-*`, `red-*`, `green-*` in new code: the old palette is remapped to these tokens only so pages built before the redesign look right, and those names will be removed later.
- Use kit components. Do not restyle buttons, inputs, cards or badges by hand.
- Hairline borders only where they group information (a table, a form section, the sticky header edge). No decorative dividers, no shadows on cards, no gradients, no emoji or arrow glyphs as icons (use `lucide-react`, `aria-hidden`, 16 to 24px).
- Copy: sentence case, plain, specific, active. Errors say what happened and how to fix it. Empty states invite an action. No all-caps eyebrow labels, no middle-dot meta strings, no "->" on links.
- Touch targets at least 44px (Button md/lg, IconButton, menu rows). `Button size="sm"` (36px) is for dense desktop toolbars only.
- Every interactive thing gets the global focus ring (2px jade, 2px offset). Never remove it.
- A page's `<main>` leaves room for the bottom tab bar automatically (body padding); a sticky bottom bar of your own must sit above it: `bottom-[var(--tabbar-space)] lg:bottom-0`.

## Colour
| Token | Hex | Use | Contrast |
| --- | --- | --- | --- |
| ink | #1B1F1D | text | 16.7 on paper, 15.2 on surface |
| paper | #FFFFFF | page | |
| surface | #F4F5F3 | tiles, placeholders, quiet panels | |
| line | #E3E6E2 | hairline between groups | 1.26 (never the only edge of a control) |
| edge | #7D8680 | border of inputs and controls | 3.75 on paper (>=3 for UI components) |
| muted | #5B645F | secondary text | 6.1 on paper, 5.6 on surface |
| jade | #0E6B57 | brand, links, primary button | 6.4 on paper, 5.9 on surface, white on jade 6.4 |
| jade-hover | #0A5444 | hover | white on it 8.9 |
| jade-soft | #E6F2EE | selected / brand badge background | jade on it 5.6 |
| vermilion | #C93319 | sale price, errors, danger | 5.3 on paper, 4.8 on surface, white on it 5.3 |
| vermilion-hover / -soft | #A82812 / #FCEAE6 | hover, badge background | |
| gold | #E7A91C | rating star fill only | 2.1: never text; the number beside it carries the meaning |
| gold-ink | #8A5F00 | warning text | 5.7 on paper |

Adjusted from the brief: vermilion #D7381E failed AA on surface (4.3), so it is #C93319. Added `edge` because `line` is too faint for input borders.

## Type
- Instrument Sans Variable (Latin) then Anek Bangla Variable (Bengali), then `sans-serif`; self-hosted from npm, `font-display: swap`, split by unicode-range so Bengali loads only when shown. No preload: the CSS asset URLs are hashed by the bundler (revisit if font swap is noticeable on slow links).
- Headings: weight 600, tracking -0.015em, `text-wrap: balance`. In `:lang(bn)` tracking is 0 and line-height 1.65 (conjuncts need room). Mark Bengali content `lang="bn"`.
- Prices and counts: class `tabular` (tabular numerals) or the `Price` component.
- Scale (size / line-height): xs 12/16, sm 14/20, base 16/24 (inputs stay 16 to avoid iOS zoom), lg 18/26, xl 20/28, 2xl 24/30, 3xl 30/36, 4xl 38/42. Page title 3xl to 4xl, section title xl to 2xl, card title sm to base.

## Space, radii, shadow
- Tailwind 4px spacing. Page gutter 16px (phones) / 24px (sm+); max width 76rem (`Container`). Sections separated by 40px (`gap-10`), cards by 12 to 32px.
- Radii: sm 4, md 6 (buttons, inputs, cards), lg 8 (panels, sheets, empty states). All larger names map to 8. `rounded-full` only for count bubbles and avatars.
- Shadow: none, except floating layers (menus, sheets, toasts): `shadow-md` (soft, one definition).

## Breakpoints
sm 640, md 768, lg 1024, xl 1280 (2xl 1536 unused). Below lg: top bar + bottom tab bar + category drawer. From lg: full header, no tab bar. Product grid: 2 columns, 3 from sm, 4 from lg, 5 from xl.

## Motion
Tokens: `--duration-fast` 120ms, `--duration-base` 200ms, `--duration-slow` 320ms, `--ease-out` cubic-bezier(.2,.8,.2,1), `--ease-in-out` cubic-bezier(.6,0,.2,1). Used for: button press (`.pressable`, scale .97), hover/focus colour, drawer slide, menu pop, toast, product image zoom 1.03 on hover. The single "moment" is the drawer. Nothing delays an action; no layout animation. `prefers-reduced-motion: reduce` collapses all animation and transition durations to ~0 and removes the press scale (global rule in `globals.css`).

## Components (`@/components/ui`)
| Component | Rules |
| --- | --- |
| `Button`, `buttonStyles()` | One `primary` per view. `loading` keeps the label and disables. Use `buttonStyles()` on `<Link>` for navigation that looks like a button. |
| `IconButton` | `label` is required (aria-label + tooltip). |
| `Input`, `Textarea`, `Select`, `FormField` | Always wrap in `FormField` for a visible label (render function gives id and aria props). `ActionForm`'s `Field` already uses the same look and wiring. |
| `Badge` | neutral, brand, sale, warning. 1 to 3 words. |
| `Price` | `amount` / `original` / `min`+`max`. Sale price vermilion, original struck in muted, announced in words. `formatTk` is in `@/lib/money`. |
| `Rating` | Renders nothing without data. |
| `ProductCard`, `ProductGrid`, `ProductCardSkeleton`, `ProductGridSkeleton` | 4:5 picture, title 2 lines, price, optional rating, shop (+ verified), out of stock badge. `action` slot sits under the card outside the link: put a future "Try on" button there. Use `ProductGrid` as the list; use the skeleton grid as the Suspense fallback. |
| `ProductThumb` (`components/product-thumb.tsx`) | Picture with neutral surface tile + monogram when missing or broken. |
| `Sheet`, `SheetTrigger`, `SheetContent`, `SheetClose` | Radix Dialog drawer (left, right, bottom). Focus trap, Escape, focus return built in. Wrap links in `SheetClose asChild`. |
| `DropdownMenu*` | Radix action menu (needs JavaScript). |
| `DisclosureMenu` | Native `<details>` navigation menu that works without JavaScript and also closes on Escape, outside click and link click. Header category and account menus use it. |
| `ToastProvider`, `useToast` | Mounted in the root layout. `toast("Added to cart")`. Form results stay inline (ActionForm status). |
| `Skeleton`, `EmptyState`, `Breadcrumbs`, `Pagination` | Server-rendered; Pagination takes `hrefFor(page)`. |
| `Container`, `PageMain`, `Section` | Width, gutters and rhythm. `Section` gives title + quiet "See all" link. |

## Shell
Sticky header (wordmark "Marketplace", category menu, search, Track order / My orders, Wishlist, Cart (N), account menu or Log in / Sign up). Phones: menu button (drawer), wordmark, account; fixed bottom tab bar with Home, Categories, Search, Cart (count), Account, safe-area padded. Footer: shop, sell and policy links plus DBID. Cookie notice and test-mode banner are slim strips above the header (the test banner stays visible in test mode).

## Dependencies (exact versions, `npm audit --omit=dev` shows nothing from them; the 3 existing high findings are nodemailer/next-auth, unrelated)
| Package | Version | Licence | Why |
| --- | --- | --- | --- |
| @fontsource-variable/instrument-sans | 5.3.0 | OFL-1.1 | Latin face, self-hosted (no Google Fonts request, CSP friendly). |
| @fontsource-variable/anek-bangla | 5.3.0 | OFL-1.1 | Bengali face matching Instrument Sans in weight; unicode-range keeps it off pages without Bengali. |
| lucide-react | 1.59.0 | ISC | One consistent line icon set, each icon imported individually (tree-shaken). |
| @radix-ui/react-dialog | 1.3.1 | MIT | Drawer/sheet: focus trap, scroll lock, Escape, aria are hard to get right by hand. |
| @radix-ui/react-dropdown-menu | 2.2.1 | MIT | Keyboard-complete action menus. |

Not added: `motion` (CSS covers everything here), tabs, popover, any UI framework.

## Browse pages (phase 2a)
- Home, `/categories`, `/c/[slug]`, `/search`, `/s/[slug]` use only the kit; no new dependencies. Additive kit change: `ProductGrid` and `ProductGridSkeleton` take `dense` (max 4 columns, for a grid beside the filter column).
- Filters: one `FilterFields` renders in the desktop column (`lg+`, ticking applies at once) and in a bottom `Sheet` below `lg` (one "Apply filters"; the sheet closes when the URL changes). Active filters show as removable chips; the URL stays the only state.
- Result cards get the Verified badge from `features/search/shop-tiers.ts` (one query per page); search documents and search logic are unchanged.
