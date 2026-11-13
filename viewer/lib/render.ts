/**
 * Self-contained HTML pages returned by the artifact file route: wrapper pages
 * for non-HTML entrypoints and error pages. They are plain strings because they
 * are served on artifact origins, where none of the application's assets exist.
 */

import { marked } from "marked";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BASE_CSS = `
:root{color-scheme:light dark;--bg:#fff;--fg:#1a1a1a;--muted:#666;--border:#e3e3e3;--code:#f5f5f5;--link:#0b5fff}
@media (prefers-color-scheme:dark){:root{--bg:#0f0f10;--fg:#ececec;--muted:#9a9a9a;--border:#2a2a2d;--code:#1b1b1e;--link:#7aa7ff}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--link)}
main{max-width:46rem;margin:0 auto;padding:2.5rem 1rem 4rem}
pre,code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.875em}
pre{background:var(--code);border:1px solid var(--border);border-radius:8px;padding:.9rem 1rem;overflow:auto}
code{background:var(--code);border-radius:4px;padding:.1em .3em}
pre code{background:none;padding:0}
`;

function shell(title: string, css: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>${BASE_CSS}${css}</style>
</head>
<body>${body}</body>
</html>`;
}

const MARKDOWN_CSS = `
h1,h2,h3,h4{line-height:1.25;margin:2em 0 .6em}
h1{font-size:1.9rem;margin-top:0}
h2{font-size:1.4rem;padding-bottom:.3em;border-bottom:1px solid var(--border)}
h3{font-size:1.15rem}
img,video{max-width:100%;height:auto}
blockquote{margin:1em 0;padding:.1em 1em;border-left:3px solid var(--border);color:var(--muted)}
table{border-collapse:collapse;display:block;overflow-x:auto;max-width:100%}
th,td{border:1px solid var(--border);padding:.4em .7em;text-align:left}
th{background:var(--code)}
hr{border:0;border-top:1px solid var(--border);margin:2em 0}
.bar{display:flex;justify-content:flex-end;margin-bottom:1rem}
.bar label{font-size:.8rem;color:var(--muted);border:1px solid var(--border);border-radius:6px;padding:.2rem .6rem;cursor:pointer;user-select:none}
#src{position:absolute;opacity:0;pointer-events:none}
#src:focus-visible~.bar label{outline:2px solid var(--link)}
#src:checked~.bar label{background:var(--code);color:var(--fg)}
.source{display:none;white-space:pre-wrap;word-break:break-word}
#src:checked~.rendered{display:none}
#src:checked~.source{display:block}
`;

/** Rendered Markdown document with a source toggle that needs no script. */
export function markdownPage(title: string, markdown: string): string {
  const html = marked.parse(markdown, { async: false, gfm: true }) as string;
  return shell(
    title,
    MARKDOWN_CSS,
    `<main>
<input type="checkbox" id="src" aria-label="Show Markdown source">
<div class="bar"><label for="src">Source</label></div>
<article class="rendered">${html}</article>
<pre class="source">${escapeHtml(markdown)}</pre>
</main>`,
  );
}

/** Plain text or JSON preview. JSON is re-indented when it parses. */
export function textPage(title: string, text: string, isJson: boolean): string {
  let content = text;
  if (isJson) {
    try {
      content = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      // Show the original text.
    }
  }
  return shell(
    title,
    `main{max-width:none;padding:1rem}pre{margin:0;border:0;background:none;padding:0;white-space:pre-wrap;word-break:break-word}`,
    `<main><pre>${escapeHtml(content)}</pre></main>`,
  );
}

/** SVG and other images are shown through an <img>, which never runs scripts. */
export function imagePage(title: string, src: string): string {
  return shell(
    title,
    `body{min-height:100vh;display:grid;place-items:center}img{max-width:100vw;max-height:100vh;object-fit:contain}`,
    `<img src="${escapeHtml(src)}" alt="${escapeHtml(title)}">`,
  );
}

export function errorPage(status: number, heading: string, detail: string, homeUrl?: string): string {
  return shell(
    `${status} - ${heading}`,
    `body{min-height:100vh;display:grid;place-items:center}
main{text-align:center;padding:2rem 1rem}
.status{font:600 .8rem/1 ui-monospace,monospace;letter-spacing:.08em;color:var(--muted)}
h1{font-size:1.4rem;margin:.6rem 0}
p{color:var(--muted);margin:.4rem auto;max-width:32rem}`,
    `<main>
<div class="status">${status}</div>
<h1>${escapeHtml(heading)}</h1>
<p>${escapeHtml(detail)}</p>
${homeUrl ? `<p><a href="${escapeHtml(homeUrl)}">Gist Artifacts</a></p>` : ""}
</main>`,
  );
}
