# AnimePlayer Extensions

Estensioni per **AnimePlayer** (Android + Windows). Un'estensione è un singolo
file `.js` che aggiunge una nuova fonte anime all'app. Chiunque può scriverne
una, caricarla in locale, o pubblicarla nel repo pubblico
[`anime-player-extensions`](https://github.com/MatteNMG/anime-player-extensions)
per renderla installabile da tutti.

Non serve conoscere il codice dell'app: tutto il contratto è in questa pagina.

---

## Indice

1. [Come funziona](#come-funziona)
2. [Header metadata](#header-metadata)
3. [Le tre funzioni](#le-tre-funzioni)
4. [API disponibili (globals)](#api-disponibili-globals)
5. [Regole e limiti del motore](#regole-e-limiti-del-motore)
6. [Esempio completo](#esempio-completo)
7. [Installare e testare](#installare-e-testare)
8. [Pubblicare nel repo](#pubblicare-nel-repo)
9. [Comportamenti avanzati](#comportamenti-avanzati)
10. [Errori e debug](#errori-e-debug)

---

## Come funziona

- Ogni `.js` caricato nell'app diventa una **sorgente** al pari di quelle
  integrate (AnimeSaturn, AnimeUnity). Compare nella ricerca, nei dettagli e nel
  player.
- Il file viene eseguito da un engine JavaScript embedded (**Boa**) in una
  sandbox: niente filesystem, niente rete diretta — solo le funzioni globali
  documentate sotto.
- **Ogni chiamata riesegue il file da zero in un contesto fresco**: lo stato
  globale non persiste tra `search`, `anime` e `stream`. Metti costanti e
  helper a top-level (vengono rivalutati), ma non contare su variabili globali
  che sopravvivano tra una chiamata e l'altra.
- I nomi delle funzioni e dei campi sono il **contratto**: devono essere
  esattamente quelli documentati.

## Header metadata

In cima al file, nei primi 60 righe, commenti con `@chiave valore`:

```js
// @id      mioscraper        // OBBLIGATORIO — solo [a-zA-Z0-9_-], reso lowercase
// @name    Il Mio Scraper    // nome mostrato in app (default: @id)
// @version 1.0.0             // default: 0.0.0
// @lang    it                // lingua contenuti, default "it"
```

L'`@id` è l'identità dell'estensione:
- il nome del file **non conta** (`pippo.js` con `@id foo` si chiama `foo`);
- un file con lo stesso `@id` di una fonte integrata (`saturn`, `unity`) la
  **sostituisce** (shadowing) — cancellando il file torna quella integrata;
- non confondere `@id` con lo `id` degli anime (sono cose diverse).

## Le tre funzioni

Implementa queste funzioni globali. Tutti i campi sono opzionali dove non
segnato — quelli con `*` sono necessari per un risultato usabile.

### `search(query)` → `Array`

Chiamata quando l'utente cerca. `query` è una stringa. Ritorna:

```js
[{
  id:       "frieren-123",   // * stringa opaca: ripassata identica ad anime()
  title:    "Frieren",       // *
  poster:   "https://…jpg",  // URL assoluto copertina
  year:     "2023",          // stringa (o numero, convertito)
  episodes: "28",            // conteggio come stringa → badge "28 ep"
  kind:     "TV",            // tipo: TV / Movie / OAV / Special …
  status:   "ongoing",       // in corso / completato, testo libero
  dub:      false            // bool — true = doppiato ITA (filtro SUB/ITA + badge)
}]
```

- `id` viene salvato in preferiti/cronologia/progressi → **deve essere stabile**
  tra ricerche e riavvii (usa lo slug o l'id del sito, non l'URL completo se
  cambia).
- `dub: true` marca la versione ITA — l'app la usa per il filtro audio e per il
  badge "ITA" sulle card.

### `anime(id)` → `Object`

Chiamata quando l'utente apre la pagina dell'anime. `id` è lo stesso `id` che
hai emesso in `search()`. Ritorna:

```js
{
  id:      "frieren-123",   // opzionale, default = l'id passato
  title:   "Frieren",       // *
  poster:  "https://…jpg",  // copertina verticale
  cover:   "https://…jpg",  // banner orizzontale (hero)
  plot:    "Sinossi…",
  year:    "2023", kind: "TV", status: "ongoing", score: "8.9",
  genres:  ["Fantasy", "Avventura"],
  episodes: [{               // * ordinata come vuoi mostrarla
    number: "1",             // * VISIBILE e passata a stream() come `ep`
    id:     "watch/abc",     // libero: non usato dall'app, per tua comodità
    slug:   "frieren-ep-1"   // libero: idem
  }]
}
```

- **`episodes[].number` è la chiave**: è mostrato nella griglia, è il valore
  `ep` che `stream()` riceve, ed è la chiave dei progressi salvati. Se il sito
  usa numeri strani ("7.5", "OAV-1") vanno bene, basta che siano unici.
- Pattern comune: `number` = numero pulito, e in `stream()` rifai la fetch
  della pagina anime per mappare numero → URL episodio (lo `id` anime arriva
  anche a `stream()`).

### `stream(id, ep)` → `Object`

Chiamata quando l'utente preme play sull'episodio `ep` dell'anime `id`.
Ritorna:

```js
{
  url:      "https://cdn…/video.mp4",  // * URL media finale
  kind:     "file",                    // "hls" = playlist .m3u8 | "file" = mp4/mkv diretto
  referer:  "https://sito.xyz/",       // Referer inviato alle richieste proxy
  download: "https://cdn…/dl.mp4"      // opzionale: URL mp4 per download offline
}
```

- **Non proxxare tu l'URL**: l'app wrappa automaticamente `url` nel suo proxy
  locale (`/proxy?u=…&r=<referer>`), che inoltra il `referer` e riscrive le
  playlist m3u8. Tu ritorni l'URL "crudo" del sito/CDN.
- `kind: "hls"` → il player usa Hls.js; `"file"` (o qualunque altro valore) →
  `<video>` diretto. Per gli mp4 usa `"file"`.
- `download`: se presente l'app scarica quel file per l'offline. Se assente e
  `kind="hls"`, scarica i segmenti via proxy (funziona ma più lento).

## API disponibili (globals)

### `fetch(url, opts?)` → `{status, body, headers}` — **sincrona**

```js
const res = fetch("https://api.sito.it/search", {
  method: "POST",                       // GET di default
  headers: { "X-Token": t, "Content-Type": "application/json" },
  body: JSON.stringify({ q: query })    // solo stringa
});
res.status   // 200
res.body     // corpo come stringa (parse con JSON.parse o qs)
res.headers  // { "content-type": "…", "set-cookie": ["a=1","b=2"] }
```

- Cookie jar condiviso tra le fetch dentro la stessa invocazione… **ma ogni
  chiamata dell'app è un contesto nuovo**: se ti servono cookie (login, XSRF)
  devi fare il primo fetch dentro la stessa funzione.
- Header di risposta ripetuti (es. `set-cookie`) arrivano come **array**.
- User-Agent desktop Chrome già impostato; redirect seguiti (max 10);
  timeout 25s. Errori di rete → throw (vedi debug).

### `qs(html, "selettore")` → `Array` · `qs1(html, "selettore")` → `Object|null`

Parsing HTML con selettori CSS (engine `scraper`, CSS standard):

```js
const cards = qs(html, "a.card");
cards[0].text         // testo interno concatenato e trimmato
cards[0].html         // innerHTML
cards[0].outer        // outerHTML (include il tag stesso)
cards[0].parent_html  // innerHTML del genitore (utile per meta a sibling)
cards[0].attrs        // { href: "…", "data-id": "42", … } — tutti gli attributi
```

Selettori supportati: `tag`, `.class`, `#id`, `[attr]`, `[attr=v]`,
`[attr~=v]`, discendente/figlio/fratelli (` `, `>`, `+`, `~`), `*`,
pseudo base (`:first-child`, `:nth-child(n)`, `:not(...)` …).
**Non** supportati: `:contains`, `:has`, XPath (usa `parent_html` +
un secondo `qs` per quei casi).

### `atob(b64)` / `btoa(str)` · `log(...)`

- `atob`/`btoa`: base64 con semantica latin-1 (1 byte = 1 char), per i payload
  offuscati tipo XOR+base64 di certi player.
- `log(...)`: stampa nel log dell'app (`adb logcat` su Android / stdout su
  desktop). Oggetti serializzati in JSON.

## Regole e limiti del motore

- **JavaScript sincrono puro**: niente `async`/`await`, `Promise`, `setTimeout`,
  `fetch` browser, `XMLHttpRequest`, DOM, `import`/`require`. `fetch()` qui è
  bloccante — chiamala e basta.
- Il file viene rivalutato ad ogni chiamata: niente stato persistente,
  niente cache in memoria tra chiamate.
- Il valore di ritorno deve essere **JSON-serializzabile** (viene fatto
  `JSON.stringify` internamente): niente funzioni, `undefined` diventa `null`,
  niente riferimenti circolari.
- Usa `encodeURIComponent` per i parametri URL. Dati binari solo via `atob`.
- Performance: `fetch` ha timeout 25s; evita loop di decine di richieste in
  `search` (l'utente aspetta).

## Esempio completo

Estensione minima ma reale contro una JSON API:

```js
// @id demosrc
// @name DemoSource
// @version 1.0.0
// @lang it

const BASE = "https://api.demo-anime.it";

function search(query) {
  const r = fetch(`${BASE}/search?q=${encodeURIComponent(query)}`);
  const data = JSON.parse(r.body);
  return data.results.map(a => ({
    id: String(a.id),           // sempre stringa
    title: a.title,
    poster: a.image,
    year: String(a.year || ""),
    episodes: String(a.episodes || ""),
    kind: a.format || "TV",
    status: a.status || "",
    dub: !!a.has_ita_dub,
  }));
}

function anime(id) {
  const a = JSON.parse(fetch(`${BASE}/anime/${id}`).body);
  return {
    title: a.title,
    poster: a.image,
    cover: a.banner || a.image,
    plot: (a.synopsis || "").trim(),
    year: String(a.year || ""),
    kind: a.format || "TV",
    status: a.status || "",
    score: String(a.score || ""),
    genres: a.genres || [],
    episodes: a.episodes.map(e => ({
      number: String(e.number),   // questo arriva a stream() come `ep`
      id: e.slug,
    })),
  };
}

function stream(id, ep) {
  // ritrovo lo slug episodio dalla pagina anime (numero → slug)
  const a = JSON.parse(fetch(`${BASE}/anime/${id}`).body);
  const e = a.episodes.find(x => String(x.number) === String(ep));
  if (!e) throw new Error(`episodio ${ep} non trovato`);

  const embed = fetch(`${BASE}/watch/${e.slug}`).body;
  const m3u8 = embed.match(/https:\/\/[^"']+\.m3u8[^"']*/);
  if (!m3u8) throw new Error("stream non trovato");

  return {
    url: m3u8[0],
    kind: "hls",
    referer: `${BASE}/`,                 // se la CDN controlla il Referer
  };
}
```

## Installare e testare

Nell'app: tab **Estensioni** → tre vie:

1. **Dal repo** — la lista "Disponibili" legge `index.json`: *Installa*.
2. **Da URL** — incolla l'URL diretto di un `.js` (es. raw.githubusercontent…).
3. **Da file** — "File .js…" e scegli un file dal dispositivo.

Dopo l'installazione compare in "Installate" con *Attiva/Disattiva* e *✕*
(rimuovi). Test rapido via API dell'app (desktop):

```bash
# installa da codice
curl -X POST localhost:PORTA/api/extensions/install \
  -H "Content-Type: application/json" -d '{"code":"<file contents>"}'

# la tua fonte deve comparire qui
curl localhost:PORTA/api/sources
```

Su Android la porta dell'app si trova in logcat (`server listening`).

## Pubblicare nel repo

Repo pubblico: `MatteNMG/anime-player-extensions`. Per rendere la tua
estensione installabile dalla lista "Disponibili":

1. Fork il repo, aggiungi `extensions/<tuaid>.js` (nome file libero,
  l'identità è l'`@id` dentro).
2. Aggiungi una voce in `index.json`:

```json
{
  "id": "tuaid",
  "name": "Nome Visibile",
  "version": "1.0.0",
  "lang": "it",
  "description": "Fonte X — SUB/ITA, HLS",
  "url": "https://raw.githubusercontent.com/MatteNMG/anime-player-extensions/main/extensions/tuaid.js"
}
```

3. Apri una Pull Request. Requisiti: `@id` valido e unico, niente credenziali
   hardcodate, niente codice offuscato illeggibile.

## Comportamenti avanzati

- **Shadow delle integrate**: un file con `@id saturn` o `unity` sostituisce
  la fonte integrata con la tua versione (es. fix urgente senza aspettare un
  aggiornamento app). Eliminando il file torna l'originale embedded.
- **Estensioni = solo sorgenti**: download, preferiti e sync restano gestiti
  dall'app — l'estensione deve solo risolvere search/anime/stream.
- **Repo custom**: POST `/api/extensions/repo {"url":"…index.json"}` per
  puntare l'app a un index alternativo (utile per testare prima del PR).
- **Non vengono sincronizzate** tra dispositivi: ogni device installa le sue
  (impostazioni `ext_*` sono local-only).

## Errori e debug

- Lancia `throw new Error("…")` o ritorna `{__err:"…"}` — l'app mostra il
  messaggio come errore di rete della sorgente.
- `log("debug:", JSON.stringify(x))` → appare nel log app. Su Android:
  `adb logcat | grep ext`. Su desktop: stdout del processo.
- Errori comuni:
  - `extension missing a valid @id header` → header `@id` assente/invalido
    (deve stare nei primi 60 righe, formato `// @id xxx`)
  - `missing search` → la funzione non è definita a top-level (attenzione a
    `const search = …` dentro blocchi — usa `function search(…)`)
  - `extension returned invalid JSON` → hai ritornato qualcosa non
    serializzabile (funzione, DOM, riferimento circolare)
  - ricerca vuota senza errori → `search()` torna `[]` oppure ha lanciato
    dentro una `try/catch` tua: controlla con `log()`
  - `qs` torna `[]` → il sito serve markup diverso (SPA/JS-rendered non si
    può fare — serve una JSON API) oppure il selettore è sbagliato
- Alcuni siti richiedono cookie/token prima delle API: fai il fetch della
  homepage **nella stessa funzione**, leggi `set-cookie`/`x-xsrf-token` dagli
  header di risposta e rimandali nel fetch successivo (`res.headers` espone
  gli header ripetuti come array).
