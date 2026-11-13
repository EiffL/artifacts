# /// script
# requires-python = ">=3.10"
# dependencies = ["fonttools[woff]>=4.50", "uharfbuzz>=0.39"]
# ///
"""Build guide/index.html, the web version of the Gist Artifacts brand guide.

    uv run tools/build_site.py

The guide's content (figures, rules, colour chips, type specimens, file list)
lives in this module; tools/build_pdf.py imports it to lay out branding.pdf, so
the two never disagree. Run tools/build_logo.py first: the guide inlines the
SVGs it writes.

guide/ is itself a Gist Artifact: index.html beside the artifact.json manifest.
"""

from __future__ import annotations

import html
import re
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
sys.path.insert(0, str(TOOLS))
import build_logo as B  # noqa: E402
from kit import TEXT_PAIRS, pair_ratio  # noqa: E402

REPO_URL = "https://github.com/EiffL/gist-artifacts"
KIT_URL = f"{REPO_URL}/tree/main/brand"
PDF_URL = f"{REPO_URL}/blob/main/brand/branding.pdf"
VERSION = "Version 1.0 · November 2026"
ASSET_DIRS = (ROOT / "logo", ROOT / "icons", ROOT / "social")
FONTS_URL = "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap"
f2 = B.f2
_instances = 0


# --- Inlining ------------------------------------------------------------------
def svg(name, cls="", decorative=False, width=None, height=None):
    """Inline a published SVG, renaming its ids so repeated copies stay unique."""
    global _instances
    _instances += 1
    path = next((d / f"{name}.svg" for d in ASSET_DIRS if (d / f"{name}.svg").exists()), None)
    if path is None:
        raise FileNotFoundError(f"{name}.svg: run tools/build_logo.py first")
    s = path.read_text().strip()
    s = re.sub(rf"\b{re.escape(name)}-(t|d)\b", rf"{name}-i{_instances}-\1", s)
    if decorative:
        s = re.sub(r"<title[^>]*>.*?</title><desc[^>]*>.*?</desc>", "", s)
        s = re.sub(r'role="img" aria-labelledby="[^"]*"', 'aria-hidden="true" focusable="false"', s)
    attrs = "".join(f' {k}="{v}"' for k, v in (("class", cls), ("width", width), ("height", height)) if v)
    return s.replace("<svg ", f"<svg{attrs} ", 1)


def logo(name, **kw):
    return svg(f"{B.SLUG}-{name}", **kw)


def themed(markup):
    """Recolour generated markup with the page's own tokens, so a figure follows the page theme."""
    return (markup.replace('stroke="INK"', 'style="stroke:var(--ink)"')
            .replace('fill="INK"', 'style="fill:var(--ink)"')
            .replace('fill="MARKER"', 'style="fill:var(--marker)"'))


def figure(body, viewbox, label, cls=""):
    vb = " ".join(f2(v) for v in viewbox)
    attr = f' class="{cls}"' if cls else ""
    return f'<svg{attr} viewBox="{vb}" role="img" aria-label="{html.escape(label)}">{body}</svg>'


def themed_mark(cls="", geometry=None):
    body, bbox = B.mark(geometry or B.PRIMARY, "INK", "MARKER")
    return figure(themed(body), B.square(bbox), f"The {B.NAME} mark", cls)


def themed_lockup(cls=""):
    body, bbox = B.lockup(dict(ink="INK", marker="MARKER"))
    return figure(themed(body), B.padded(bbox, 1), f"The {B.NAME} logo", cls)


# --- Plate: the mark -----------------------------------------------------------------
LEGEND = [
    ("A page", "The stroke starts at the folded corner and follows the outline of a sheet."),
    ("A G", "It turns inward before closing, so the sheet is also the initial of Gist."),
    ("Open", "The outline never closes. The format is open: anyone can write an artifact, or display one."),
    ("The point", "Where the stroke ends. The gist of something is its point, and here it is highlighted."),
]


def legend_html():
    return '<dl class="legend">' + "".join(f"<div><dt>{t}</dt><dd>{d}</dd></div>" for t, d in LEGEND) + "</dl>"


