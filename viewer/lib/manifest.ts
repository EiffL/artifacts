import { bareMediaType, contentTypeFor } from "./mime";

export const MANIFEST_FILE = "artifact.json";
export const SUPPORTED_SCHEMA_VERSIONS = ["0.1"];

export type Manifest = {
  schemaVersion: string;
  title: string;
  entrypoint: string;
  mediaType: string;
  description?: string;
  icon?: string;
  generator?: string;
  source?: string;
};

export type ManifestResult = {
  /** Usable manifest, or null when the file is missing or cannot be read at all. */
  manifest: Manifest | null;
  /** Deviations from the specification. Empty for a conforming manifest. */
  problems: string[];
};

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Reads an `artifact.json`. Readers are lenient: only `entrypoint` is needed to
 * display something, and every other deviation is reported as a problem.
 */
export function parseManifest(text: string): ManifestResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { manifest: null, problems: ["artifact.json is not valid JSON"] };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { manifest: null, problems: ["artifact.json must be a JSON object"] };
  }
  const raw = data as Record<string, unknown>;
  const problems: string[] = [];

  const entrypoint = optionalString(raw.entrypoint);
  if (!entrypoint) {
    return { manifest: null, problems: ["artifact.json has no entrypoint"] };
  }
  if (entrypoint.includes("/")) {
    problems.push("entrypoint must be a file name, not a path");
  }

  const schemaVersion = optionalString(raw.schemaVersion);
  if (!schemaVersion) problems.push("schemaVersion is missing");

  const title = optionalString(raw.title);
  if (!title) problems.push("title is missing");

  const mediaType = optionalString(raw.mediaType);
  if (!mediaType) problems.push("mediaType is missing");

  return {
    manifest: {
      schemaVersion: schemaVersion ?? SUPPORTED_SCHEMA_VERSIONS[0],
      title: title ?? entrypoint,
      entrypoint,
      mediaType: bareMediaType(mediaType ?? contentTypeFor(entrypoint)),
      description: optionalString(raw.description),
      icon: optionalString(raw.icon),
      generator: optionalString(raw.generator),
      source: optionalString(raw.source),
    },
    problems,
  };
}
