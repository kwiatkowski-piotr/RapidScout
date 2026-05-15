# RapidScout

Narzędzie webowe do analizy wiadomości Kafka `lsports-kafka.DI.LSI.Incidents.Extracted` z Elasticsearch (Feed Saver).

## Po co ta aplikacja (cel)

RapidScout **skraca dystans** między surowym strumieniem zapisanym w ES a odpowiedzią na pytania operacyjne o **jakości i kolejności** feedów livescore:

- **Kto pierwszy zgłosił zdarzenie?** — wykres opóźnień względem najszybszego providera (czas ES vs czas w payloadzie), z czytelnymi nazwami znanych `Provider.Id`.
- **Czy widać cały mecz w danych, a nie tylko „początek pliku”?** — filtr typów LSI już w Elasticsearch (`payloadNames`) oraz opcjonalny **tryb stronicowany** (`pageSize` + `cursor`, potem `analyze-process`) zmniejszają ryzyko, że późne bramki czy kartki giną za dziesiątkami tysięcy innych wiadomości.
- **Co dokładnie przyszło w komunikacie?** — tabela wiadomości, timeline zdarzeń po sparsowaniu payloadu, podgląd JSON (Inspect).

To narzędzie do **scoutingu** jednego eventu w zadanym oknie czasu: szybka ocena opóźnień i kompletności, nie system produkcyjny scoringu meczów. Szczegóły techniczne i diagram stronicowania: [`docs/SPEC.md`](docs/SPEC.md).

## Wymagania

