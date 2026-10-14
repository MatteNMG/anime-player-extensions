# AnimePlayer Extensions

Extension repo for **AnimePlayer** — anyone can write a `.js` file that adds a
new anime source to the app (Android + Windows).

## Install in the app
Settings → Extensions → the app lists everything in `index.json`; tap Install.
You can also load a local `.js` file by path, or point the app at your own
index (POST /api/extensions/repo).

## Writing an extension
See `extensions/template.js`. A file is plain JavaScript run in a sandboxed
engine. Required: an `// @id` header comment and up to three functions:

- `search(query)` → `[{id,title,poster,year,episodes,kind,status,dub}]`
- `anime(id)` → `{id,title,poster,cover,plot,year,kind,status,score,genres,episodes:[{number,id,slug}]}`
- `stream(id, episode)` → `{url,kind:"hls"|"file",referer,download}`

Helpers available: `fetch(url, opts)`, `qs(html, css)`, `qs1(html, css)`, `log(...)`.

## Publishing
PR adding `extensions/yourid.js` + one entry in `index.json`:

```json
{ "id": "yourid", "name": "Your Source", "version": "1.0.0",
  "lang": "it", "desc": "one line", "url": "https://raw.githubusercontent.com/<owner>/<repo>/main/extensions/yourid.js" }
```
