# /// script
# requires-python = ">=3.10"
# dependencies = ["fonttools[woff]>=4.50", "uharfbuzz>=0.39"]
# ///
"""Build the Gist Artifacts logo kit.

The mark is one open stroke and a point.

  * the stroke    starts at the folded corner of a sheet, follows its outline
                  and turns inward before closing: a page, and the G of Gist
  * the opening   the outline never closes, as the format is open
  * the point     where the stroke ends: the gist, highlighted

Colours come from tokens/colors.json. The wordmark is outlined from
fonts/Geist-Variable.woff2, so the SVGs need no font installed.

Usage:
    uv run tools/build_logo.py              everything
    uv run tools/build_logo.py --svg-only   skip the files that need a rasteriser

Besides the kit in this folder, the script writes the copies that the rest of
the repository uses: the files listed in INSTALL in tools/kit.py, and the
viewer's brand.css and brand.json.
PNG export needs rsvg-convert (librsvg) and magick (ImageMagick 7).
"""

from __future__ import annotations

import argparse
import io
import shutil
import subprocess
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

from kit import (DARK, INSTALL, LIGHT, NAME, REPO, ROOT, SLUG, TOKENS, VIEWER_CSS, VIEWER_FONT_DIR,  # noqa: F401
                 VIEWER_FONT_LICENCES, VIEWER_FONTS, VIEWER_JSON, colors_css, viewer_css, viewer_json)

FONTS = ROOT / "fonts"
LOGO_DIR, LOGO_PNG_DIR = ROOT / "logo", ROOT / "logo" / "png"
ICON_DIR, SOCIAL_DIR, TOKEN_DIR = ROOT / "icons", ROOT / "social", ROOT / "tokens"

TAGLINE = ("Shareable pages from your AI agent,", "stored in ", "your own GitHub Gists", ".")
VIEWER_HOST = "gist-artifacts.dev"

MARK_DESC = "one open stroke that draws a page and the letter G, ending at a point"


def f2(x: float) -> str:
    s = f"{x:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


# --- Geometry ----------------------------------------------------------------
# Every number is a position on the centre line of the stroke.

# Primary mark, on a 100-unit square. For 32 px and up.
PRIMARY = dict(
    left=23, right=77, top=15, bottom=85,  # the sheet
    radius=10,  # its three round corners
    fold=18,  # the folded corner takes 18 units off the top and the right edge, at 45 degrees
    bar=55,  # where the stroke turns inward
    stroke=8.5,
    point=8.5,  # radius: the point is two strokes wide
)

# Compact mark, on a 32-unit square, so every edge lands on a pixel at 16 px. For 24 px and below.
COMPACT = dict(left=6, right=26, top=4, bottom=28, radius=4, fold=8, bar=18, stroke=4, point=4)


def stroke_d(g):
    """The stroke: from the fold, around the sheet, inward to its vertical axis."""
    l, r, t, b, rad = g["left"], g["right"], g["top"], g["bottom"], g["radius"]
    cx = (l + r) / 2
    arc = f"A{f2(rad)} {f2(rad)} 0 0 0 "
    return (f"M{f2(r)} {f2(t + g['fold'])}L{f2(r - g['fold'])} {f2(t)}H{f2(l + rad)}"
            f"{arc}{f2(l)} {f2(t + rad)}V{f2(b - rad)}{arc}{f2(l + rad)} {f2(b)}"
            f"H{f2(r - rad)}{arc}{f2(r)} {f2(b - rad)}V{f2(g['bar'])}H{f2(cx)}")


def mark(g, ink, marker):
    """The mark. Returns (markup, ink bounding box)."""
    cx, half = (g["left"] + g["right"]) / 2, g["stroke"] / 2
    body = (f'<path class="ga-stroke" fill="none" stroke="{ink}" stroke-width="{f2(g["stroke"])}" '
            f'stroke-linecap="round" stroke-linejoin="round" d="{stroke_d(g)}"/>'
            f'<circle class="ga-point" fill="{marker}" cx="{f2(cx)}" cy="{f2(g["bar"])}" r="{f2(g["point"])}"/>')
    return body, (g["left"] - half, g["top"] - half, g["right"] + half, g["bottom"] + half)


def square(bbox):
    """The smallest square viewBox around a bounding box."""
    x0, y0, x1, y1 = bbox
    side = max(x1 - x0, y1 - y0)
    return ((x0 + x1 - side) / 2, (y0 + y1 - side) / 2, side, side)


