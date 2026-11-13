# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Check the brand kit against its own rules.

    uv run tools/check_assets.py

Every SVG in logo/, icons/ and social/:

  * parses as XML, has role="img", a <title> and a <desc>, and is labelled by them
  * uses only colours from tokens/colors.json (plus none and currentColor)
  * uses Marker only for the point and for a highlight (classes ga-point, ga-highlight)
  * has ids that are unique across all files, so several can be inlined in one page
  * carries no <style>, except icons/favicon.svg, whose rules are scoped to its own root

And beyond the SVGs:

  * every text pair in tools/kit.py meets the contrast it promises
  * the copies kept by the viewer and the plugin are identical to the kit's files
  * the viewer's logo component draws the compact mark
  * guide/ is a valid Gist Artifact
"""

from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402

ROOT, REPO = kit.ROOT, kit.REPO
NS = "{http://www.w3.org/2000/svg}"
MARKER_CLASSES = {"ga-point", "ga-highlight"}
FAVICON = ROOT / "icons" / "favicon.svg"

palette = {v.upper() for s in (kit.LIGHT, kit.DARK) for v in s.values()}
markers = {kit.LIGHT["marker"].upper(), kit.DARK["marker"].upper()}

errors: list[str] = []
seen_ids: dict[str, Path] = {}


def fail(path: Path, msg: str) -> None:
    errors.append(f"{path.relative_to(REPO)}: {msg}")


def walk(el, path: Path) -> None:
    tag = el.tag.replace(NS, "")
    classes = set(el.get("class", "").split())
    if el.get("id"):
        if el.get("id") in seen_ids:
            fail(path, f'id "{el.get("id")}" also used in {seen_ids[el.get("id")].relative_to(REPO)}')
        seen_ids[el.get("id")] = path
    if tag == "style":
        if path != FAVICON:
            fail(path, "<style> is only allowed in icons/favicon.svg")
        else:
            body = re.sub(r"@media[^{]*\{", "", el.text or "")
            for selector in re.findall(r"([^{}]+)\{[^{}]*\}", body):
                if not selector.strip().startswith(".ga-favicon"):
                    fail(path, f'style rule "{selector.strip()}" is not scoped to .ga-favicon')
    for attr in ("fill", "stroke", "stop-color", "color"):
        value = el.get(attr)
        if not value or value in ("none", "currentColor"):
            continue
        if value.upper() not in palette:
            fail(path, f'<{tag} {attr}="{value}"> is not a colour from tokens/colors.json')
        elif value.upper() in markers and not classes & MARKER_CLASSES:
            fail(path, f"Marker on <{tag}>, which is neither the point nor a highlight")
    for child in el:
        walk(child, path)


# --- The SVGs ----------------------------------------------------------------------
svgs = sorted(p for d in ("logo", "icons", "social") for p in (ROOT / d).glob("*.svg"))
if not svgs:
    errors.append("no SVGs found; run tools/build_logo.py first")
for path in svgs:
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as e:
        fail(path, f"not valid XML: {e}")
        continue
    if root.get("role") != "img":
        fail(path, 'root <svg> needs role="img"')
    title, desc = root.find(f"{NS}title"), root.find(f"{NS}desc")
    if title is None or not (title.text or "").strip() or desc is None or not (desc.text or "").strip():
        fail(path, "needs a non-empty <title> and <desc>")
    elif root.get("aria-labelledby", "").split() != [title.get("id"), desc.get("id")]:
        fail(path, "aria-labelledby must name the <title> and <desc> ids")
    walk(root, path)

# --- Legibility --------------------------------------------------------------------
for pair in kit.TEXT_PAIRS:
    ratio = kit.pair_ratio(pair)
    if ratio < kit.MIN_CONTRAST:
        errors.append(f"tokens/colors.json: {pair[0]} is {ratio:.2f}:1, below {kit.MIN_CONTRAST}:1")

# --- Copies elsewhere in the repository ------------------------------------------------
for source, targets in kit.INSTALL.items():
    for target in targets:
        if not (ROOT / source).exists() or not (REPO / target).exists():
            errors.append(f"{target}: missing, or its source brand/{source} is; run tools/build_logo.py")
        elif (ROOT / source).read_bytes() != (REPO / target).read_bytes():
            errors.append(f"{target}: differs from brand/{source}; run tools/build_logo.py")
for path, expected in ((kit.VIEWER_CSS, kit.viewer_css()), (kit.VIEWER_JSON, kit.viewer_json()),
                       (ROOT / "tokens" / "colors.css", kit.colors_css())):
    if not path.exists() or path.read_text() != expected:
        fail(path, "out of date with tokens/colors.json; run tools/build_logo.py")

# --- The viewer's logo component ---------------------------------------------------
compact = ROOT / "logo" / f"{kit.SLUG}-compact.svg"
if compact.exists() and kit.VIEWER_LOGO.exists():
    drawing, component = ET.parse(compact).getroot(), kit.VIEWER_LOGO.read_text()
    stroke, point = drawing.find(f"{NS}path"), drawing.find(f"{NS}circle")
    wanted = [f'viewBox="{drawing.get("viewBox")}"', f'd="{stroke.get("d")}"', f'strokeWidth="{stroke.get("stroke-width")}"',
              f'cx="{point.get("cx")}" cy="{point.get("cy")}" r="{point.get("r")}"']
    for fragment in wanted:
        if fragment not in component:
            fail(kit.VIEWER_LOGO, f"does not draw the compact mark: {fragment} not found")

# --- The guide is a Gist Artifact --------------------------------------------------
manifest_path = ROOT / "guide" / "artifact.json"
schema = json.loads((REPO / "schemas" / "0.1" / "artifact.schema.json").read_text())
try:
    manifest = json.loads(manifest_path.read_text())
except (OSError, ValueError) as e:
    manifest = None
    fail(manifest_path, f"not readable as JSON: {e}")
if manifest is not None:
    for name in schema["required"]:
        if name not in manifest:
            fail(manifest_path, f'required property "{name}" is missing')
    for name, rule in schema["properties"].items():
        value = manifest.get(name)
        if value is None:
            continue
        if not isinstance(value, str):
            fail(manifest_path, f'"{name}" must be a string')
        elif "pattern" in rule and not re.search(rule["pattern"], value):
            fail(manifest_path, f'"{name}" does not match the schema')
    entry = manifest.get("entrypoint")
    if isinstance(entry, str) and not (manifest_path.parent / entry).is_file():
        fail(manifest_path, f'entrypoint "{entry}" does not exist; run tools/build_site.py')

if errors:
    print("\n".join(errors))
    sys.exit(f"{len(errors)} problem(s)")
print(f"{len(svgs)} SVG files, {len(kit.TEXT_PAIRS)} text pairs and {sum(map(len, kit.INSTALL.values())) + 3} copies follow the brand rules")
