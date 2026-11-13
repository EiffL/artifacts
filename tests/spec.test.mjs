// Keeps the specification, its JSON Schema and the publishing tool consistent.
// Run with: node --test tests/

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  SCHEMA_VERSION,
  buildManifest,
} from "../plugins/gist-artifacts/skills/gist-artifacts/scripts/gist-artifacts.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const spec = readFileSync(join(root, "gist-artifacts-spec.md"), "utf8");
const schema = JSON.parse(readFileSync(join(root, `schemas/${SCHEMA_VERSION}/artifact.schema.json`), "utf8"));

/** GitHub's heading anchors: lower case, punctuation dropped, spaces to hyphens. */
function slug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

/**
 * Checks the properties present in `value` against the schema. Enough of JSON
 * Schema for this manifest: type, pattern, minLength and `not: { const }`.
 */
function propertyErrors(value) {
  const errors = [];
  for (const [name, rule] of Object.entries(schema.properties)) {
    if (!(name in value)) continue;
    const item = value[name];
    if (typeof item !== rule.type) errors.push(`${name}: not a ${rule.type}`);
    else if (rule.pattern && !new RegExp(rule.pattern).test(item)) errors.push(`${name}: pattern`);
    else if (rule.minLength && item.length < rule.minLength) errors.push(`${name}: too short`);
    else if (rule.not && item === rule.not.const) errors.push(`${name}: not allowed`);
  }
  return errors;
}

function manifestErrors(value) {
  const missing = schema.required.filter((name) => !(name in value)).map((name) => `${name}: missing`);
  return [...missing, ...propertyErrors(value)];
}

/** Every fenced block in the specification, with the "Example: …" label that introduces it. */
function fencedBlocks() {
  const blocks = [];
  let label = null;
  let open = null;
  for (const line of spec.split("\n")) {
    if (open) {
      if (line.startsWith("```")) {
        blocks.push({ ...open, text: open.lines.join("\n") });
        open = null;
      } else open.lines.push(line);
      continue;
    }
    const fence = line.match(/^```(\w+)/);
    if (fence) open = { language: fence[1], label, lines: [] };
    else if (/^Example: /.test(line)) label = line;
    else if (/^#{1,6} /.test(line)) label = null;
  }
  return blocks;
}

describe("specification", () => {
  test("describes the artifact convention only", () => {
    for (const word of ["viewer", "agent", "dashboard", "vercel"]) {
      assert.equal(new RegExp(word, "i").test(spec), false, `the specification mentions "${word}"`);
    }
  });

  test("every internal link points at a heading", () => {
    const anchors = new Set([...spec.matchAll(/^#{1,6} (.+)$/gm)].map((match) => slug(match[1])));
    const links = [...spec.matchAll(/\]\(#([^)]+)\)/g)].map((match) => match[1]);
    assert.ok(links.length > 30);
    for (const link of links) assert.ok(anchors.has(link), `no heading for #${link}`);
  });

  test("declares the version the tool writes", () => {
    assert.match(spec, new RegExp(`\\*\\*Spec Version:\\*\\* ${SCHEMA_VERSION.replace(".", "\\.")}\\b`));
  });

  test("every JSON example parses", () => {
    const json = fencedBlocks().filter((block) => block.language === "json");
    assert.ok(json.length >= 15);
    for (const block of json) assert.doesNotThrow(() => JSON.parse(block.text), block.text);
  });

  test("examples labelled valid and invalid agree with the schema", () => {
    const labelled = fencedBlocks().filter((block) => block.language === "json" && block.label);
    const valid = labelled.filter((block) => /^Example: valid/.test(block.label));
    const invalid = labelled.filter((block) => /^Example: invalid/.test(block.label));
    assert.ok(valid.length >= 5 && invalid.length >= 7);
    for (const block of valid) assert.deepEqual(propertyErrors(JSON.parse(block.text)), [], block.text);
    for (const block of invalid) assert.notDeepEqual(propertyErrors(JSON.parse(block.text)), [], block.text);
  });

  test("complete manifests in the specification satisfy the schema", () => {
    const manifests = fencedBlocks()
      .filter((block) => block.language === "json")
      .map((block) => JSON.parse(block.text))
      .filter((value) => "schemaVersion" in value && "title" in value);
    assert.ok(manifests.length >= 4);
    for (const manifest of manifests) assert.deepEqual(manifestErrors(manifest), []);
  });
});

describe("schema", () => {
  test("requires exactly the properties the specification requires", () => {
    assert.deepEqual(schema.required, ["schemaVersion", "title", "entrypoint", "mediaType"]);
    const table = spec.split("### 5.3 Required properties")[1].split("### 5.4")[0];
    const listed = [...table.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]);
    assert.deepEqual(listed, schema.required);
  });

  test("defines every property the specification defines", () => {
    const defined = [...spec.split("### 5.5 Property definitions")[1].split("### 5.6")[0].matchAll(/^#### `([^`]+)`/gm)]
      .map((match) => match[1])
      .sort();
    assert.deepEqual(Object.keys(schema.properties).sort(), defined);
  });

  test("accepts what the publishing tool writes", () => {
    const manifest = buildManifest(
      null,
      {
        title: "Report",
        description: "A report",
        icon: "chart",
        generator: "tests",
        source: "https://example.org/repo",
      },
      ["index.html", "data.json"],
    );
    assert.deepEqual(manifestErrors(manifest), []);
    assert.equal(manifest.schemaVersion, SCHEMA_VERSION);
  });

  test("rejects manifests that break a rule", () => {
    const base = { schemaVersion: "0.1", title: "T", entrypoint: "index.html", mediaType: "text/html" };
    assert.deepEqual(manifestErrors(base), []);
    assert.notDeepEqual(manifestErrors({ ...base, title: "  " }), []);
    assert.notDeepEqual(manifestErrors({ ...base, title: "two\nlines" }), []);
    assert.notDeepEqual(manifestErrors({ ...base, source: "notes.txt" }), []);
    assert.notDeepEqual(manifestErrors({ title: "T" }), []);
  });
});