# --- Type ----------------------------------------------------------------------
class Face:
    """One instance of a variable font, for outlining a line of text."""

    def __init__(self, file: str, **location):
        font = TTFont(FONTS / file)
        full = {a.axisTag: location.get(a.axisTag, a.defaultValue) for a in font["fvar"].axes}
        self.font = instancer.instantiateVariableFont(font, full, inplace=False)
        self.font.flavor = None
        data = io.BytesIO()
        self.font.save(data)
        self.shaper = hb.Font(hb.Face(data.getvalue()))
        self.upm = self.font["head"].unitsPerEm
        self.glyphs = self.font.getGlyphSet()

    def cap_height(self, size):
        return self.font["OS/2"].sCapHeight * size / self.upm

    def line(self, text, size, tracking=0.0):
        """Outline `text` from x=0 on the baseline y=0. Returns (path data, advance, ink bounds)."""
        k = size / self.upm
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.shaper, buf, {"kern": True, "liga": True})
        x, d, bounds = 0.0, "", BoundsPen(self.glyphs)
        last = len(buf.glyph_infos) - 1
        for i, (info, pos) in enumerate(zip(buf.glyph_infos, buf.glyph_positions)):
            glyph = self.glyphs[self.font.getGlyphName(info.codepoint)]
            place = (k, 0, 0, -k, (x + pos.x_offset) * k, -pos.y_offset * k)
            pen = SVGPathPen(self.glyphs, ntos=f2)
            glyph.draw(TransformPen(pen, place))
            glyph.draw(TransformPen(bounds, place))
            d += pen.getCommands()
            x += pos.x_advance + (tracking * self.upm if i < last else 0)
        return d, x * k, bounds.bounds


def write_static_fonts():
    """One-weight TrueType cuts of the variable fonts, for renderers that need them."""
    VIEWER_FONT_DIR.mkdir(parents=True, exist_ok=True)
    for name, (source, weight) in VIEWER_FONTS.items():
        font = TTFont(FONTS / source, recalcTimestamp=False)
        full = {a.axisTag: (weight if a.axisTag == "wght" else a.defaultValue) for a in font["fvar"].axes}
        cut = instancer.instantiateVariableFont(font, full, inplace=False)
        cut.flavor = None
        cut.recalcTimestamp = False
        # The card renderer applies this font's pair kerning to the wrong pairs, which opens
        # uneven gaps between words. Without the table it sets plain advances, evenly.
        if "GPOS" in cut:
            del cut["GPOS"]
        cut.save(VIEWER_FONT_DIR / name)
    for licence in VIEWER_FONT_LICENCES:
        shutil.copyfile(FONTS / licence, VIEWER_FONT_DIR / licence)


# The wordmark: Geist Semibold, tracked in by 3% of the type size.
WORDMARK = dict(file="Geist-Variable.woff2", wght=600, tracking=-0.03)
# Lockups, as fractions of the mark's height.
LOCKUP = dict(cap=0.36, gap=0.20, stacked_cap=0.22, stacked_gap=0.24)


def wordmark(cap, ink):
    """The name with the given cap height. Returns (path data, ink bounds), baseline at y=0."""
    face = Face(WORDMARK["file"], wght=WORDMARK["wght"])
    size = cap / face.cap_height(1)
    d, _, bounds = face.line(NAME, size, WORDMARK["tracking"])
    return d, bounds


def lockup(c, stacked=False):
    """Mark and wordmark. Returns (markup, ink bounding box)."""
    body, (x0, y0, x1, y1) = mark(PRIMARY, c["ink"], c["marker"])
    h = y1 - y0
    if stacked:
        cap = LOCKUP["stacked_cap"] * h
        d, b = wordmark(cap, c["ink"])
        tx = (x0 + x1) / 2 - (b[0] + b[2]) / 2
        ty = y1 + LOCKUP["stacked_gap"] * h + cap
        box = (min(x0, tx + b[0]), y0, max(x1, tx + b[2]), ty - b[1])
    else:
        cap = LOCKUP["cap"] * h
        d, b = wordmark(cap, c["ink"])
        tx = x1 + LOCKUP["gap"] * h - b[0]
        ty = (y0 + y1) / 2 + cap / 2  # the capitals are centred on the mark
        box = (x0, min(y0, ty - b[3]), tx + b[2], max(y1, ty - b[1]))
    body += f'<path class="ga-wordmark" fill="{c["ink"]}" transform="translate({f2(tx)} {f2(ty)})" d="{d}"/>'
    return body, box


def padded(bbox, pad):
    x0, y0, x1, y1 = bbox
    return (x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad)


