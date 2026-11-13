# /// script
# requires-python = ">=3.10"
# dependencies = ["fonttools[woff]>=4.50", "uharfbuzz>=0.39", "pypdf>=4"]
# ///
"""Build branding.pdf, the printable brand guide (A4 landscape).

    uv run tools/build_pdf.py

Lays out the content of tools/build_site.py as print pages, with the fonts in
fonts/, and prints them with headless Chromium (set CHROMIUM to its path if it
is not on PATH as chromium or google-chrome). Run tools/build_logo.py first.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from pypdf import PdfReader, PdfWriter

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import build_site as G  # noqa: E402

B = G.B
ROOT = G.ROOT
OUT = ROOT / "branding.pdf"


def font_faces():
    faces = [("Geist", "400 600", "Geist-Variable.woff2"), ("Geist Mono", "400 500", "GeistMono-Variable.woff2")]
    return "".join(
        f'@font-face{{font-family:"{family}";font-weight:{weights};font-display:block;'
        f'src:url("{(ROOT / "fonts" / file).as_uri()}") format("woff2")}}\n' for family, weights, file in faces)


PRINT_CSS = """
@page { size: 297mm 210mm; margin: 0; }
html, body { margin: 0; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: var(--ground); color: var(--ink);
  font-family: var(--f-sans); font-size: 9.2pt; line-height: 1.45; }
.page { width: 297mm; height: 210mm; padding: 12mm 16mm 11mm; background: var(--ground); position: relative; overflow: hidden;
  break-after: page; display: grid; grid-template-rows: auto auto minmax(0, 1fr); gap: 6mm; }
.page:last-child { break-after: auto; }
.ph { display: flex; justify-content: space-between; font-family: var(--f-mono); font-size: 6.8pt; letter-spacing: .08em;
  text-transform: uppercase; color: var(--graphite); border-bottom: .25mm solid var(--rule); padding-bottom: 2.4mm; }
.ptitle { display: grid; gap: 1.4mm; }
.eyebrow { font-family: var(--f-mono); font-size: 6.8pt; letter-spacing: .08em; text-transform: uppercase; color: var(--graphite); }
h2 { font-weight: 600; font-size: 22pt; line-height: 1.08; letter-spacing: -.03em; }
.ptitle p { color: var(--graphite); font-size: 10pt; max-width: 180mm; }
.body { min-height: 0; }
.body h3 { margin-top: 5mm; }
.body > h3:first-child, .cols h3:first-child { margin-top: 0; }

/* cover */
.cover { grid-template-rows: minmax(0, 1fr) auto; padding: 18mm 22mm 14mm; }
.cover-main { display: grid; align-content: center; gap: 11mm; }
.cover-main svg { width: 150mm; height: auto; }
.cover-main p { font-size: 15pt; line-height: 1.4; max-width: 150mm; }
.cover-foot { display: flex; justify-content: space-between; font-family: var(--f-mono); font-size: 7.4pt; letter-spacing: .08em;
  text-transform: uppercase; color: var(--graphite); border-top: .25mm solid var(--rule); padding-top: 4mm; }

/* per plate */
.bigmark svg { width: 62mm; }
.c-mark { align-items: center; margin-bottom: 7mm; }
.steps svg { width: 22mm; }
.p-wide .panel { min-height: 40mm; }
.p-four .panel, .p-three .panel { min-height: 38mm; }
.w-lockup { width: 82mm; }
.w-clear { width: 78mm; }
.p-stack { margin-top: 5mm; }
.p-stack .panel { padding: 4mm; }
.chips { margin-bottom: 4mm; }
.chip { height: 2.3em; }
.chips p { font-size: .82em; }
.t-contrast th, .t-contrast td { padding-top: .36em; padding-bottom: .36em; }
.sample { font-size: 15pt; }
.c-usage { margin-bottom: 5mm; }
.donts { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 3mm; }
.dont .panel { height: 30mm; padding: 4mm; }
.dont figcaption { font-size: .78em; }
#in-use .p-wide .panel { min-height: 0; }
#in-use .p-three .panel { min-height: 34mm; }
#in-use .p-wide { grid-template-columns: repeat(2, 104mm); justify-content: start; }
.t-files th, .t-files td { padding-top: .42em; padding-bottom: .42em; }
pre { font-size: 7.2pt; }
"""


def page_html(n, total, pid, eyebrow, title, lede, body):
    lede_html = f"<p>{lede}</p>" if lede else ""
    return (f'<section class="page" id="{pid}"><div class="ph"><span>{B.NAME} · Brand guide</span><span>{n} / {total}</span></div>'
            f'<div class="ptitle"><span class="eyebrow">{eyebrow}</span><h2>{title}</h2>{lede_html}</div>'
            f'<div class="body">{body}</div></section>')


def document():
    total = len(G.PLATES) + 1
    cover = (
        '<section class="page cover"><div class="cover-main">'
        f'{G.themed_lockup()}<p>The logo, colours, type and usage rules for {B.NAME}: shareable pages from your AI agent, '
        "stored in your own GitHub Gists.</p></div>"
        f'<div class="cover-foot"><span>Brand guide · {G.VERSION}</span><span>{G.REPO_URL.removeprefix("https://")}</span></div></section>')
    pages = [cover] + [page_html(i, total, pid, eyebrow, title, lede, body())
                       for i, (pid, eyebrow, title, lede, body) in enumerate(G.PLATES, 2)]
    css = (font_faces() + f":root{{{G.LIGHT_TOKENS}{G.FIXED_TOKENS}{G.FONT_STACKS}}}" + G.COMPONENT_CSS + PRINT_CSS)
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{B.NAME} brand guide</title>'
            f"<style>{css}</style></head><body>{''.join(pages)}</body></html>"), total


def chromium():
    for candidate in (os.environ.get("CHROMIUM"), "chromium", "chromium-browser", "google-chrome", "google-chrome-stable"):
        if candidate and shutil.which(candidate):
            return shutil.which(candidate)
    sys.exit("Chromium not found: install it, or set CHROMIUM to its path")


def main():
    markup, total = document()
    with tempfile.TemporaryDirectory() as tmp:
        page = Path(tmp) / "guide.html"
        raw = Path(tmp) / "guide.pdf"
        page.write_text(markup)
        subprocess.run(
            [chromium(), "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=4000",
             f"--user-data-dir={Path(tmp) / 'profile'}", f"--print-to-pdf={raw}", page.as_uri()],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        reader = PdfReader(raw)
        if len(reader.pages) != total:
            sys.exit(f"expected {total} pages, got {len(reader.pages)}: some page's content overflows its sheet")
        writer = PdfWriter()
        for sheet in reader.pages:
            writer.add_page(sheet)
        writer.add_metadata({"/Title": f"{B.NAME} brand guide", "/Subject": G.VERSION, "/Creator": "brand/tools/build_pdf.py"})
        with OUT.open("wb") as fh:
            writer.write(fh)
    print(f"{OUT.relative_to(ROOT)}: {total} pages, {OUT.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