def steps_html():
    """How the mark is built, in three drawings."""
    g = B.PRIMARY
    l, r, t, b, rad, fold = g["left"], g["right"], g["top"], g["bottom"], g["radius"], g["fold"]
    arc = f"A{rad} {rad} 0 0 0 "
    sheet = (f"M{r} {t + fold}L{r - fold} {t}H{l + rad}{arc}{l} {t + rad}V{b - rad}{arc}{l + rad} {b}"
             f"H{r - rad}{arc}{r} {b - rad}Z")
    thin = 'fill="none" stroke-linejoin="round" stroke-linecap="round" style="stroke:var(--graphite)"'
    vb = B.square((l - 4.25, t - 4.25, r + 4.25, b + 4.25))
    stroke = (f'<path fill="none" stroke-width="{g["stroke"]}" stroke-linecap="round" stroke-linejoin="round" '
              f'style="stroke:var(--ink)" d="{B.stroke_d(g)}"/>')
    ghost = f'<path {thin} stroke-width="1" stroke-dasharray="2.4 2.4" d="M{r} {t + fold}V{g["bar"]}"/>'
    point = f'<circle style="fill:var(--marker)" cx="{(l + r) / 2}" cy="{g["bar"]}" r="{g["point"]}"/>'
    drawings = [
        (f'<path {thin} stroke-width="2" d="{sheet}"/><path {thin} stroke-width="2" d="M{r - fold} {t}V{t + fold}H{r}"/>',
         "A sheet with a folded corner, as every file icon draws it."),
        (stroke + ghost, "The outline opens below the fold and turns inward. It is now a G."),
        (stroke + point, "The stroke ends at a point, on the vertical axis of the sheet."),
    ]
    items = "".join(
        f'<li>{figure(body, vb, text)}<p><b>{i}</b> {text}</p></li>' for i, (body, text) in enumerate(drawings, 1))
    return f'<ol class="steps">{items}</ol>'


def proportions_html():
    g = B.PRIMARY
    rows = [
        ("Sheet", f"{g['right'] - g['left']} × {g['bottom'] - g['top']} units, measured on the centre line of the stroke"),
        ("Stroke", f"{f2(g['stroke'])} units, with round ends and joins"),
        ("Corners", f"radius {g['radius']}; the fold cuts {g['fold']} units off two edges, at 45°"),
        ("Point", "two strokes wide, centred on the end of the stroke"),
    ]
    return '<dl class="facts">' + "".join(f"<div><dt>{k}</dt><dd>{v}</dd></div>" for k, v in rows) + "</dl>"


# --- Plate: versions ---------------------------------------------------------------
def panel(inner, cls="", caption="", files=""):
    cap = f"<figcaption>{caption}{f'<code>{files}</code>' if files else ''}</figcaption>" if caption or files else ""
    return f'<figure class="fig"><div class="panel {cls}">{inner}</div>{cap}</figure>'


def versions_html():
    s = B.SLUG
    return (
        '<div class="panels p-wide">'
        + panel(logo("lockup", cls="w-lockup"), "", "<b>Horizontal.</b> The default logo, for headers and READMEs.", f"logo/{s}-lockup.svg")
        + panel(logo("lockup-dark", cls="w-lockup"), "dark", "<b>On dark grounds.</b>", f"logo/{s}-lockup-dark.svg")
        + "</div>"
        '<div class="panels p-four">'
        + panel(logo("lockup-stacked", cls="w-stack"), "", "<b>Stacked.</b> For square spaces.", f"logo/{s}-lockup-stacked.svg")
        + panel(logo("mark", cls="w-mark"), "", "<b>Mark.</b> 32 px and up.", f"logo/{s}-mark.svg")
        + panel(logo("compact", cls="w-mark"), "", "<b>Compact mark.</b> 24 px and below.", f"logo/{s}-compact.svg")
        + panel(logo("mark-mono", cls="w-mark"), "wash", "<b>One colour.</b> Takes the text colour.", f"logo/{s}-mark-mono.svg")
        + "</div>"
    )


# --- Plate: space and size ---------------------------------------------------------
def clearspace_svg():
    body, (x0, y0, x1, y1) = B.mark(B.PRIMARY, "INK", "MARKER")
    x = (y1 - y0) / 4
    dash = 'fill="none" stroke-width="0.7" stroke-dasharray="2.2 2.2" style="stroke:var(--graphite)"'
    label = 'font-size="6.4" text-anchor="middle" style="fill:var(--graphite);font-family:var(--f-mono)"'
    tick = 'fill="none" stroke-width="0.7" style="stroke:var(--graphite)"'
    extra = (
        f'<rect {dash} x="{f2(x0)}" y="{f2(y0)}" width="{f2(x1 - x0)}" height="{f2(y1 - y0)}"/>'
        f'<rect {dash} x="{f2(x0 - x)}" y="{f2(y0 - x)}" width="{f2(x1 - x0 + 2 * x)}" height="{f2(y1 - y0 + 2 * x)}"/>'
        f'<path {tick} d="M{f2(x0 - x)} {f2((y0 + y1) / 2)}H{f2(x0)}M{f2((x0 + x1) / 2)} {f2(y0 - x)}V{f2(y0)}"/>'
        f'<text {label} x="{f2(x0 - x / 2)}" y="{f2((y0 + y1) / 2 - 3)}">x</text>'
        f'<text {label} x="{f2((x0 + x1) / 2 + 6)}" y="{f2(y0 - x / 2 + 2.2)}">x</text>'
    )
    vb = (x0 - x - 3, y0 - x - 3, x1 - x0 + 2 * x + 6, y1 - y0 + 2 * x + 6)
    return figure(themed(body) + extra, vb, "Clear space: one quarter of the mark's height on every side", "w-clear")


