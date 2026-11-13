export const SITE_NAME = "Gist Artifacts";
export const SITE_TAGLINE = "Shareable pages from your AI agent, stored in your own GitHub Gists";

/** Repository that holds the specification, this viewer, and the agent plugin. */
export const REPO_SLUG = process.env.NEXT_PUBLIC_REPO_SLUG || "EiffL/artifacts";
export const REPO_URL = `https://github.com/${REPO_SLUG}`;
export const SPEC_URL = `${REPO_URL}/blob/main/gist-artifacts-spec.md`;
export const SCHEMA_URL = `${REPO_URL}/blob/main/schemas/0.1/artifact.schema.json`;
