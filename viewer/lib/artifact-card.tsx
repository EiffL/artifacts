import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import brand from "./brand.json";
import { isGistId } from "./config";
import { loadManifest, resolveHead, resolveOwner } from "./gist-source";
import { SITE_NAME, SITE_TAGLINE } from "./site";

/**
 * The image a shared artifact link unfurls to: the artifact's own title and description,
 * and under them what published it and where to make one. Every link someone posts is
 * where most people first meet the project, so the card says how to get the same.
 */

export const CARD_SIZE = { width: 1200, height: 630 };
export const CARD_ALT = `An artifact published with ${SITE_NAME}`;

/** How long the CDN keeps a card. It is also dropped as soon as the artifact is republished. */
const CARD_TTL_SECONDS = 300;

const { ink, marker, ground, rule, graphite } = brand.light;

type Font = { name: string; data: Buffer; weight: 400 | 600; style: "normal" };
let fonts: Promise<Font[]> | undefined;

/** Static cuts of Geist, written by brand/tools/build_logo.py: the renderer cannot read the variable font. */
function loadFonts(): Promise<Font[]> {
  // Each path is spelled out so that the build can see which files the function needs.
  fonts ??= Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Geist-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Geist-SemiBold.ttf")),
    readFile(join(process.cwd(), "assets/fonts/GeistMono-Regular.ttf")),
  ]).then(([regular, semibold, mono]) => [
    { name: "Geist", data: regular, weight: 400, style: "normal" },
    { name: "Geist", data: semibold, weight: 600, style: "normal" },
    { name: "Geist Mono", data: mono, weight: 400, style: "normal" },
  ]);
  return fonts;
}

/** The compact mark, as in brand/logo/gist-artifacts-compact.svg. */
function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path
        d="M26 12L18 4H10A4 4 0 0 0 6 8V24A4 4 0 0 0 10 28H22A4 4 0 0 0 26 24V18H16"
        stroke={ink}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="18" r="4" fill={marker} />
    </svg>
  );
}

type CardContent = { title: string; description: string; owner: string | null };

async function cardContent(id: string): Promise<CardContent> {
  const fallback = { title: SITE_NAME, description: `${SITE_TAGLINE}.`, owner: null };
  if (!isGistId(id)) return fallback;
  const owner = await resolveOwner(id);
  const head = owner ? await resolveHead(id) : null;
  if (!owner || !head) return fallback;
  const { manifest } = await loadManifest(owner, id, head);
  return {
    title: manifest?.title ?? "Untitled artifact",
    description: manifest?.description ?? "",
    owner,
  };
}

/** The card for one artifact. `host` is where the viewer is reached, shown as the place to make one. */
export async function artifactCard(rawId: string, host: string): Promise<ImageResponse> {
  const id = rawId.toLowerCase();
  const { title, description, owner } = await cardContent(id);
  const long = title.length > 34;
  // The tagline shares the last row with the address, and gives way when the address is long.
  const roomy = host.length <= 24;
  const address = host.length > 50 ? `${host.slice(0, 49)}…` : host;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px 48px",
          background: ground,
          color: ink,
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Mark size={44} />
            <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.03em" }}>{SITE_NAME}</span>
          </div>
          {owner ? <span style={{ fontSize: 26, color: graphite }}>by {owner}</span> : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "block",
              fontSize: long ? 64 : 84,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1.08,
              lineClamp: 2,
            }}
          >
            {title}
          </div>
          {description ? (
            <div style={{ display: "block", fontSize: 34, lineHeight: 1.35, color: graphite, lineClamp: 2 }}>
              {description}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `2px solid ${rule}`,
            paddingTop: 30,
          }}
        >
          {roomy ? (
            <span style={{ fontSize: 26, color: graphite, flexShrink: 0 }}>Shareable pages from your AI agent</span>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
            <span
              style={{
                flexShrink: 0,
                fontSize: 26,
                fontWeight: 600,
                background: marker,
                color: ink,
                padding: "6px 14px",
                borderRadius: 8,
              }}
            >
              Create your own
            </span>
            <span
              style={{
                display: "block",
                fontSize: 24,
                fontFamily: "Geist Mono",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {address}
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...CARD_SIZE,
      fonts: await loadFonts(),
      headers: {
        // The default is a year, but the title can change with the next revision.
        "cache-control": "public, max-age=0, must-revalidate",
        "vercel-cdn-cache-control": `max-age=${CARD_TTL_SECONDS}`,
        ...(isGistId(id) ? { "vercel-cache-tag": `gist-${id}` } : {}),
      },
    },
  );
}