SIZES = [
    ("Mark", "32 px tall", "9 mm tall"),
    ("Compact mark", "16 to 24 px", "below 9 mm"),
    ("Horizontal logo", "24 px tall", "7 mm tall"),
    ("Stacked logo", "64 px tall", "18 mm tall"),
]
SIZES_NOTE = "Print sizes are the screen sizes at 96 dpi, rounded up. Below 24 px, show the compact mark alone and write the name in text."


def sizes_table():
    rows = "".join(f"<tr><th scope=\"row\">{a}</th><td>{b}</td><td>{c}</td></tr>" for a, b, c in SIZES)
    return ('<table class="tbl"><thead><tr><th scope="col">Minimum size</th><th scope="col">Screen</th>'
            f'<th scope="col">Print</th></tr></thead><tbody>{rows}</tbody></table><p class="note">{SIZES_NOTE}</p>')


def ladder(dark=False):
    sfx = "-dark" if dark else ""
    cells = "".join(
        f'<span class="rung">{logo(("compact" if px <= 24 else "mark") + sfx, decorative=True, width=px, height=px)}<small>{px}</small></span>'
        for px in (16, 20, 24, 32, 48, 64, 96))
    return f'<div class="ladder">{cells}</div>'


def space_html():
    return (
        '<div class="cols">'
        f'<div>{clearspace_svg()}<p class="note">Keep clear space of <b>x</b>, one quarter of the mark\'s height, on every side '
        "of the mark and of the logo. Nothing else enters it: no text, no edge, no other logo.</p></div>"
        f"<div>{sizes_table()}"
        '<div class="panels p-stack">'
        + panel(ladder(), "", "Compact at 16, 20 and 24 px; the mark from 32 px, at true pixel size.")
        + panel(ladder(dark=True), "dark")
        + "</div></div></div>"
    )


# --- Plate: colour -----------------------------------------------------------------
TOKEN_NAMES = dict(ink="Ink", marker="Marker", ground="Ground", wash="Wash", rule="Rule", graphite="Graphite")
TOKEN_ORDER = ("ink", "marker", "ground", "wash", "rule", "graphite")


def chips(scheme):
    out = ['<ul class="chips">']
    for key in TOKEN_ORDER:
        tok = B.TOKENS[scheme][key]
        out.append(
            f'<li><span class="chip" style="background:{tok["$value"]}"></span><b>{TOKEN_NAMES[key]}</b>'
            f'<code>{tok["$value"]}</code><code>--ga-{scheme}-{key}</code><p>{tok["$description"]}</p></li>')
    out.append("</ul>")
    return "".join(out)


def contrast_table():
    rows = "".join(f'<tr><th scope="row">{p[0]}</th><td>{pair_ratio(p):.1f} : 1</td></tr>' for p in TEXT_PAIRS)
    return f'<table class="tbl t-contrast"><thead><tr><th scope="col">Text pair</th><th scope="col">Contrast</th></tr></thead><tbody>{rows}</tbody></table>'


MARKER_RULES = [
    "Marker has two uses: the point in the mark, and a highlight behind dark text.",
    "It is never the colour of text, and never fills a large area.",
    "Highlight a phrase, not a paragraph. One per screen is usually enough.",
    "Everything else is Ink, Graphite and the three neutrals.",
]


def colour_html():
    rules = "".join(f"<li>{r}</li>" for r in MARKER_RULES)
    return (
        f'<h3>On light grounds</h3>{chips("light")}<h3>On dark grounds</h3>{chips("dark")}'
        '<div class="cols c-rules">'
        f'<div><h3>Using Marker</h3><ul class="bullets">{rules}</ul>'
        '<p class="sample">An artifact is a Gist <mark>you own</mark>.</p></div>'
        f"<div><h3>Legibility</h3>{contrast_table()}</div></div>"
    )


# --- Plate: type -------------------------------------------------------------------
TYPE = [
    ("Geist Semibold", "The wordmark and headings, tracked in by 3%", "t-head", "Shareable pages from your agent"),
    ("Geist Regular and Medium", "Text and interface", "t-body",
     "Every update is a new revision, and nobody needs an account to view it. <b>Medium</b> marks a label or a name."),
    ("Geist Mono", "Code, file names, revisions and identifiers", "t-mono",
     'gist-artifacts publish ./out --title "Cosmology Explorer"'),
]
TYPE_RULES = [
    "Sentence case everywhere: headings, buttons and labels.",
    "Two weights on a screen are usually enough: Regular with Semibold, or Regular with Medium.",
    "Set numbers that line up in columns with tabular figures.",
    "Small labels in Geist Mono may be upper case, spaced out by 8%.",
]
TYPE_NOTE = ("Geist and Geist Mono are in <code>fonts/</code> under the SIL Open Font License, and on Google Fonts. "
             "The wordmark in the logo files is outlined, so they need no font installed.")


def type_html():
    rows = "".join(
        f'<div class="trow"><div><b>{name}</b><span>{role}</span></div><div class="{cls}">{sample}</div></div>'
        for name, role, cls, sample in TYPE)
    rules = "".join(f"<li>{r}</li>" for r in TYPE_RULES)
    return f'<div class="type">{rows}</div><ul class="bullets b-two">{rules}</ul><p class="note">{TYPE_NOTE}</p>'


