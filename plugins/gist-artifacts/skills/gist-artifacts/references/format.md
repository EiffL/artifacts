# Gist Artifact format (schema 0.1)

A conforming artifact is a GitHub Gist that contains a file named `artifact.json` and at least one content file. A Gist is flat: files have names, not paths.

## Manifest

```json
{
  "schemaVersion": "0.1",
  "title": "Cosmology Explorer",
  "entrypoint": "index.html",
  "mediaType": "text/html",
  "description": "Interactive exploration of a parameter posterior",
  "icon": "chart",
  "generator": "claude-code",
  "source": "https://github.com/example/analysis/commit/4c98629"
}
```

| Property | Required | Meaning |
| --- | --- | --- |
| `schemaVersion` | yes | Manifest format version, currently `"0.1"`. |
| `title` | yes | Human-readable title. The Gist description should equal it. |
| `entrypoint` | yes | Exact name of a file in the same Gist. |
| `mediaType` | yes | MIME type of the entrypoint. |
| `description` | no | One-sentence summary. |
| `icon` | no | One generic word such as `chart`, `map` or `notes`. |
| `generator` | no | Tool or agent that produced the artifact. |
| `source` | no | URL of the code, commit or dataset it was produced from. |

Readers ignore unknown properties. The manifest never contains secrets, the Gist ID, a revision SHA or a storage URL.

## How entrypoints are displayed

| `mediaType` | Display |
| --- | --- |
| `text/html` | The page itself, scripts enabled. |
| `text/markdown` | Rendered document with a source toggle. |
| `image/svg+xml` and other `image/*` | Shown as an image; scripts inside an SVG do not run. |
| `text/plain`, `application/json`, other `text/*` | Text preview. |

## Identity and revisions

- The artifact's identity is the Gist ID.
- Each update is one Git commit in the Gist; its SHA names an immutable revision.
- A fork is a new Gist. GitHub records the parent.
- An unlisted ("secret") Gist is not private: anyone with the link can view it.

## Viewer URLs

With a viewer at `https://viewer.example`:

```text
https://viewer.example/g/<gist-id>                framed view, latest revision (the link to share)
https://viewer.example/g/<gist-id>?rev=<sha>      framed view, pinned revision
```

The artifact's own files are served either from a per-artifact origin or from a path on the viewer, depending on how the viewer is deployed:

```text
https://<gist-id>.viewer.example/[@<sha>/][<file>]
https://viewer.example/a/<gist-id>/[@<sha>/][<file>]
```

Relative references in a page resolve against these, always within one revision.

After an update, a publishing tool may `POST https://viewer.example/api/revalidate?gist=<gist-id>` so the new revision shows immediately. Without it the viewer catches up within about a minute.
