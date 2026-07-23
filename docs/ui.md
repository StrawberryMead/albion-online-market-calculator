# UI design

## Theme: moonlit graveyard with white lily

Visual mood: cold midnight, weathered stone panels, and a solitary pale lily as the accent.
The palette is anchored in `:root` variables inside `css/theme.css`.

### Palette

| Token              | Value      | Usage                              |
|--------------------|------------|------------------------------------|
| `--bg-deep`        | `#0a0e1a`  | Page background base               |
| `--bg-mid`         | `#121828`  | Card background solid              |
| `--bg-panel`       | rgba mid   | Card background translucent        |
| `--stone`          | `#4a4e5a`  | Panel borders                      |
| `--moon-silver`    | `#c5d1e8`  | Body text                          |
| `--moon-dim`       | `#8892a8`  | Muted / helper text                |
| `--lily-white`     | `#f8f8ff`  | Headings, key accents              |
| `--accent-cool`    | `#9db6ff`  | Links, active tab glow             |
| `--success`        | `#8fbc8f`  | Positive profit                    |
| `--warning`        | `#daa520`  | Batch pill                         |
| `--danger`         | `#b0384a`  | Negative profit / errors           |

### Typography

- Headings: `Cinzel` (serif) with wide tracking - evokes engraved gravestones.
- Body: `Lato` (sans-serif) for readability.

### Decorative layers

- `body::before` paints a subtle SVG rolling-fog pattern.
- `.lily-backdrop` draws two blurred moonlit lily silhouettes at fixed positions with radial
  gradients; extra scattered white specks act as distant petals or stars.
- The brand mark in the header is an inline SVG stylized lily bloom with a soft white glow.

## Layout

- **Header**: brand + tab nav + server badge. Sticky look via translucent gradient and
  `backdrop-filter: blur(6px)`.
- **Main**: a max-width 1280px column with cards.
- **Crafting tab layout**: `.grid.side` = 360px sidebar (search) + main pane (recipe + bonus
  controls + metrics).
- **Metrics row**: auto-fit grid, minimum 150px per metric tile.
- **Toasts**: fixed bottom-right, non-interactive.

## Component library

- `.card` - stone panel with border + soft shadow + blur backdrop.
- `.search-list` - scrollable id/name list with hover highlight.
- `.metric` - label + big value tile; `.pos` / `.neg` / `.mut` color the value.
- `.batch-pill` - amber-tinted pill that always shows the current recipe batch size.
- `.tag` - small caps pill used for item ids and price source labels.
- `.spinner` - inline loading indicator.
- Inputs use a carved-stone gradient with a soft moonlit focus ring.

## Accessibility notes

- Tabs use `role="tab"` and `role="tabpanel"`.
- Focus rings on inputs are visible (soft blue ring, not `outline: none`).
- All interactive controls are real `<button>` / `<a>` / form elements.
- Toasts announce via `aria-live="polite"`.
- Palette maintains at least 4.5:1 contrast for body text on the base background.