# --- Plate: usage ------------------------------------------------------------------
DOS = [
    "Use the light versions on light grounds and the dark versions on dark grounds.",
    "Use the one-colour mark for single-colour printing, on photographs, and where a page sets its own colours.",
    "Keep clear space of a quarter of the mark's height on every side.",
    "At 24 px and below, use the compact mark.",
]
NAME_RULES = [
    "Write <b>Gist Artifacts</b>, two words with capitals, for the project and the format.",
    "One of them is <b>an artifact</b>, in lower case. <b>Gist</b> keeps its capital: it is GitHub's name for the thing an artifact is stored in.",
    "<code>gist-artifacts</code> is for code: the plugin, the tool and its commands.",
]
NEVERS = ("Never add shadows, glows, gradients or outlines; never rotate the mark; never rebuild the wordmark in another "
          "typeface; and never set the mark beside GitHub's logos in a way that suggests the project is GitHub's.")


def bare(body, bbox, label, attrs="", pad=4):
    x0, y0, x1, y1 = bbox
    return f'<svg viewBox="{f2(x0 - pad)} {f2(y0 - pad)} {f2(x1 - x0 + 2 * pad)} {f2(y1 - y0 + 2 * pad)}" role="img" aria-label="{label}"{attrs}>{body}</svg>'


def donts():
    L, D, g = B.LIGHT, B.DARK, B.PRIMARY
    body, bbox = B.mark(g, L["ink"], L["marker"])
    closed = body.replace(B.stroke_d(g), B.stroke_d(g).replace(f"M{g['right']} {g['top'] + g['fold']}", f"M{g['right']} {g['bar']}V{g['top'] + g['fold']}"))
    recoloured, _ = B.mark(g, L["ink"], "#2F6FEB")
    moved = body.replace(f'cx="{f2((g["left"] + g["right"]) / 2)}" cy="{f2(g["bar"])}"', f'cx="{f2(g["right"] - g["fold"] / 2)}" cy="{f2(g["top"] + g["fold"] / 2)}"')
    # The mark standing in for the first letter of the name.
    face = B.Face(B.WORDMARK["file"], wght=B.WORDMARK["wght"])
    h = bbox[3] - bbox[1]
    size = h * 0.92 / face.cap_height(1)
    d, _, b = face.line("ist", size, B.WORDMARK["tracking"])
    tx = bbox[2] + 5 - b[0]
    letter = body + f'<path fill="{L["ink"]}" transform="translate({f2(tx)} {f2(bbox[3] - 3)})" d="{d}"/>'
    letter_box = (bbox[0], bbox[1], tx + b[2], bbox[3])
    wide = 1.7  # the mark pulled sideways
    stretched = bare(f'<g transform="scale({wide} 1)">{body}</g>',
                     (bbox[0] * wide, bbox[1] + 12, bbox[2] * wide, bbox[3] - 12), "The mark stretched sideways")
    return [
        (bare(closed, bbox, "The mark with its outline closed"), "",
         "Don't close the outline", "The opening is what makes the sheet a G, and what says the format is open."),
        (bare(recoloured, bbox, "The mark with a blue point"), "",
         "Don't recolour the point", "The point is Marker, or the same colour as the stroke in the one-colour version."),
        (bare(moved, bbox, "The mark with its point moved to the fold"), "",
         "Don't move the point", "It sits on the end of the stroke, on the axis of the sheet."),
        (bare(letter, letter_box, "The mark used as the letter G of Gist"), "",
         "Don't use the mark as a letter", "The mark stands beside the name. It never replaces its first letter."),
        (stretched, "",
         "Don't stretch or skew", "Scale the mark and the logo only in proportion."),
        (bare(body, bbox, "The light version on a dark ground"), "dim",
         "Don't use the light version on a dark ground", "Use the dark version, or the one-colour mark in a light colour."),
    ]


def usage_html():
    cells = "".join(
        f'<figure class="dont"><div class="panel {cls}">{fig}<span class="cross" aria-hidden="true"></span></div>'
        f"<figcaption><b>{title}</b>{text}</figcaption></figure>" for fig, cls, title, text in donts())
    dos = "".join(f"<li>{d}</li>" for d in DOS)
    names = "".join(f"<li>{n}</li>" for n in NAME_RULES)
    return (
        '<div class="cols c-usage">'
        f'<div><h3>Do</h3><ul class="bullets">{dos}</ul></div>'
        f'<div><h3>The name</h3><ul class="bullets">{names}</ul></div></div>'
        f'<h3>Don\'t</h3><div class="donts">{cells}</div><p class="note">{NEVERS}</p>'
    )


