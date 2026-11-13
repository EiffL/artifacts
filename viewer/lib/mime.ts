const TEXT = "; charset=utf-8";

const TYPES: Record<string, string> = {
  html: `text/html${TEXT}`,
  htm: `text/html${TEXT}`,
  css: `text/css${TEXT}`,
  js: `text/javascript${TEXT}`,
  mjs: `text/javascript${TEXT}`,
  json: `application/json${TEXT}`,
  geojson: `application/geo+json${TEXT}`,
  map: `application/json${TEXT}`,
  webmanifest: `application/manifest+json${TEXT}`,
  txt: `text/plain${TEXT}`,
  md: `text/markdown${TEXT}`,
  markdown: `text/markdown${TEXT}`,
  csv: `text/csv${TEXT}`,
  tsv: `text/tab-separated-values${TEXT}`,
  xml: `application/xml${TEXT}`,
  yaml: `text/yaml${TEXT}`,
  yml: `text/yaml${TEXT}`,
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  bmp: "image/bmp",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  pdf: "application/pdf",
  wasm: "application/wasm",
  zip: "application/zip",
  gz: "application/gzip",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  parquet: "application/vnd.apache.parquet",
  npy: "application/octet-stream",
  ipynb: `application/x-ipynb+json${TEXT}`,
};

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot < 0 ? "" : filename.slice(dot + 1).toLowerCase();
}

/** Content type for a Gist file, inferred from its extension. */
export function contentTypeFor(filename: string): string {
  return TYPES[extensionOf(filename)] ?? "application/octet-stream";
}

/** Media type without parameters, lower-cased: `text/html; charset=utf-8` becomes `text/html`. */
export function bareMediaType(value: string): string {
  return value.split(";")[0].trim().toLowerCase();
}
