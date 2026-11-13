"""Facts the brand tools share: where things are, the palette, and the copies kept elsewhere.

No dependencies, so tools/check_assets.py can run anywhere.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # brand/
REPO = ROOT.parent

NAME = "Gist Artifacts"
SLUG = "gist-artifacts"

# --- Palette: tokens/colors.json ------------------------------------------------
TOKENS = json.loads((ROOT / "tokens" / "colors.json").read_text())


def scheme(name):
    return {k: v["$value"] for k, v in TOKENS[name].items() if not k.startswith("$")}


LIGHT, DARK = scheme("light"), scheme("dark")


def colors_css():
    """tokens/colors.css: every token under a scheme-qualified name."""
    lines = ["/* Generated from tokens/colors.json by tools/build_logo.py. Do not edit. */", ":root {"]
    for name in ("light", "dark"):
        for key, tok in TOKENS[name].items():
            if not key.startswith("$"):
                lines.append(f"  --ga-{name}-{key}: {tok['$value']}; /* {tok['$description']} */")
    lines.append("}")
    return "\n".join(lines) + "\n"


def viewer_css():
    """viewer/app/brand.css: the tokens under names that follow the viewer's theme."""
    lines = ["/* Generated from brand/tokens/colors.json by brand/tools/build_logo.py. Do not edit. */"]
    for selector, values in ((":root", LIGHT), (".dark", DARK)):
        lines.append(f"{selector} {{")
        lines += [f"  --brand-{key}: {value};" for key, value in values.items()]
        if selector == ":root":
            lines.append(f"  --brand-on-marker: {LIGHT['ink']}; /* text on a Marker highlight, in both themes */")
        lines.append("}")
    return "\n".join(lines) + "\n"


def viewer_json():
    """viewer/lib/brand.json: the same values, for code that cannot read CSS custom properties."""
    return json.dumps({"light": LIGHT, "dark": DARK}, indent=2) + "\n"


# --- Legibility ------------------------------------------------------------------
def luminance(hexcode):
    def channel(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4

    r, g, b = (int(hexcode[i:i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def contrast(a, b):
    """WCAG contrast ratio of two colours."""
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


# Text on ground, as (label, text scheme, text token, ground scheme, ground token).
# The guide prints these ratios and tools/check_assets.py holds each to MIN_CONTRAST.
TEXT_PAIRS = [
    ("Ink on Ground", "light", "ink", "light", "ground"),
    ("Graphite on Ground", "light", "graphite", "light", "ground"),
    ("Graphite on Wash", "light", "graphite", "light", "wash"),
    ("Ink on Marker", "light", "ink", "light", "marker"),
    ("Ink on Ground, dark", "dark", "ink", "dark", "ground"),
    ("Graphite on Wash, dark", "dark", "graphite", "dark", "wash"),
    ("Dark text on Marker, dark", "light", "ink", "dark", "marker"),
]
MIN_CONTRAST = 4.5


def pair_ratio(pair):
    _, s1, k1, s2, k2 = pair
    return contrast(TOKENS[s1][k1]["$value"], TOKENS[s2][k2]["$value"])


# --- Copies used by the rest of the repository ---------------------------------------
# Generated file -> where the viewer and the plugin keep a copy of it.
INSTALL = {
    "icons/favicon.svg": ["viewer/app/icon.svg"],
    "icons/favicon.ico": ["viewer/app/favicon.ico"],
    "icons/apple-touch-icon.png": ["viewer/app/apple-icon.png"],
    f"social/{SLUG}-social-card-1280x640.png": ["viewer/app/opengraph-image.png", "viewer/app/twitter-image.png"],
    f"logo/{SLUG}-compact-mono.svg": ["plugins/gist-artifacts/assets/icon.svg"],
    "icons/icon-256.png": ["plugins/gist-artifacts/assets/logo.png", "examples/hello/logo.png"],
}
VIEWER_CSS = REPO / "viewer" / "app" / "brand.css"
VIEWER_JSON = REPO / "viewer" / "lib" / "brand.json"
VIEWER_LOGO = REPO / "viewer" / "components" / "logo.tsx"
# Static cuts of Geist for the viewer's generated social cards, whose renderer cannot read the
# variable woff2. File name -> (source in fonts/, weight).
VIEWER_FONT_DIR = REPO / "viewer" / "assets" / "fonts"
VIEWER_FONTS = {
    "Geist-Regular.ttf": ("Geist-Variable.woff2", 400),
    "Geist-SemiBold.ttf": ("Geist-Variable.woff2", 600),
    "GeistMono-Regular.ttf": ("GeistMono-Variable.woff2", 400),
}
VIEWER_FONT_LICENCES = ("OFL-Geist.txt", "OFL-GeistMono.txt")