# --- Plate: in use -----------------------------------------------------------------
def in_use_html():
    fav = lambda sfx: logo("compact" + sfx, decorative=True, width=16, height=16)  # noqa: E731
    tabs = (
        '<div class="tabs">'
        f'<div class="tabstrip"><div class="tab">{fav("")}<span>Cosmology Explorer · Gist Artifacts</span></div></div>'
        f'<div class="tabstrip d"><div class="tab">{fav("-dark")}<span>Cosmology Explorer · Gist Artifacts</span></div></div></div>')
    header = (
        f'<div class="mock"><div class="mock-bar">{logo("compact", decorative=True, width=20, height=20)}'
        '<span class="mock-name">Gist Artifacts</span><span class="mock-sep">/</span>'
        '<span class="mock-title">Cosmology Explorer</span><span class="mock-pill">rev 3f9c2ab</span></div>'
        '<div class="mock-page"><i style="width:46%"></i><i style="width:82%"></i><i style="width:68%"></i></div></div>')
    return (
        '<div class="panels p-three">'
        + panel(tabs, "", "<b>Browser tab.</b> The favicon follows the browser's colour scheme.")
        + panel(header, "bare", "<b>Viewer header.</b> The compact mark at 20 px, the name in Geist Semibold.")
        + panel(svg("app-icon", cls="w-icon"), "wash", "<b>Application icon.</b> The mark reversed on an Ink tile, for home screens and avatars.")
        + "</div>"
        '<div class="panels p-wide">'
        + panel(svg(f"{B.SLUG}-social-card", cls="w-card"), "bare", "<b>Social preview, 1280 × 640.</b> One phrase under the marker.")
        + panel(svg(f"{B.SLUG}-social-card-dark", cls="w-card"), "bare", "<b>The same card on a dark ground.</b>")
        + "</div>"
    )


# --- Plate: files ------------------------------------------------------------------
FILES = [
    (f"logo/{B.SLUG}-lockup.svg · -dark", "Horizontal logo. The default."),
    (f"logo/{B.SLUG}-lockup-stacked.svg · -dark", "Stacked logo, for square spaces."),
    (f"logo/{B.SLUG}-mark.svg · -dark · -mono", "The mark alone, 32 px and up. Mono uses <code>currentColor</code>."),
    (f"logo/{B.SLUG}-compact.svg · -dark · -mono", "The compact mark, 24 px and below."),
    ("logo/png/", "Transparent 2× PNG copies of the logos."),
    ("icons/favicon.svg · favicon.ico · favicon-16/32/48.png", "Favicons. The SVG follows the browser's colour scheme."),
    ("icons/app-icon.svg · icon-512.png · icon-256.png", "Application icon, with rounded corners."),
    ("icons/apple-touch-icon.png · avatar-500.png", "Square icons for platforms that mask them: home screens, avatars."),
    (f"social/{B.SLUG}-social-card.svg · -dark · PNG", "GitHub social preview and Open Graph image, 1280 × 640."),
    ("tokens/colors.json · colors.css", "The colours as design tokens and CSS custom properties."),
    ("fonts/", "Geist and Geist Mono, with their licences."),
]
SNIPPETS = [
    ("Favicons in a web page",
     '<link rel="icon" href="/favicon.ico" sizes="48x48">\n<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n'
     '<link rel="apple-touch-icon" href="/apple-touch-icon.png">'),
    ("Logo in a GitHub README, following the reader's theme",
     f'<picture>\n  <source media="(prefers-color-scheme: dark)"\n          srcset="brand/logo/{B.SLUG}-lockup-dark.svg">\n'
     f'  <img alt="{B.NAME}" width="320"\n       src="brand/logo/{B.SLUG}-lockup.svg">\n</picture>'),
]
FILES_NOTE = ("Every SVG is transparent, uses only brand colours, carries a title and a description for screen readers, "
              "and keeps its ids unique so several can be inlined in one page. All of it is generated: change "
              "<code>tokens/colors.json</code> or <code>tools/build_logo.py</code> and rebuild.")


def files_html():
    rows = "".join(f"<tr><th scope=\"row\"><code>{html.escape(a)}</code></th><td>{b}</td></tr>" for a, b in FILES)
    snippets = "".join(f"<h3>{t}</h3><pre><code>{html.escape(c)}</code></pre>" for t, c in SNIPPETS)
    return (f'<div class="cols c-files"><div><table class="tbl t-files"><tbody>{rows}</tbody></table></div>'
            f'<div>{snippets}<p class="note">{FILES_NOTE}</p></div></div>')


# --- The plates, in order ----------------------------------------------------------
def mark_html():
    return (f'<div class="cols c-mark"><div class="bigmark">{themed_mark()}</div><div>{legend_html()}</div></div>'
            f'<h3>How it is drawn</h3><div class="cols c-steps"><div>{steps_html()}</div><div>{proportions_html()}</div></div>')


