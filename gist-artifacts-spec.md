# Gist Artifacts Specification

**Spec Version:** 0.1  
**Status:** Draft  
**Latest version:** <https://github.com/EiffL/artifacts/blob/main/gist-artifacts-spec.md>  
**Feedback:** <https://github.com/EiffL/artifacts/issues>

A **Gist Artifact** is a GitHub Gist that carries a small manifest describing its content: what it is called, which file to open, and what kind of file that is. The convention turns an ordinary Gist into a self-describing, versioned unit of content (a report, a visualization, an interactive page, a document) that can be opened, updated, forked and cited.

This document specifies that convention and nothing else: the layout of the Gist, the manifest, how files refer to one another, and how identity and revisions work. Software built around artifacts is out of scope.

## Table of contents

1. [Status and version](#1-status-and-version)
2. [Conformance language](#2-conformance-language)
3. [Terminology](#3-terminology)
4. [Artifact model](#4-artifact-model)
5. [Manifest](#5-manifest)
6. [Entrypoint and media type](#6-entrypoint-and-media-type)
7. [References between files](#7-references-between-files)
8. [Identity and revisions](#8-identity-and-revisions)
9. [Gist metadata](#9-gist-metadata)
10. [Security and privacy considerations](#10-security-and-privacy-considerations)
11. [Versioning](#11-versioning)

- [Appendix A: Examples](#appendix-a-examples)
- [Appendix B: Conformance checklist](#appendix-b-conformance-checklist)
- [Appendix C: Design decisions](#appendix-c-design-decisions)
- [Appendix D: Change history](#appendix-d-change-history)
- [References](#references)

## 1. Status and version

This is version **0.1** of the specification. It is a **draft**: until version 1.0, a new version MAY change the format incompatibly. Every change is recorded in [Appendix D](#appendix-d-change-history).

An artifact declares the version it was written for in the `schemaVersion` property of its manifest ([§5.5](#55-property-definitions)). Version handling is defined in [§11](#11-versioning).

## 2. Conformance language

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, NOT RECOMMENDED, MAY, and OPTIONAL in this document are to be interpreted as described in BCP 14 [[RFC 2119](#references)] [[RFC 8174](#references)] when, and only when, they appear in all capitals.

Sections 1 to 11 are normative, except for text labelled as a note or an example. The appendices are non-normative.

Requirements are stated for artifacts and for the two roles defined in [§3](#3-terminology): producers, which write artifacts, and consumers, which read them.

## 3. Terminology

| Term | Meaning |
| --- | --- |
| **Gist** | A GitHub Gist: a Git repository holding a flat set of named files, together with an ID, an owner, a description and a comment thread. |
| **Artifact** | A Gist that satisfies [§4.1](#41-general-requirements). |
| **Manifest** | The file named `artifact.json` in an artifact. |
| **Content file** | Any file in an artifact other than the manifest. |
| **Entrypoint** | The content file the manifest names as the one to present first. |
| **Revision** | A commit in the Gist's history, identified by its full commit hash (40 hexadecimal characters). |
| **Current revision** | The revision at the head of the Gist's default branch. |
| **Owner** | The GitHub account the Gist belongs to. |
| **Producer** | A person or program that creates or changes an artifact. |
| **Consumer** | A program that reads an artifact, for example to present, copy or index it. |

## 4. Artifact model

### 4.1 General requirements

A Gist is an artifact at a given revision when, in that revision:

1. it contains a file named exactly `artifact.json`;
2. that file is a valid manifest ([§5](#5-manifest)); and
3. it contains the content file that the manifest names as its entrypoint ([§6.1](#61-entrypoint)).

Each revision is evaluated on its own. A Gist can be an artifact at one revision and not at another.

A consumer that encounters a Gist which is not an artifact MUST NOT treat it as one. It MAY still offer to present the Gist's files by other means.

### 4.2 Layout

A Gist holds named files and no directories, so an artifact is flat: the manifest and every content file sit side by side.

Example: a minimal artifact.

```text
artifact.json
index.html
```

Example: an artifact with a stylesheet, a data file and an image.

```text
artifact.json
index.html
style.css
data.json
figure1.png
```

### 4.3 File names

- File names are the Gist's file names. They are case-sensitive and MUST be compared exactly, without case folding, Unicode normalization or percent-decoding.
- A file name MUST NOT contain `/`.
- The name `artifact.json` is reserved for the manifest.
- Producers SHOULD NOT use names consisting of `gistfile` followed by digits, with or without an extension. GitHub assigns such names automatically.
- The manifest declares a media type for the entrypoint only. Consumers infer the type of every other file from its extension, so producers SHOULD give files a conventional extension (`.css`, `.json`, `.png`).

### 4.4 File content

- A content file MAY hold text or binary data. Text files SHOULD be encoded as UTF-8.
- A file MUST NOT be empty.
- A file SHOULD be smaller than 10 MB, and an artifact SHOULD contain fewer than 300 files.

> [!NOTE]
> These limits follow GitHub's. The Gist REST API accepts only non-empty text content, so binary files are added through the Gist's Git repository. When reading, the API returns at most 1 MB of each file's content and at most 300 files. A larger file is available in full from its raw URL, and a file over 10 MB only by cloning the Gist.

## 5. Manifest

### 5.1 Location and encoding

The manifest is the file named `artifact.json`. It MUST be a single JSON object [[RFC 8259](#references)] encoded as UTF-8 without a byte order mark.

### 5.2 Manifest object

Example: a manifest using every property defined by this specification.

```json
{
  "schemaVersion": "0.1",
  "title": "Cosmology Explorer",
  "entrypoint": "index.html",
  "mediaType": "text/html",
  "description": "Interactive exploration of a parameter posterior",
  "icon": "chart",
  "generator": "example-tool 1.4",
  "source": "https://github.com/example/analysis/commit/4c98629"
}
```

### 5.3 Required properties

| Property | Type | Description |
| --- | --- | --- |
| `schemaVersion` | string | Version of this specification the manifest was written for. |
| `title` | string | Human-readable title of the artifact. |
| `entrypoint` | string | Name of the content file to present first. |
| `mediaType` | string | Media type of the entrypoint. |

### 5.4 Optional properties

| Property | Type | Description |
| --- | --- | --- |
| `description` | string | One-sentence summary of the artifact. |
| `icon` | string | One generic word suggesting a pictogram for listings. |
| `generator` | string | Name of the software that produced the artifact. |
| `source` | string | URL of the code, commit or dataset the artifact was produced from. |
| `$schema` | string | URL of the JSON Schema for this manifest ([§11.3](#113-json-schema)). |

### 5.5 Property definitions

#### `schemaVersion`

- MUST be a string of the form `MAJOR.MINOR`, where both parts are decimal integers.
- MUST name the version of this specification that the manifest conforms to. For this version the value is `"0.1"`.

Example: valid.

```json
{ "schemaVersion": "0.1" }
```

Example: invalid. The first value is a number, not a string. The second has a prefix.

```json
{ "schemaVersion": 0.1 }
```

```json
{ "schemaVersion": "v0.1" }
```

#### `title`

- MUST be a string containing at least one character that is not white space.
- MUST NOT contain line breaks, and SHOULD be at most 200 characters long.
- Is plain text. Consumers MUST NOT interpret it as markup.

#### `entrypoint`

- MUST be the exact name of a content file present in the same revision ([§4.3](#43-file-names)).
- MUST NOT contain `/`, and MUST NOT be `artifact.json`.

Example: valid.

```json
{ "entrypoint": "index.html" }
```

```json
{ "entrypoint": "report.md" }
```

Example: invalid. A file name is not a path, so neither `./` nor a directory is allowed, and the manifest cannot be its own entrypoint.

```json
{ "entrypoint": "./index.html" }
```

```json
{ "entrypoint": "pages/index.html" }
```

```json
{ "entrypoint": "artifact.json" }
```

#### `mediaType`

- MUST be a media type [[RFC 6838](#references)] of the form `type/subtype`, optionally followed by parameters (`; name=value`).
- Is compared case-insensitively. Producers SHOULD write it in lower case.
- SHOULD agree with the entrypoint's content and file extension.

Example: valid.

```json
{ "mediaType": "text/html" }
```

```json
{ "mediaType": "text/markdown; variant=GFM" }
```

Example: invalid. Neither value is a media type.

```json
{ "mediaType": "html" }
```

```json
{ "mediaType": "HTML page" }
```

The meaning of the declared type is defined in [§6.2](#62-media-type).

#### `description`

- MUST be a string. It SHOULD be a single sentence of at most 500 characters.
- Is plain text. Consumers MUST NOT interpret it as markup.

#### `icon`

- MUST be a string. It SHOULD be a single generic lower-case word, such as `chart`, `map` or `notes`, of at most 40 characters.
- Is a hint. A consumer MAY map it to a pictogram of its own choosing, and MAY ignore it.
- MUST NOT be a URL or a file name, and SHOULD NOT be a product or brand name.

#### `generator`

- MUST be a non-empty string naming the software that produced the artifact, optionally with its version.
- Is informational and unverified ([§10.4](#104-integrity-and-provenance)).

#### `source`

- MUST be an absolute `https:` or `http:` URL identifying what the artifact was produced from, such as a repository, a commit, a notebook or a dataset.
- Is informational and unverified ([§10.4](#104-integrity-and-provenance)).

#### `$schema`

- MUST be a string holding the URL of the JSON Schema that describes the manifest ([§11.3](#113-json-schema)).
- Exists for the benefit of editors and validators. Consumers MUST NOT require it and MUST NOT retrieve it in order to read an artifact.

### 5.6 Additional properties

A producer MAY add properties that this specification does not define. Consumers MUST ignore properties they do not recognize, and MUST NOT reject a manifest because of them.

To avoid collisions with future versions, an additional property SHOULD be named with a reverse-domain prefix that its producer controls, for example `org.example.review`. Property names that contain no `.` are reserved for this specification.

### 5.7 Prohibited content

The manifest MUST NOT contain:

- passwords, access tokens or any other secret ([§10.2](#102-secrets));
- the artifact's own Gist ID, a revision hash of the artifact, or a URL at which the artifact is stored or presented.

Identity and location belong to the Gist, not to the manifest ([§8](#8-identity-and-revisions)). Recording them in the manifest would make every fork and copy wrong.

## 6. Entrypoint and media type

### 6.1 Entrypoint

The entrypoint is the content file that represents the artifact: the file a consumer presents when asked to present the artifact. An artifact has exactly one entrypoint per revision. Other content files exist to be referred to by it ([§7](#7-references-between-files)) or to be retrieved by name.

### 6.2 Media type

The `mediaType` property declares what the entrypoint is, and therefore how it is intended to be presented. This specification defines the following types.

| Media type | The entrypoint is | Intended presentation |
| --- | --- | --- |
| `text/html` | An HTML document. It may run scripts and refer to other files ([§7](#7-references-between-files)). | As an interactive page. |
| `text/markdown` | A Markdown document [[RFC 7763](#references)]. | As a formatted document. |
| `image/svg+xml` | An SVG image. | As a static image. Scripts inside it are not expected to run. |
| `image/png`, `image/jpeg`, `image/gif`, `image/webp` | A raster image. | As an image. |
| `text/plain` | Plain text. | As text. |
| `application/json` | A JSON document. | As text, formatted for reading. |

A producer MAY declare any other media type.

A consumer that does not recognize a parameter of a media type MUST ignore the parameter, not the media type. For example, `text/markdown; variant=GFM` is at least `text/markdown`.

A consumer that does not support the declared media type SHOULD make the entrypoint available unmodified, and MUST NOT guess a different type from its content.

## 7. References between files

### 7.1 Relative references

A content file MAY refer to another file of the same artifact by its bare file name, optionally prefixed with `./`.

Example: three relative references in an HTML entrypoint.

```html
<link rel="stylesheet" href="style.css">
<img src="./figure1.png" alt="Posterior contours">
<script>fetch("./data.json")</script>
```

Such a reference denotes the file of that name **in the same revision** as the file that contains it. A consumer presenting one revision of an artifact MUST resolve every relative reference within that revision, and MUST NOT combine files from different revisions.

### 7.2 Location independence

An artifact does not know where it will be presented. Therefore:

- A content file MUST NOT refer to the artifact's own files through references that begin with `/`, that contain a directory component, or that name a host.
- An artifact MUST NOT depend on the scheme, host name or path under which it is presented.
- An artifact SHOULD remain usable when browser storage such as cookies, `localStorage` or IndexedDB is unavailable.

### 7.3 External resources

A content file MAY load resources from, and make requests to, locations outside the artifact.

- A reference to an external script or stylesheet MUST name an exact version (`d3@7.9.0`, never `d3` or `d3@7`), so that the artifact means the same thing at every later reading.
- An artifact intended to be archived or read offline SHOULD have no external dependencies.

### 7.4 Data files

When an artifact presents data that is expected to change, the data SHOULD be kept in a content file of its own, such as `data.json`, which the entrypoint reads through a relative reference. The data can then be replaced without touching the page, and each change is a small revision with a meaningful diff.

## 8. Identity and revisions

### 8.1 Identity

The identity of an artifact is the ID of its Gist, a string of hexadecimal digits assigned by GitHub. The Gist's URL, `https://gist.github.com/<owner>/<gist-id>`, is the artifact's canonical source link.

Nothing inside the artifact repeats this identity ([§5.7](#57-prohibited-content)).

### 8.2 Revisions

Every change to a Gist is a commit, and every commit is a revision of the artifact.

- A reference to an artifact by its Gist ID alone denotes its **current revision**, which changes as the artifact is updated.
- A reference by Gist ID and commit hash denotes one **immutable revision**. A full 40-character hash MUST be used.

A consumer presenting a specific revision MUST take the manifest and every content file from that revision.

### 8.3 Updating

- An artifact is updated by committing to its Gist. A producer MUST NOT create a new Gist in order to change an existing artifact.
- A change that touches several files SHOULD be made as a single commit, so that no revision holds a partially updated artifact.
- Every revision a producer creates SHOULD satisfy [§4.1](#41-general-requirements).

### 8.4 Concurrent changes

A producer that changes an artifact on the basis of a revision it read earlier SHOULD verify that this revision is still the current one before writing. If it is not, the producer MUST NOT discard the newer revision: it re-reads the artifact and reconciles its change, or stops.

> [!NOTE]
> Git provides this check when a change is pushed: a push that is not a fast-forward of the current revision is rejected.

### 8.5 Forks and copies

A fork of an artifact's Gist is a different artifact with its own identity. GitHub records the Gist it was forked from; the manifest does not.

The files of an artifact, copied to any other location, still form a complete description of the artifact at that revision. This specification defines the convention for GitHub Gists only.

## 9. Gist metadata

### 9.1 Description

The Gist's description SHOULD be equal to the manifest's `title`. Listings of Gists show the description without reading file contents, so this keeps an artifact recognizable wherever Gists are listed.

A producer that changes the `title` SHOULD change the description in the same operation.

### 9.2 Visibility

An artifact's Gist MAY be public or secret. This specification attaches no further meaning to the distinction. Its consequences for confidentiality are described in [§10.1](#101-confidentiality).

### 9.3 Discussion

The Gist's comment thread is the artifact's discussion thread. Comments belong to the artifact as a whole. They are not part of any revision and are not anchored to a location in its content.

## 10. Security and privacy considerations

### 10.1 Confidentiality

A secret Gist is unlisted, not private: anyone who has its ID or URL can read every revision of it. There is no access control. An artifact MUST NOT be relied on to keep its content confidential.

Deleting a Gist removes the artifact, but not forks or copies that others have made.

### 10.2 Secrets

Neither the manifest nor any content file may contain credentials. Because every revision remains readable, a secret committed once stays exposed after it is removed from the current revision. A producer that publishes a secret by mistake MUST treat it as compromised.

### 10.3 Active content

The files of an artifact are chosen by its owner and can contain executable content, including scripts in HTML and SVG. Consumers MUST treat every file of an artifact as untrusted.

A consumer that executes artifact content MUST do so in a context that is isolated from the consumer's own credentials and from the data of other artifacts.

### 10.4 Integrity and provenance

A commit hash identifies the exact content of a revision. A reference to the current revision does not: it denotes whatever the owner publishes next. A reference that must keep its meaning SHOULD name a revision ([§8.2](#82-revisions)).

The `generator` and `source` properties are statements made by the producer. Nothing verifies them.

### 10.5 External resources

An artifact that loads external resources ([§7.3](#73-external-resources)) discloses each reader's network address to the hosts of those resources, and depends on those hosts continuing to serve the same content. Naming an exact version does not prove integrity. Producers MAY add Subresource Integrity metadata to external scripts and stylesheets.

## 11. Versioning

### 11.1 Specification versions

Versions of this specification are numbered `MAJOR.MINOR`.

- A new **minor** version adds to the format compatibly: new optional properties, newly defined media types, clarifications.
- A new **major** version may change the format incompatibly.
- While `MAJOR` is `0`, a new minor version MAY also be incompatible.

### 11.2 Version declared by an artifact

- A producer MUST set `schemaVersion` to the version of this specification the manifest conforms to.
- A consumer MUST NOT reject a manifest only because its `schemaVersion` names a later minor version than the consumer implements. It processes the manifest by the rules it implements and ignores what it does not recognize ([§5.6](#56-additional-properties)).
- A consumer that meets a `MAJOR` version it does not implement SHOULD report that the artifact uses an unsupported version instead of presenting it incorrectly.

### 11.3 JSON Schema

A JSON Schema for the manifest of each version is published in this repository under `schemas/<version>/artifact.schema.json`. For this version:

<https://raw.githubusercontent.com/EiffL/artifacts/main/schemas/0.1/artifact.schema.json>

A manifest MAY refer to it through the `$schema` property. The schema is an aid to authoring and validation. If the schema and this document disagree, this document is authoritative.

## Appendix A: Examples

*This appendix is non-normative.*

### A.1 A single page

```text
artifact.json
index.html
```

`artifact.json`:

```json
{
  "schemaVersion": "0.1",
  "title": "Quarterly summary",
  "entrypoint": "index.html",
  "mediaType": "text/html"
}
```

### A.2 A page with data and assets

```text
artifact.json
index.html
data.json
figure1.png
```

`artifact.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/EiffL/artifacts/main/schemas/0.1/artifact.schema.json",
  "schemaVersion": "0.1",
  "title": "Cosmology Explorer",
  "entrypoint": "index.html",
  "mediaType": "text/html",
  "description": "Interactive exploration of a parameter posterior",
  "icon": "chart",
  "generator": "example-tool 1.4",
  "source": "https://github.com/example/analysis/commit/4c98629"
}
```

`index.html` refers to its siblings by bare name:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Cosmology Explorer</title>
  </head>
  <body>
    <img src="figure1.png" alt="Posterior contours">
    <script>
      fetch("./data.json")
        .then((response) => response.json())
        .then((data) => console.log(data.samples.length));
    </script>
  </body>
</html>
```

Updating the samples means committing a new `data.json`. The page is untouched, and both the old and the new result remain available as revisions.

### A.3 A document

```text
artifact.json
report.md
figure1.png
```

`artifact.json`:

```json
{
  "schemaVersion": "0.1",
  "title": "Calibration report",
  "entrypoint": "report.md",
  "mediaType": "text/markdown"
}
```

`report.md` includes the figure with a relative reference: `![Residuals](figure1.png)`.

## Appendix B: Conformance checklist

*This appendix is non-normative. It summarizes the requirements of the normative sections and does not add to them.*

**The Gist**

- [ ] contains a file named exactly `artifact.json`
- [ ] contains the file named by `entrypoint`
- [ ] has no empty files
- [ ] has a description equal to the manifest's `title` (recommended)

**The manifest**

- [ ] is one JSON object, encoded as UTF-8
- [ ] has `schemaVersion`, `title`, `entrypoint` and `mediaType`, all strings
- [ ] `schemaVersion` has the form `MAJOR.MINOR`
- [ ] `title` is not blank and has no line breaks
- [ ] `entrypoint` contains no `/` and is not `artifact.json`
- [ ] `mediaType` has the form `type/subtype`, with optional parameters
- [ ] `source`, if present, is an absolute `https:` or `http:` URL
- [ ] contains no secret, no Gist ID, no revision hash and no storage URL

**The content**

- [ ] refers to its own files by bare name only
- [ ] does not depend on the address at which it is presented
- [ ] names an exact version for every external script and stylesheet
- [ ] contains no credentials

## Appendix C: Design decisions

*This appendix is non-normative.*

### Why GitHub Gists?

A Gist already provides what an artifact needs: storage, a stable identifier, an owner, a complete history, forks, a comment thread, and a link that can be shared. Building on it means the convention needs no service of its own, and an artifact outlives any software written to display it.

### Why a manifest at all?

Without one, a reader must guess: which of several files to open, whether a `.md` file is a document or a note to self, what to call the result. A manifest replaces those guesses with four declared facts. It also marks intent: a Gist with an `artifact.json` was published to be presented.

### Why is the manifest so small?

Every required property is something a reader cannot proceed without. Everything a Gist already records (owner, dates, history, visibility) is left to the Gist, so the two can never disagree.

### Why is there no identifier or URL in the manifest?

Because the same files must remain a correct artifact after a fork, a clone or a copy. Identity is a property of where the artifact is stored, not of what it contains.

### Why declare the media type instead of inferring it?

File extensions are ambiguous about intent. An `.html` file may be a page to display or source code to read; a `.json` file may be the content or merely data for it. Declaring the type states how the entrypoint is meant to be presented, and gives variants of a format a place to be named.

### Why flat files?

Because a Gist is flat. Accepting that limit keeps every artifact readable through GitHub's own interface and API, and it is rarely a constraint for content of this size. Content that needs a directory tree is better served by a repository.

### Why commits instead of version numbers?

A commit hash is assigned by the storage layer, cannot be reused, and identifies the exact bytes of every file. A version number in the manifest would be one more thing to keep in step, and could not guarantee any of that.

## Appendix D: Change history

*This appendix is non-normative.*

### 0.1 (November 2026)

- Initial version.

## References

### Normative

- **RFC 2119**: Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, March 1997. <https://www.rfc-editor.org/rfc/rfc2119>
- **RFC 8174**: Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, May 2017. <https://www.rfc-editor.org/rfc/rfc8174>
- **RFC 8259**: Bray, T., Ed., "The JavaScript Object Notation (JSON) Data Interchange Format", December 2017. <https://www.rfc-editor.org/rfc/rfc8259>
- **RFC 6838**: Freed, N., Klensin, J., and T. Hansen, "Media Type Specifications and Registration Procedures", BCP 13, January 2013. <https://www.rfc-editor.org/rfc/rfc6838>

### Informative

- **RFC 7763**: Leonard, S., "The text/markdown Media Type", March 2016. <https://www.rfc-editor.org/rfc/rfc7763>
- GitHub Docs, "REST API endpoints for gists". <https://docs.github.com/en/rest/gists/gists>
- GitHub Docs, "Creating gists". <https://docs.github.com/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/creating-gists>
- W3C, "Subresource Integrity". <https://www.w3.org/TR/SRI/>
