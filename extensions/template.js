// ==AnimePlayer Extension==
// required: unique id [a-zA-Z0-9_-], display name, version, content language
// @id mysource
// @name MySource
// @version 1.0.0
// @lang it

// ---- globals provided by the app ----------------------------------------
// fetch(url, {method, headers, body}?) -> { status, body, headers }
// qs(html, "css.selector")  -> [{ text, html, attrs:{href,...} }]
// qs1(html, "css.selector") -> first match or null
// log(...)                  -> app log
// All three API functions must return JSON-serializable values.
// -------------------------------------------------------------------------

const BASE = "https://example.com";

// -> [{id, title, poster, year, episodes, kind, status, dub}]
function search(query) {
  const html = fetch(`${BASE}/search?q=${encodeURIComponent(query)}`).body;
  return qs(html, "article.card").map(el => ({
    id:      qs1(el.html, "a").attrs.href,
    title:   qs1(el.html, "h2").text,
    poster:  qs1(el.html, "img").attrs["data-src"] || "",
    year:    "",
    episodes: "",
    kind:    "",
    status:  "",
    dub:     false,
  }));
}

// -> {id, title, poster, cover, plot, year, kind, status, score,
//     genres:[], episodes:[{number, id, slug}]}
function anime(id) {
  const html = fetch(`${BASE}/anime/${id}`).body;
  const eps = qs(html, ".episodes a").map(el => ({
    number: el.text.trim(),
    id:     el.attrs.href,
    slug:   el.attrs.href.split("/").pop(),
  }));
  return {
    id, title: qs1(html, "h1").text,
    poster: qs1(html, "img.cover").attrs.src || "",
    cover: "", plot: qs1(html, ".plot").text,
    year: "", kind: "", status: "", score: "", genres: [],
    episodes: eps,
  };
}

// -> {url, kind:"hls"|"file", referer, download?}
function stream(id, episode) {
  const html = fetch(`${BASE}/watch/${id}/${episode}`).body;
  const vid = qs1(html, "video source");
  return {
    url: vid ? vid.attrs.src : "",
    kind: "file",
    referer: BASE + "/",
    download: null,
  };
}