PLATES = [
    ("mark", "The mark", "One stroke and a point",
     "One stroke draws a page and a G, and stops at a point. The page is what an agent makes, the G is where it is kept, "
     "and the point is the gist.", mark_html),
    ("versions", "Versions", "Mark and name",
     "The wordmark is Geist Semibold. Its capitals are centred on the mark and stand 0.36 of its height; the gap between "
     "them is one fifth of the mark's height.", versions_html),
    ("space", "Space and size", "Room to breathe, two drawings",
     "Below 32 px the stroke of the mark gets thin, so small sizes use a second, heavier drawing whose edges land on whole "
     "pixels at 16 px.", space_html),
    ("colour", "Colour", "Ink, Paper and one marker",
     "The palette is black, white and three greys. Marker is the only colour, and it does the one thing a highlighter "
     "does.", colour_html),
    ("type", "Type", "One family",
     "Geist for everything that is read, Geist Mono for everything that is typed.", type_html),
    ("usage", "Usage", "Do and don't", "", usage_html),
    ("in-use", "In use", "Where it appears", "", in_use_html),
    ("files", "Files", "The kit",
     f'Everything is in the <code>brand</code> folder of <a href="{REPO_URL}">{REPO_URL.removeprefix("https://")}</a>.', files_html),
]


# --- Styles shared by the web page and the PDF ---------------------------------------
LIGHT_TOKENS = "".join(f"--{k}:{v};" for k, v in B.LIGHT.items())
DARK_TOKENS = "".join(f"--{k}:{v};" for k, v in B.DARK.items())
FIXED_TOKENS = "".join(f"--l-{k}:{v};" for k, v in B.LIGHT.items()) + "".join(f"--d-{k}:{v};" for k, v in B.DARK.items())
FONT_STACKS = ('--f-sans:"Geist",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;'
               '--f-mono:"Geist Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace;')