# --- Documents -----------------------------------------------------------------
def doc(body, viewbox, title, desc, cls="", head=""):
    """A standalone SVG. __ID__ becomes the file name, so ids stay unique across the kit."""
    vb = " ".join(f2(v) for v in viewbox)
    attr = f' class="{cls}"' if cls else ""
    return (f'<svg{attr} xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-labelledby="__ID__-t __ID__-d">'
            f'<title id="__ID__-t">{title}</title><desc id="__ID__-d">{desc}</desc>{head}{body}</svg>\n')


def build_marks():
    files = {}
    for suffix, c in (("", LIGHT), ("-dark", DARK), ("-mono", dict(ink="currentColor", marker="currentColor"))):
        note = {"": "", "-dark": ", for dark grounds", "-mono": ", in one colour"}[suffix]
        body, bbox = mark(PRIMARY, c["ink"], c["marker"])
        files[f"{SLUG}-mark{suffix}"] = doc(body, square(bbox), NAME, f"{NAME} mark{note}: {MARK_DESC}.")
        body, _ = mark(COMPACT, c["ink"], c["marker"])
        files[f"{SLUG}-compact{suffix}"] = doc(body, (0, 0, 32, 32), NAME,
                                               f"{NAME} compact mark{note}: {MARK_DESC}, drawn heavier for small sizes.")
    return files


def build_lockups():
    files = {}
    for suffix, c in (("", LIGHT), ("-dark", DARK)):
        note = ", for dark grounds" if suffix else ""
        body, bbox = lockup(c)
        files[f"{SLUG}-lockup{suffix}"] = doc(body, padded(bbox, 1), NAME, f"{NAME} logo{note}: the mark followed by the name.")
        body, bbox = lockup(c, stacked=True)
        files[f"{SLUG}-lockup-stacked{suffix}"] = doc(body, padded(bbox, 1), NAME,
                                                      f"{NAME} logo, stacked{note}: the mark above the name.")
    return files


def build_favicon():
    """The compact mark, switching to the dark colours with the browser."""
    body, _ = mark(COMPACT, LIGHT["ink"], LIGHT["marker"])
    root = ".ga-favicon"
    rules = (f'{root} [stroke="{LIGHT["ink"]}"]{{stroke:{DARK["ink"]}}}'
             f'{root} [fill="{LIGHT["marker"]}"]{{fill:{DARK["marker"]}}}')
    style = f"<style>@media (prefers-color-scheme:dark){{{rules}}}</style>"
    return doc(body, (0, 0, 32, 32), NAME, f"{NAME} compact mark: {MARK_DESC}.", cls="ga-favicon", head=style)


def tile(size, radius, height):
    """The reversed mark on an Ink tile, for application icons and avatars."""
    c = DARK
    body, (x0, y0, x1, y1) = mark(PRIMARY, c["ink"], c["marker"])
    k = size * height / (y1 - y0)
    tx, ty = size / 2 - (x0 + x1) / 2 * k, size / 2 - (y0 + y1) / 2 * k
    return (f'<rect class="ga-tile" width="{size}" height="{size}" rx="{f2(size * radius)}" fill="{c["ground"]}"/>'
            f'<g transform="translate({f2(tx)} {f2(ty)}) scale({f2(k)})">{body}</g>')


def build_app_icon(radius=0.225, height=0.56):
    return doc(tile(512, radius, height), (0, 0, 512, 512), NAME,
               f"{NAME} application icon: the mark, reversed, on a dark tile.")


def build_social(c):
    """GitHub and Open Graph preview card, 1280 x 640."""
    W, H, side = 1280, 640, 96
    body, (x0, y0, x1, y1) = lockup(c)
    k = 640 / (x1 - x0)
    logo = f'<g transform="translate({f2(side - x0 * k)} {f2(236 - (y0 + y1) / 2 * k)}) scale({f2(k)})">{body}</g>'
    text = Face("Geist-Variable.woff2", wght=400)
    size, parts, x = 42, [], float(side)
    first, lead, phrase, tail = TAGLINE
    d, _, _ = text.line(first, size)
    parts.append(f'<path class="ga-tagline" fill="{c["graphite"]}" transform="translate({side} 420)" d="{d}"/>')
    # The second line, with one phrase under the marker.
    on_marker = LIGHT["ink"]  # dark text on the marker, in both schemes
    for chunk, kind in ((lead, "plain"), (phrase, "marked"), (tail, "plain")):
        d, advance, _ = text.line(chunk, size)
        if kind == "marked":
            parts.append(f'<rect class="ga-highlight" x="{f2(x - 8)}" y="{480 - 41}" width="{f2(advance + 16)}" height="56" rx="6" fill="{c["marker"]}"/>')
        fill = on_marker if kind == "marked" else c["graphite"]
        parts.append(f'<path class="ga-tagline" fill="{fill}" transform="translate({f2(x)} 480)" d="{d}"/>')
        x += advance
    mono = Face("GeistMono-Variable.woff2", wght=400)
    d, _, _ = mono.line(VIEWER_HOST, 26)
    parts.append(f'<path class="ga-url" fill="{c["ink"]}" transform="translate({side} 572)" d="{d}"/>')
    frame = f'<rect x="24.5" y="24.5" width="{W - 49}" height="{H - 49}" fill="none" stroke="{c["rule"]}"/>'
    page = f'<rect width="{W}" height="{H}" fill="{c["ground"]}"/>{frame}{logo}{"".join(parts)}'
    return doc(page, (0, 0, W, H), NAME, f"{NAME} social preview card: the logo, with the line {first} {lead}{phrase}{tail}")


