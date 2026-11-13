export const SITE_NAME = "Gist Artifacts";
export const SITE_TAGLINE = "Shareable pages from your agent, stored as GitHub Gists";

/** Repository that holds the specification, this viewer, and the agent plugin. */
export const REPO_SLUG = process.env.NEXT_PUBLIC_REPO_SLUG || "Eiffl/artifacts";
export const REPO_URL = `https://github.com/${REPO_SLUG}`;
export const SPEC_URL = `${REPO_URL}/blob/main/gist-artifacts-spec.md`;

/** A published example shown on the landing page. Set to an empty string to hide the link. */
export const DEMO_GIST_ID = process.env.NEXT_PUBLIC_DEMO_GIST_ID ?? "fab233b353d106e591ae37fa12326ba3";
