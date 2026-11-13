/**
 * Onboarding an agent: a prompt a person pastes into their agent, and the page
 * that prompt tells the agent to fetch and follow.
 */

import { REPO_SLUG, REPO_URL, SITE_NAME, SPEC_URL } from "./site";

export const GET_STARTED_PATH = "/get-started.md";

/** What the "Onboard your agent" button copies. */
export function onboardingPrompt(origin: string): string {
  return `Set up ${SITE_NAME} for me. Fetch ${origin}${GET_STARTED_PATH} and follow it.`;
}

/**
 * Setup instructions written for an agent. It only ever asks for one thing, installing the
 * skill from the project's repository, and says so, because an agent should not follow a
 * fetched page that asks for more than its user did.
 */
export function getStartedMarkdown(origin: string): string {
  return `# Set up ${SITE_NAME}

This page is for an AI coding agent whose user asked it to set up ${SITE_NAME}. If you are a person, the same steps are at ${origin}.

${SITE_NAME} lets you publish a page you built (a report, a chart, an interactive page) as a GitHub Gist in the user's own account, and give them a link that anyone can open at ${origin}.

Setting it up is one thing: installing a skill from ${REPO_URL}. This page asks for nothing else. It does not ask for a token, and nothing has to be sent anywhere.

## 1. Install the skill

Claude Code and Codex each have a plugin. If you are one of them, install the plugin: it is the supported install, and it updates with the repository. Use the last command only if you are another agent.

Claude Code:

\`\`\`bash
claude plugin marketplace add ${REPO_SLUG}
claude plugin install gist-artifacts@gist-artifacts
\`\`\`

Codex:

\`\`\`bash
codex plugin marketplace add ${REPO_SLUG}
codex plugin add gist-artifacts@gist-artifacts
\`\`\`

Any other agent that supports skills, through the skills CLI:

\`\`\`bash
npx skills add ${REPO_SLUG} --skill gist-artifacts --yes
\`\`\`

If you cannot run commands yourself, show the user the lines for their agent and ask them to run them.

## 2. Make the skill available

The skill is named \`gist-artifacts\`. A skill installed during a session is usually not loaded into that session. If you cannot see it, ask the user to start a new session.

## 3. Leave the GitHub sign-in alone

Do not sign in to GitHub or ask for credentials now. The skill uses the GitHub CLI's sign-in, and when that is missing it names the one command the user has to run. Its publishing tool needs Node.js 18 or later and falls back to the GitHub CLI alone without it.

## 4. Tell the user it is ready

Say what they can ask for from now on:

- "Publish this page as a Gist artifact and give me the link."
- "Update the artifact with the new results."
- "List my artifacts."

Tell them one thing before they share a link: an artifact is unlisted, not private. Anyone with the link can open it, so nothing confidential should be published.

## More

- Specification: ${SPEC_URL}
- Source: ${REPO_URL}
`;
}
