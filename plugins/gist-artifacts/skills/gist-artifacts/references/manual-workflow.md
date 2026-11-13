# Publishing without the helper script

Use this only when Node.js is unavailable. It needs the GitHub CLI (`gh`) signed in with the `gist` scope, and `git` for binary files. Replace `VIEWER` with the viewer base URL (default `https://gist-artifacts.vercel.app`).

## Publish

1. Write `artifact.json` next to the content files, all in one flat directory:

   ```json
   {
     "schemaVersion": "0.2",
     "title": "My report",
     "entrypoint": "index.html",
     "mediaType": "text/html",
     "description": "One sentence about it"
   }
   ```

2. Create the Gist with every text file. It is unlisted unless you add `--public`. Use the title as the description:

   ```bash
   gh gist create artifact.json index.html data.json --desc "My report"
   ```

   The command prints the Gist URL; its last path segment is the Gist ID.

3. Share `VIEWER/g/<gist-id>`.

## Update

Text files, in one revision (a `null` value deletes a file):

```bash
gh api -X PATCH "gists/<gist-id>" --input - <<'JSON'
{ "files": { "data.json": { "content": "{\"values\": [1, 2, 3]}" }, "old.txt": null } }
JSON
```

For larger files, build the JSON with `jq`:

```bash
jq -n --rawfile html index.html '{files: {"index.html": {content: $html}}}' \
  | gh api -X PATCH "gists/<gist-id>" --input -
```

Binary files, or a conflict-safe update, go through Git. A push that is not a fast-forward is rejected, which is the conflict signal:

```bash
gh auth setup-git
git clone https://gist.github.com/<gist-id>.git work && cd work
cp ../figure1.png . && git add figure1.png && git commit -m "Add figure" && git push
```

Then make the new revision visible immediately:

```bash
curl -s -X POST "VIEWER/api/revalidate?gist=<gist-id>"
```

## Read, list, comment

```bash
gh api "gists/<gist-id>" --jq '.history[0].version, (.files | keys)'      # current revision and files
gh api gists --paginate --jq '.[] | select(.files["artifact.json"]) | "\(.id)  \(.description)"'
gh api "gists/<gist-id>/comments" --jq '.[] | "@\(.user.login): \(.body)"'
gh api -X POST "gists/<gist-id>/comments" -f body="Fixed in the latest revision."
```