COMPONENT_CSS = """
*,*::before,*::after{box-sizing:border-box}
h1,h2,h3,p,dl,dd,ul,ol,figure,pre,table{margin:0}
ul,ol{padding:0;list-style:none}
svg{display:block}
a{color:inherit;text-underline-offset:.18em}
code,pre{font-family:var(--f-mono);font-size:.9em}
mark{background:var(--l-marker);color:var(--l-ink);padding:.06em .28em;border-radius:.22em}
::selection{background:var(--marker);color:var(--l-ink)}
h3{font-family:var(--f-mono);font-weight:500;font-size:.72em;letter-spacing:.08em;text-transform:uppercase;color:var(--graphite);margin-bottom:.9em}
.note{color:var(--graphite);font-size:.9em;max-width:64ch}
.cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:2.2em 3em;align-items:start}
.fig{display:flex;flex-direction:column;gap:.55em;min-width:0}
.fig figcaption,.dont figcaption{font-size:.84em;color:var(--graphite);line-height:1.4}
.fig figcaption b,.dont figcaption b{color:var(--ink);font-weight:500}
.fig figcaption code{display:block;font-size:.86em;margin-top:.2em;overflow-wrap:anywhere}
.panel{border:1px solid var(--l-rule);border-radius:.5em;background:var(--l-ground);color:var(--l-ink);padding:1.6em 1.3em;display:grid;place-items:center;min-width:0;position:relative}
.panel.dark{background:var(--d-ground);border-color:var(--d-rule);color:var(--d-ink)}
.panel.wash{background:var(--l-wash)}
.panel.dim{background:var(--d-rule);border-color:var(--d-rule);color:var(--d-ink)}
.panel.bare{padding:0;overflow:hidden;display:block}
.panel svg{max-width:100%;height:auto}
.panels{display:grid;gap:1em;margin-top:1em}
.panels:first-child{margin-top:0}
.p-wide{grid-template-columns:repeat(2,minmax(0,1fr))}
.p-four{grid-template-columns:repeat(4,minmax(0,1fr))}
.p-three{grid-template-columns:repeat(3,minmax(0,1fr))}
.p-stack{grid-template-columns:minmax(0,1fr);margin-top:1.4em}
.p-wide .panel{min-height:9.5em}
.p-four .panel,.p-three .panel{min-height:9em}
.w-lockup{width:min(100%,19em)}.w-stack{width:min(100%,8.2em)}.w-mark{width:4.4em}.w-icon{width:5.6em}.w-card{width:100%}
.w-clear{width:min(100%,17em);margin-bottom:1em}
.bigmark{display:grid;place-items:center}
.bigmark svg{width:min(100%,15em);height:auto}
.legend{display:flex;flex-direction:column;gap:1em}
.legend dt{font-weight:600;font-size:1.1em;letter-spacing:-.015em}
.legend dd{color:var(--graphite);max-width:46ch}
.c-steps{margin-top:.2em}
.steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.2em}
.steps svg{width:min(100%,6.6em);height:auto}
.steps p{font-size:.84em;color:var(--graphite);margin-top:.7em;line-height:1.4}
.steps b{font-family:var(--f-mono);font-weight:500;color:var(--ink);margin-right:.3em}
.facts{display:flex;flex-direction:column}
.facts div{display:grid;grid-template-columns:6em minmax(0,1fr);gap:1em;padding:.55em 0;border-top:1px solid var(--rule);font-size:.9em}
.facts div:last-child{border-bottom:1px solid var(--rule)}
.facts dt{font-weight:500}
.facts dd{color:var(--graphite)}
.tbl{border-collapse:collapse;width:100%;font-size:.9em}
.tbl th,.tbl td{text-align:left;vertical-align:top;padding:.55em .8em .55em 0;border-top:1px solid var(--rule)}
.tbl thead th{border-top:0;font-family:var(--f-mono);font-weight:500;font-size:.8em;letter-spacing:.08em;text-transform:uppercase;color:var(--graphite)}
.tbl tbody th{font-weight:500}
.tbl tbody tr:last-child>*{border-bottom:1px solid var(--rule)}
.tbl td{color:var(--graphite);font-variant-numeric:tabular-nums}
.tbl+.note{margin-top:.8em}
.ladder{display:flex;align-items:flex-end;justify-content:center;flex-wrap:wrap;gap:.6em 1.1em}
.rung{display:flex;flex-direction:column;align-items:center;gap:.4em}
.rung svg{max-width:none}
.rung small{font-family:var(--f-mono);font-size:.68em;opacity:.65}
.chips{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:1em;margin-bottom:1.8em}
.chips li{display:flex;flex-direction:column;gap:.15em;min-width:0;font-size:.9em}
.chip{height:3.2em;border-radius:.4em;border:1px solid var(--rule);margin-bottom:.5em}
.chips b{font-weight:600}
.chips code{color:var(--graphite);font-size:.8em;overflow-wrap:anywhere}
.chips p{color:var(--graphite);font-size:.86em;line-height:1.35;margin-top:.25em}
.bullets{display:flex;flex-direction:column;gap:.5em}
.bullets li{padding-left:1.1em;position:relative;max-width:60ch}
.bullets li::before{content:"";position:absolute;left:0;top:.62em;width:.38em;height:.38em;border-radius:50%;background:var(--ink)}
.b-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5em 3em;margin:1.6em 0 1.2em}
.sample{font-size:1.5em;font-weight:600;letter-spacing:-.02em;margin-top:1em}
.type{display:flex;flex-direction:column}
.trow{display:grid;grid-template-columns:minmax(0,15em) minmax(0,1fr);gap:.5em 2em;padding:1.1em 0;border-top:1px solid var(--rule);align-items:baseline}
.trow:last-child{border-bottom:1px solid var(--rule)}
.trow>div:first-child b{display:block;font-weight:600}
.trow span{color:var(--graphite);font-size:.88em}
.t-head{font-weight:600;font-size:2.1em;letter-spacing:-.03em;line-height:1.1}
.t-body{font-size:1.1em;max-width:52ch}
.t-body b{font-weight:500}
.t-mono{font-family:var(--f-mono);font-size:.92em;overflow-wrap:anywhere}
.donts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.2em 1em}
.dont{display:flex;flex-direction:column;gap:.55em;min-width:0}
.dont .panel{height:8.4em;padding:1.1em}
.dont .panel svg{height:100%;width:auto;max-width:100%}
.dont figcaption b{display:block}
.cross{position:absolute;top:.6em;right:.6em;width:.9em;height:.9em;background:
  linear-gradient(45deg,transparent 44%,currentColor 44%,currentColor 56%,transparent 56%),
  linear-gradient(-45deg,transparent 44%,currentColor 44%,currentColor 56%,transparent 56%);opacity:.55}
.donts+.note{margin-top:1.4em}
.c-usage{margin-bottom:2em}
.tabs{display:flex;flex-direction:column;gap:.7em;width:100%;max-width:19em}
.tabstrip{padding:.45em .5em 0;border-radius:.4em .4em 0 0;display:flex;background:#DEE1E6}
.tabstrip.d{background:#202124}
.tab{display:flex;align-items:center;gap:.5em;padding:.5em .75em;border-radius:.5em .5em 0 0;font-size:.8em;line-height:1.2;min-width:0;max-width:100%;background:#fff;color:#1F1F1F}
.tabstrip.d .tab{background:#35363A;color:#E8EAED}
.tab span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tab svg{flex:none;max-width:none}
.mock{width:100%;background:var(--l-ground);color:var(--l-ink)}
.mock-bar{display:flex;align-items:center;gap:.6em;padding:.7em .9em;border-bottom:1px solid var(--l-rule);font-size:.88em;min-width:0}
.mock-bar svg{flex:none;max-width:none}
.mock-name{font-weight:600;letter-spacing:-.015em;white-space:nowrap}
.mock-sep{color:var(--l-rule)}
.mock-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;color:var(--l-graphite)}
.mock-pill{margin-left:auto;font-family:var(--f-mono);font-size:.82em;padding:.15em .6em;border:1px solid var(--l-rule);border-radius:99em;white-space:nowrap;color:var(--l-graphite)}
.mock-page{padding:1.1em .9em 1.6em;display:flex;flex-direction:column;gap:.6em}
.mock-page i{display:block;height:.5em;border-radius:.15em;background:var(--l-wash)}
.t-files th{font-weight:400;width:46%;overflow-wrap:anywhere}
.t-files code{font-size:.86em}
pre{background:var(--wash);border:1px solid var(--rule);border-radius:.5em;padding:.9em 1em;overflow-x:auto;font-size:.8em;line-height:1.5;margin-bottom:1.6em}
pre code{font-size:1em}
"""

