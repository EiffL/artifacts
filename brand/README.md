<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo/gist-artifacts-lockup-dark.svg">
    <img alt="Gist Artifacts" src="logo/gist-artifacts-lockup.svg" width="420">
  </picture>
</p>

# Gist Artifacts brand

The logo, colours, type and usage rules for [Gist Artifacts](https://gist-artifacts.dev).

- **[branding.pdf](branding.pdf)**: the brand guide, nine pages, to read or send.
- **[guide/index.html](guide/index.html)**: the same guide as a web page. The [`guide`](guide) folder is itself a Gist Artifact: the page beside its `artifact.json`.

## The mark

One stroke draws a page and a G, and stops at a point.

| Element | Meaning |
| --- | --- |
| The stroke, from the folded corner around the sheet | A page: what an agent makes |
| The turn inward | A G, for the Gist the page is kept in |
| The opening | The outline never closes, as the format is open |
| The point, in Marker | The gist: the point of the thing, highlighted |

The stroke is 8.5 units wide on a sheet of 54 × 70. The fold is at 45°, and the point is two strokes wide and sits on the vertical axis of the sheet.

## Which file do I use?

| You need | Use |
| --- | --- |
| The logo, on a light ground | [`logo/gist-artifacts-lockup.svg`](logo/gist-artifacts-lockup.svg) |
| The logo, on a dark ground | [`logo/gist-artifacts-lockup-dark.svg`](logo/gist-artifacts-lockup-dark.svg) |
| A square layout, such as a badge or a sticker | [`logo/gist-artifacts-lockup-stacked.svg`](logo/gist-artifacts-lockup-stacked.svg) (and `-dark`) |
| The mark alone, 32 px and up | [`logo/gist-artifacts-mark.svg`](logo/gist-artifacts-mark.svg) (and `-dark`, `-mono`) |
| The mark at 16 to 24 px: app chrome, headers | [`logo/gist-artifacts-compact.svg`](logo/gist-artifacts-compact.svg) (and `-dark`, `-mono`) |
| One colour: print, photographs, CSS theming | `logo/gist-artifacts-mark-mono.svg`, `logo/gist-artifacts-compact-mono.svg` (they use `currentColor`) |
| A favicon | [`icons/favicon.svg`](icons/favicon.svg), with [`icons/favicon.ico`](icons/favicon.ico) as fallback |
| An application icon with rounded corners | [`icons/app-icon.svg`](icons/app-icon.svg), `icons/icon-512.png`, `icons/icon-256.png` |
| A square icon that the platform masks itself | `icons/apple-touch-icon.png`, `icons/avatar-500.png` |
| A social preview or Open Graph image | [`social/gist-artifacts-social-card-1280x640.png`](social/gist-artifacts-social-card-1280x640.png) (and `-dark`) |
| A PNG of any logo | `logo/png/*@2x.png`, transparent |
| The colours in code or a design tool | [`tokens/colors.css`](tokens/colors.css), [`tokens/colors.json`](tokens/colors.json) |
| The fonts | [`fonts/`](fonts) |

Every SVG is transparent, uses only brand colours, has a title and a description for screen readers, and keeps its ids unique so several can be inlined in one page. Its parts carry classes (`ga-stroke`, `ga-point`, `ga-wordmark`, `ga-highlight`, `ga-tile`), so an inlined copy can be recoloured with CSS.

## On the web

Favicons:

```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

`favicon.svg` switches to the dark colours when the browser is in dark mode. Its style rules are scoped to its own root, so inlining it cannot recolour anything else on the page.

A logo in a GitHub README that follows the reader's theme:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/logo/gist-artifacts-lockup-dark.svg">
  <img alt="Gist Artifacts" src="brand/logo/gist-artifacts-lockup.svg" width="320">
</picture>
```

The colours as CSS custom properties:

```css
@import "tokens/colors.css";  /* --ga-light-ink, --ga-dark-marker, ... */
```

## Colours

| Role | Light grounds | Dark grounds |
| --- | --- | --- |
| Ink: the stroke, the wordmark and text | `#0B0B0C` | `#F4F4F5` |
| Marker: the point, and a highlight behind dark text | `#F2A900` | `#FFB81C` |
| Ground | `#FFFFFF` | `#0B0B0C` |
| Wash: quiet surfaces | `#F4F4F5` | `#18181B` |
| Rule: hairlines and borders | `#E4E4E7` | `#27272A` |
| Graphite: secondary text | `#63636B` | `#A1A1AA` |

Marker is the only colour. It is never the colour of text, and never fills a large area.

## Type

| Face | Use |
| --- | --- |
| Geist Semibold | The wordmark and headings, tracked in by 3% |
| Geist Regular and Medium | Text and interface |
| Geist Mono | Code, file names, revisions and identifiers |

The wordmark in the SVGs is outlined, so it renders without the font installed.

## Rules in brief

- Keep clear space of a quarter of the mark's height on every side.
- Minimum sizes: the mark 32 px tall on screen (9 mm in print); the horizontal logo 24 px tall; below that, the compact mark alone.
- Don't close the outline, move or recolour the point, stretch the logo, or put the light version on a dark ground.
- Don't use the mark as the first letter of the name.
- Don't add shadows, glows, gradients or outlines, rotate the mark, or rebuild the wordmark in another typeface.
- Write **Gist Artifacts** for the project and the format, **an artifact** for one of them, and `gist-artifacts` only in code.

[branding.pdf](branding.pdf) has the full rules with examples.

## Working on the brand

Every file in `logo/`, `icons/` and `social/`, and `tokens/colors.css`, `guide/index.html` and `branding.pdf`, is generated. Change the sources and rebuild.

| To change | Edit |
| --- | --- |
| The mark's geometry, the wordmark or the logo layouts | `PRIMARY`, `COMPACT`, `WORDMARK` and `LOCKUP` in `tools/build_logo.py` |
| A colour | `tokens/colors.json` |
| The guide's text and figures | `tools/build_site.py` (the web guide and the PDF share it) |
| The PDF's page layout | `tools/build_pdf.py` |

```sh
just build   # everything: SVGs, PNGs, tokens, the web guide and branding.pdf
just check   # the brand rules
```

You need [uv](https://docs.astral.sh/uv/) and [just](https://github.com/casey/just); the scripts declare their Python dependencies inline. PNG export needs `rsvg-convert` (librsvg) and `magick` (ImageMagick 7). The PDF needs Chromium; set `CHROMIUM` to its path if it is not on `PATH`.

The build also writes the copies that the rest of the repository uses, listed in `tools/kit.py`: the viewer's icons, social image, `brand.css`, `brand.json` and the static fonts for its generated social cards, the plugin's icon and logo, and the example artifact's logo. `just check` fails when any of them is out of date, and when the viewer's logo component no longer draws the compact mark.

## Licences

The kit is under the repository's [MIT license](../LICENSE). The fonts in `fonts/` are under the SIL Open Font License 1.1 (`fonts/OFL-*.txt`).