# --- Raster export ---------------------------------------------------------------
def render_png(svg_path: Path, png_path: Path, w: int, h: int | None = None):
    cmd = ["rsvg-convert", "-w", str(w), "-h", str(h or w), str(svg_path), "-o", str(png_path)]
    if h is None:
        cmd.insert(5, "-a")
    subprocess.run(cmd, check=True)


def render_markup(markup: str, png_path: Path, w: int):
    tmp = png_path.with_suffix(".tmp.svg")
    tmp.write_text(markup.replace("__ID__", "tmp"))
    render_png(tmp, png_path, w)
    tmp.unlink()


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--svg-only", action="store_true", help="skip PNG and ICO export")
    args = ap.parse_args()

    for d in (LOGO_DIR, LOGO_PNG_DIR, ICON_DIR, SOCIAL_DIR):
        d.mkdir(parents=True, exist_ok=True)
    (TOKEN_DIR / "colors.css").write_text(colors_css())
    VIEWER_CSS.write_text(viewer_css())
    VIEWER_JSON.write_text(viewer_json())
    write_static_fonts()

    outputs = {LOGO_DIR / f"{n}.svg": t for n, t in {**build_marks(), **build_lockups()}.items()}
    outputs[ICON_DIR / "favicon.svg"] = build_favicon()
    outputs[ICON_DIR / "app-icon.svg"] = build_app_icon()
    outputs[SOCIAL_DIR / f"{SLUG}-social-card.svg"] = build_social(LIGHT)
    outputs[SOCIAL_DIR / f"{SLUG}-social-card-dark.svg"] = build_social(DARK)
    for path, text in outputs.items():
        path.write_text(text.replace("__ID__", path.stem))

    if not args.svg_only:
        logo = lambda n: LOGO_DIR / f"{SLUG}-{n}.svg"  # noqa: E731
        # Favicons from the compact mark, transparent.
        for px in (16, 32, 48):
            render_png(logo("compact"), ICON_DIR / f"favicon-{px}.png", px)
        subprocess.run(["magick", *(str(ICON_DIR / f"favicon-{p}.png") for p in (16, 32, 48)),
                        str(ICON_DIR / "favicon.ico")], check=True)
        # Application icons: rounded where the corners may show, square where the platform masks them.
        render_png(ICON_DIR / "app-icon.svg", ICON_DIR / "icon-512.png", 512)
        render_png(ICON_DIR / "app-icon.svg", ICON_DIR / "icon-256.png", 256)
        render_markup(doc(tile(512, 0, 0.56), (0, 0, 512, 512), NAME, NAME), ICON_DIR / "apple-touch-icon.png", 180)
        render_markup(doc(tile(512, 0, 0.5), (0, 0, 512, 512), NAME, NAME), ICON_DIR / "avatar-500.png", 500)
        # 2x rasters of the logos, transparent.
        for name in ("mark", "mark-dark", "compact", "compact-dark",
                     "lockup", "lockup-dark", "lockup-stacked", "lockup-stacked-dark"):
            width = 1200 if name.startswith("lockup") and "stacked" not in name else 600
            render_png(logo(name), LOGO_PNG_DIR / f"{SLUG}-{name}@2x.png", width)
        for suffix in ("", "-dark"):
            render_png(SOCIAL_DIR / f"{SLUG}-social-card{suffix}.svg",
                       SOCIAL_DIR / f"{SLUG}-social-card{suffix}-1280x640.png", 1280, 640)

    # Copies used by the viewer and the plugin.
    for source, targets in INSTALL.items():
        if (ROOT / source).suffix != ".svg" and args.svg_only:
            continue
        for target in targets:
            shutil.copyfile(ROOT / source, REPO / target)


if __name__ == "__main__":
    main()