WEB_CSS = """
:root{%(light)s%(fixed)s%(fonts)s}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){%(dark)scolor-scheme:dark}}
:root[data-theme="dark"]{%(dark)scolor-scheme:dark}
html{-webkit-text-size-adjust:100%%}
body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--f-sans);font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:68rem;margin:0 auto;padding:3.5rem max(1.1rem,env(safe-area-inset-right,0px)) 6rem max(1.1rem,env(safe-area-inset-left,0px))}
.hero{display:flex;flex-direction:column;gap:1.6rem;padding-bottom:3.5rem}
.hero svg{width:min(100%%,26rem);height:auto}
.hero p{font-size:1.2rem;max-width:40ch;line-height:1.45}
.hero nav{display:flex;flex-wrap:wrap;gap:.6rem 1.4rem;font-size:.95rem}
.eyebrow{font-family:var(--f-mono);font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:var(--graphite)}
.plate{border-top:1px solid var(--rule);padding:3rem 0 3.5rem;scroll-margin-top:1rem}
.plate>header{display:flex;flex-direction:column;gap:.5rem;margin-bottom:2.2rem}
.plate h2{font-weight:600;font-size:clamp(1.8rem,4.4vw,2.6rem);letter-spacing:-.03em;line-height:1.08;text-wrap:balance}
.plate header p{color:var(--graphite);max-width:62ch;font-size:1.05rem}
.plate h3{margin-top:2.2em}
.plate .cols h3:first-child,.plate header+h3,.plate .c-usage h3{margin-top:0}
footer{border-top:1px solid var(--rule);padding-top:1.5rem;color:var(--graphite);font-size:.9rem}
:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
@media (max-width:760px){
  .cols,.p-wide,.b-two{grid-template-columns:minmax(0,1fr)}
  .p-four{grid-template-columns:repeat(2,minmax(0,1fr))}
  .p-three,.steps{grid-template-columns:minmax(0,1fr)}
  .steps li{display:grid;grid-template-columns:5em minmax(0,1fr);gap:1em;align-items:center}
  .chips{grid-template-columns:repeat(2,minmax(0,1fr))}
  .donts{grid-template-columns:repeat(2,minmax(0,1fr))}
  .trow{grid-template-columns:minmax(0,1fr)}
  .tbl.t-files,.tbl.t-files tbody,.tbl.t-files tr,.tbl.t-files th,.tbl.t-files td{display:block;width:auto}
  .tbl.t-files td{border-top:0;padding-top:0}
}
"""


def web_page():
    css = WEB_CSS % dict(light=LIGHT_TOKENS, dark=DARK_TOKENS, fixed=FIXED_TOKENS, fonts=FONT_STACKS) + COMPONENT_CSS
    favicon = (ROOT / "icons" / "favicon.svg").read_text().strip()
    import base64

    icon = "data:image/svg+xml;base64," + base64.b64encode(favicon.encode()).decode()
    nav = "".join(f'<a href="#{pid}">{eyebrow}</a>' for pid, eyebrow, *_ in PLATES)
    plates = []
    for pid, eyebrow, title, lede, body in PLATES:
        lede_html = f"<p>{lede}</p>" if lede else ""
        plates.append(f'<section class="plate" id="{pid}"><header><span class="eyebrow">{eyebrow}</span>'
                      f"<h2>{title}</h2>{lede_html}</header>{body()}</section>")
    return (
        '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        f"<title>{B.NAME} brand guide</title>\n"
        f'<meta name="description" content="The logo, colours, type and usage rules for {B.NAME}.">\n'
        f'<link rel="icon" type="image/svg+xml" href="{icon}">\n'
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        f'<link rel="stylesheet" href="{html.escape(FONTS_URL)}">\n'
        f"<style>{css}</style>\n</head>\n<body>\n<div class=\"wrap\">\n"
        f'<header class="hero"><span class="eyebrow">Brand guide · {VERSION}</span>{themed_lockup()}'
        f"<p>The logo, colours, type and usage rules for {B.NAME}: shareable pages from your AI agent, stored in your own GitHub Gists.</p>"
        f'<nav aria-label="Sections">{nav}</nav></header>\n'
        + "\n".join(plates)
        + f'\n<footer>{B.NAME} brand guide. The same guide is a <a href="{PDF_URL}">PDF</a>, and every file it names is in '
        f'<a href="{KIT_URL}">the brand folder</a>.</footer>\n</div>\n</body>\n</html>\n'
    )


def main():
    out = ROOT / "guide" / "index.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(web_page())
    print(f"{out.relative_to(ROOT)}: {out.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