- Node.js 20+ (lokalny dev / build)
- `tsh` (Teleport) z dostępem do `es-feed-saver` — przy pracy **bez Dockera** na hoście
- Opcjonalnie: **Docker** + Compose — wtedy aplikacja w kontenerze, zwykle z `TSH=false` i `ELASTIC_URL` na proxy ES na hoście; zob. sekcję [Docker](#docker).

## Uruchomienie

```sh
# Zatrzymaj WSZYSTKIE stare `npm run dev` (Ctrl+C w każdym terminalu).
npm run reset    # tylko przy pierwszym razie lub po błędach
npm run dev
```

Otwórz adres z logu (`Local:`), zwykle http://localhost:4201

> Używamy **Nuxt 4.3.1** (jak provider-nuxt). Nuxt 3.21 ma bug SPA w dev: `Vite Node IPC socket path not configured`.

Otwórz: http://localhost:4201

**Przed pierwszą analizą** (w osobnym terminalu):

```sh
tsh login --proxy=teleport.statscore.com
tsh status   # musi zakończyć się bez błędu
```

RapidScout **nie** otwiera okna logowania SSO — wymaga wcześniejszej sesji `tsh`. Przy „Analizuj” uruchamia tylko `tsh proxy app es-feed-saver`.

Zmienne w `.env.development`:

```env
TSH=true
TELEPORT_PROXY=teleport.statscore.com
TELEPORT_APP=es-feed-saver
ELASTIC_URL=http://127.0.0.1:9200
```

Bez Teleportu: `TSH=false` i `ELASTIC_URL` na lokalny klaster / istniejący proxy.

## Docker

Produkcyjny build Nuxt (`nuxt build`, preset **node-server**), w kontenerze uruchamiany jest `node .output/server/index.mjs`. Port HTTP wewnątrz obrazu: **3000**; na hoście domyślnie **4201** (jak przy `npm run dev`).

### Wymagania

- Docker z BuildKit oraz **Docker Compose v2**
- Elasticsearch osiągalny **z kontenera** — typowo **`TSH=false`** i proxy `tsh` uruchomione **na hoście** (`tsh proxy app …` → np. `http://127.0.0.1:9200`), a w kontenerze **`ELASTIC_URL=http://host.docker.internal:9200`**. W `docker-compose.yml` jest `extra_hosts: host.docker.internal:host-gateway` (Linux); na Docker Desktop (macOS / Windows) `host.docker.internal` zwykle działa i tak.

### Uruchomienie

```sh
docker compose up --build
```

Przeglądarka: **http://localhost:4201**

Opcjonalnie skopiuj [`.env.docker.example`](.env.docker.example) → `.env.docker` i uruchom:

```sh
docker compose --env-file .env.docker up --build
```

Najważniejsze zmienne (zob. przykład): `RAPIDSCOUT_PORT` (port na hoście), `TSH`, `ELASTIC_URL`.

**Teleport w kontenerze:** domyślnie wyłączony (`TSH=false`) — pełne `tsh` w obrazie wymagałoby CLI, montowania katalogu z sesją/certyfikatami i utrzymania logowania. Zalecany wzorzec: proxy na hoście + `ELASTIC_URL` przez `host.docker.internal`.

### Ręczny build

```sh
docker build -t rapidscout:local .
docker run --rm -p 4201:3000 \
  -e TSH=false \
  -e ELASTIC_URL=http://host.docker.internal:9200 \
  --add-host=host.docker.internal:host-gateway \
  rapidscout:local
```

## Analiza: filtr w Elasticsearch, limit, strony

### Filtr typów (`payloadNames`)

- W formularzu pole **„Filtr typów w ES”** (domyślnie m.in. `Score`, `Corners`, `RedCard`, `YellowCard`) trafia do query API jako `payloadNames` — lista nazw LSI po przecinku.
- Po stronie ES zapytanie zawiera dodatkowy warunek `bool` / `should` z **`match_phrase` na polu `rawPayload`** (dwa warianty odstępu wokół JSON `"Name":"…"`), zbudowany w `lib/elasticsearch/raw-payload-name-filter.ts`.
- **Efekt:** do Node trafiają głównie wiadomości z wybranymi typami zdarzeń, więc **nie polegasz na „pierwszych N wiadomościach całego strumienia”**, żeby zobaczyć późne bramki czy kartki — o ile te zdarzenia są w komunikatach z danym `Name`.
- **Koszt utrzymania:** dopasowanie do tekstu JSON; przy zmianie formatu payloadu lub nazw trzeba zaktualizować listę / logikę filtra. Puste pole = brak filtra (wszystkie wiadomości w przedziale czasu, nadal limitowany limitem / stronami).

### Jedno żądanie (`maxResults`)

- Wiadomości sortowane **rosnąco po `providerSeq`**; twardy sufit: **`HARD_MAX_RESULTS`** (50 000) w `lib/consts.ts`.
- Użyteczne, gdy filtr ES mocno zawęża wolumen albo wystarczy początek strumienia.

### Tryb stronicowany (cursor)

- Checkbox **„Pobierz w stronach (cursor)”**: frontend wielokrotnie woła `GET …/analyze` z `pageSize` i `cursor`, scala `messages` + `incidents`, potem jedno **`POST …/analyze-process`** (klaster czasu, sort, wykres providerów) — mniejsze pojedyncze odpowiedzi JSON.
- Serwer agreguje stronę do żądanego `pageSize` wieloma zapytaniami ES po **`ES_PAGE_SIZE` (1000)** — `getIncidentsExtractedWindow` w `lib/elasticsearch/incidents-extracted-messages.ts`.
- Kursor to **`search_after`** (sort `providerSeq`) zakodowany base64url — `lib/elasticsearch/analyze-cursor.ts`.
- W UI jest limit **maks. liczby stron** na jedną analizę (**500** stron w `app/pages/index.vue`); przy przekroczeniu pojawia się alert o możliwej niepełności.

### Zakres czasu

- **„Od początku do końca meczu”** = musisz ustawić **Od / Do** na cały mecz (lub szerzej). Aplikacja nie wybiera końca spotkania automatycznie.

Szczegóły API, **diagram Mermaid (stronicowanie)** i model domeny: [`docs/SPEC.md`](docs/SPEC.md).

## Wykres opóźnień providerów

- **oś X** — zdarzenia (np. `Score` + wynik z `Values`, np. `0:1`); grupowanie po czasie meczu.
- **Grupowanie LSI (kartki itd.)** — kubełek `Kind`+`Name`+`Period`+`Id`, potem **łańcuch w czasie ES** z tolerancją `INCIDENT_TIME_CLUSTER_GAP_MS` (**12 s**); szczegóły i uzasadnienie: [`docs/SPEC.md`](docs/SPEC.md).
- **oś Y** — opóźnienie względem najszybszego providera, **skala log**.
- **Legenda / tooltips** — znane **`Provider.Id`** mapowane na czytelne nazwy (`Bet365 (8)`, `Statscore (253)`, …) w `lib/analysis/provider-labels.ts`; nieznane ID nadal jako `P{id}`.
- **Limit ES (tryb bez stron)** — patrz wyżej: **Limit wiadomości z ES** + alert o obcięciu; przy ciężkim strumieniu rozważ **filtr typów** i/lub **strony**.
- **Filtry w UI wykresu** — typy zdarzeń (`ProviderEventTypeFilter`), szybki filtr po `Name`.

## Test API (przykład)

Jedna odpowiedź (limit + opcjonalny filtr typów):

```sh
curl -s "http://localhost:4201/api/incidents-extracted/analyze?eventId=18664683&timestampFrom=2026-05-13T21:00:00&timestampTo=2026-05-13T22:46:00&environment=production&maxResults=50000&payloadNames=Score,YellowCard" | jq '.meta, .analysis.summary, .analysis.providerChart.summaryEs'
```

Strona (wykresu **nie** ma w tej odpowiedzi — tylko surowe incydenty z okna; pełna analiza przez `analyze-process`):

```sh
curl -s "http://localhost:4201/api/incidents-extracted/analyze?eventId=18664683&timestampFrom=2026-05-13T21:00:00&timestampTo=2026-05-13T22:46:00&environment=production&pageSize=5000&payloadNames=Score" | jq '.meta.nextCursor, .meta.messageCount'
```

## Testy

```sh
npm test
```

## Błąd: `Vite Node IPC socket path not configured`

1. Zatrzymaj **wszystkie** `nuxt dev` (porty 4201, 3000 itd.).
2. `npm run reset`
3. `npm run dev`

Jeśli port zajęty, Nuxt wybierze inny (np. 3000) — sprawdź `Local:` w terminalu.
