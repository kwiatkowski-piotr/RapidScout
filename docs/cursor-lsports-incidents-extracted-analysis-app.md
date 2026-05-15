# Instrukcja implementacji: aplikacja Node.js + Vue do analizy `lsports-kafka.DI.LSI.Incidents.Extracted`

> **Dla agenta Cursor:** Ten dokument jest specyfikacją wykonawczą. Implementuj dokładnie zgodnie z nim, reużywając wzorców z monorepo `external-providers-gateway`. Nie twórz osobnego stacku (Express + czysty Vue SPA), jeśli nie ma ku temu mocnego powodu — preferowany jest **Nuxt 3** (Vue + Nitro/Node), tak jak w `apps/provider-nuxt`.

---

## 1. Cel produktu

Zbudować **wewnętrzne narzędzie webowe** do analizy wiadomości Kafka zapisywanych przez Feed Saver w Elasticsearch:

| Element | Wartość |
|---------|---------|
| **Topic (dokładna nazwa w ES)** | `lsports-kafka.DI.LSI.Incidents.Extracted` |
| **Indeks ES** | `epg-v1-{environment}-lsports-kafka` |
| **Środowiska** | `beta`, `production` (wartość `APP_MODE` z Feed Saver) |
| **Identyfikator meczu** | pole `eventId` w dokumencie ES (= LSports Fixture ID, string) |

### Frontend — wymagane pola wejściowe

1. **Event ID** — identyfikator fixture’a do analizy (np. `17669222`).
2. **Przedział czasu** — data/czas od–do (filtr na `@timestamp` w ES).
3. *(opcjonalnie w UI, wymagane w API)* **Environment** — `beta` / `production` (domyślnie `production`).

Po kliknięciu „Analizuj” użytkownik widzi:
- listę wiadomości (tabela: seq, timestamp, topic),
- podgląd JSON payloadu (reuse `JsonModal` lub kopia wzorca),
- sekcję analityczną: timeline incidentów wyekstrahowanych z payloadów.

---

## 2. Kontekst w repozytorium (co już istnieje)

### 2.1 Feed Saver → Elasticsearch

Każda wiadomość to dokument `MessageDocument`:

```typescript
// libs/shared/feed-saver/types/src/lib/types/message-document.interface.ts
export interface MessageDocument {
  '@timestamp': number
  appMode: string
  eventId: string
  topic: string
  provider: string
  providerSeq: number
  headers: Record<string, unknown>
  rawPayload: string        // JSON string — parsować po pobraniu
  rawPayloadLength: number
}
```

Indeks: `epg-v${indexSchemaVersion}-${appMode}-${provider}` → dla LSports Kafka: **`epg-v1-{beta|production}-lsports-kafka`** (`indexSchemaVersion = 1`).

### 2.2 Event ID dla LSports Kafka

Strategia w `apps/feed-saver/src/ingress/event-id-strategies/lsports-kafka-event-id.strategy.ts`:
1. Preferuj nagłówek Kafka `key` (string).
2. W payloadzie: `LSportsFixtureId` lub `Fixture.Id`.

Dla wiadomości LSI typu Incidents event ID w ES to **ID fixture’a**.

### 2.3 Istniejące narzędzia do reużycia

| Zasób | Ścieżka | Co reużyć |
|-------|---------|-----------|
| Web UI (Nuxt + Vue) | `apps/provider-nuxt` | struktura app, `JsonModal`, `UTable`, plugin ES, TSH |
| Pobieranie wiadomości | `libs/shared/feed-saver/utils/src/lib/messages.utils.ts` | wzorzec `getMessages` — **rozszerzyć**, nie kopiować ślepo |
| Klient ES + Teleport | `apps/provider-nuxt/server/plugins/02.elastic-client.plugin.ts` | `getElasticClient()`, `tshSetup('es-feed-saver')` |
| CLI / proxy | `libs/cli` | dokumentacja Teleport dla devów |

### 2.4 Notebooki (referencja zapytań ES)

- `notebooks/lsports_kafka_di_fixture_prediction_markets_analysis.ipynb` — filtr `@timestamp` + `topic` + paginacja `search_after`.
- `notebooks/lsports_invalid_status_incidents_analysis.ipynb` — struktura payloadów z `Incidents` w Livescore (pomocne przy parsowaniu).

---

## 3. Decyzja architektoniczna

### Preferowana opcja: nowa aplikacja Nx

Utwórz **`apps/lsports-incidents-analyzer`** (Nuxt 3, `ssr: false`), skopiuj minimalną konfigurację z `apps/provider-nuxt`:

- `nuxt.config.ts` — aliasy, Nx vite paths, port **4201** (żeby nie kolidować z `provider-nuxt` na 4200).
- `server/plugins/02.elastic-client.plugin.ts` — ten sam wzorzec co provider-nuxt.
- `project.json` — tagi `scope:dev`, `type:app`.

**Uzasadnienie:** dedykowany UI tylko do analizy Incidents.Extracted, bez mieszania z flow „play to Rabbit” w provider-nuxt.

### Alternatywa (jeśli mało czasu)

Nowa strona `apps/provider-nuxt/app/pages/incidents-extracted.vue` + endpoint `server/api/incidents-extracted/`. Wtedy pomijasz nową apkę, ale trzymasz się tej samej specyfikacji API i UI poniżej.

---

## 4. Backend (Node / Nitro)

### 4.1 Nowa funkcja w shared utils

Plik: `libs/shared/feed-saver/utils/src/lib/incidents-extracted-messages.utils.ts`

```typescript
export type GetIncidentsExtractedParams = {
  index: string
  eventId: string
  topic: 'lsports-kafka.DI.LSI.Incidents.Extracted'
  timestampFrom: string // ISO 8601, np. 2026-02-02T00:00:00
  timestampTo: string
  maxResults?: number   // domyślnie 10_000, hard cap 50_000
}

export type IncidentsExtractedHit = SearchHit<MessageDocument>
```

**Zapytanie ES** (implementacja obowiązkowa):

```typescript
const TOPIC = 'lsports-kafka.DI.LSI.Incidents.Extracted'

// Paginacja search_after (NIE używaj from/offset przy >10k — patrz messages.utils.ts)
while (hits.length < maxResults) {
  const searchResult = await es.search<MessageDocument>({
    index,
    query: {
      bool: {
        must: [
          { term: { eventId: { value: eventId } } },
          { term: { topic: { value: TOPIC } } },
          {
            range: {
              '@timestamp': {
                gte: timestampFrom,
                lt: timestampTo,
              },
            },
          },
        ],
      },
    },
    sort: [{ providerSeq: 'asc' }],
    size: Math.min(1000, maxResults - hits.length),
    ...(searchAfter ? { search_after: searchAfter } : {}),
  })
  // ... break gdy brak hitów, ustaw searchAfter z ostatniego sort
}
```

**Uwagi:**
- `@timestamp` w ES może być `date` lub `long` — dopasuj format `range` do mapowania indeksu (sprawdź jednym zapytaniem w dev; jeśli `long`, konwertuj ISO → epoch ms w utils).
- Eksportuj funkcję z `libs/shared/feed-saver/utils/src/index.ts`.
- Dodaj test jednostkowy z mockiem klienta ES (wzorzec z innych testów w libs).

### 4.2 Endpoint HTTP

Plik: `apps/lsports-incidents-analyzer/server/api/incidents-extracted/analyze.get.ts`

**Query params:**

| Param | Typ | Wymagany | Opis |
|-------|-----|----------|------|
| `eventId` | string | tak | min. 1 znak, tylko cyfry zalecane |
| `timestampFrom` | string | tak | ISO datetime |
| `timestampTo` | string | tak | ISO datetime, musi być > from |
| `environment` | `'beta' \| 'production'` | nie | domyślnie `production` |
| `maxResults` | number | nie | domyślnie 10000 |

**Odpowiedź JSON:**

```typescript
type AnalyzeIncidentsExtractedResponse = {
  meta: {
    eventId: string
    topic: string
    index: string
    timestampFrom: string
    timestampTo: string
    messageCount: number
  }
  messages: Array<{
    providerSeq: number
    timestamp: string      // sformatowany dla UI
    topic: string
    rawPayload: unknown    // sparsowany JSON
  }>
  analysis: {
    /** Spłaszczone incidenty ze wszystkich wiadomości, posortowane po czasie */
    incidents: Array<{
      messageProviderSeq: number
      period?: number
      incidentType?: number
      seconds?: number
      participantPosition?: string
      /** pozostałe pola z payloadu — dynamicznie */
      [key: string]: unknown
    }>
    summary: {
      messagesCount: number
      incidentsCount: number
      incidentTypes: Record<string, number>  // IncidentType → count
    }
  }
}
```

**Parsowanie payloadu Incidents.Extracted:**

1. `JSON.parse(hit._source.rawPayload)`.
2. Agent **musi** pobrać 1–2 przykładowe rekordy z ES w dev i doprecyzować ścieżkę JSON (możliwe warianty):
   - tablica `Incidents` na top level,
   - `Livescore.Periods[].Incidents[]` (jak w notebooku invalid status),
   - inna struktura LSI — **nie zgaduj**, zweryfikuj na realnym payloadzie.
3. Zaimplementuj `extractIncidentsFromPayload(payload: unknown): unknown[]` defensywnie (brak pola → pusta tablica, log warn).

**Błędy:**
- `400` — walidacja Zod (złe daty, pusty eventId).
- `502` — ES niedostępny (brak Teleport).
- `504` — timeout zapytania (ustaw `requestTimeout: 30_000` na kliencie ES).

### 4.3 Cache (opcjonalnie, faza 2)

Notebook cache’uje do `./cache/*.json`. W aplikacji:
- katalog `apps/lsports-incidents-analyzer/.cache/` (dodaj do `.gitignore`),
- klucz: `sha1(environment + eventId + timestampFrom + timestampTo)`,
- TTL np. 1h — nie jest wymagane w MVP.

---

## 5. Frontend (Vue / Nuxt)

### 5.1 Strona główna

Plik: `apps/lsports-incidents-analyzer/app/pages/index.vue`

**Layout formularza (Nuxt UI — jak provider-nuxt):**

```
┌─────────────────────────────────────────────────────────┐
│  LSports Incidents.Extracted Analyzer                   │
├─────────────────────────────────────────────────────────┤
│  Event ID:     [________________]                       │
│  Od:           [datetime-local / UInput datetime]         │
│  Do:           [datetime-local]                         │
│  Środowisko:   ( ) beta  (•) production                 │
│                          [ Analizuj ]                   │
├─────────────────────────────────────────────────────────┤
│  Podsumowanie: N wiadomości, M incidentów               │
│  ┌─ Tabela wiadomości ─────────────────────────────┐   │
│  │ # │ Seq │ Timestamp │ Akcje (inspect)          │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─ Tabela incidentów ─────────────────────────────┐   │
│  │ Period │ Type │ Seconds │ Position │ Seq msg   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Zachowanie:**
- `useFetch('/api/incidents-extracted/analyze', { query, immediate: false })` — wywołanie po submit.
- Walidacja po stronie klienta (Zod): `eventId` wymagany, `timestampTo > timestampFrom`.
- Loading state (`messagesStatus === 'pending'`).
- Toast przy błędzie (wzorzec z `Messages.vue`).
- Klik wiersza wiadomości → modal JSON (`JsonModal` — skopiuj komponent z provider-nuxt).

### 5.2 Domyślny indeks ES

Nie każ użytkownikowi wpisywać nazwy indeksu ręcznie (w przeciwieństwie do Messages w provider-nuxt). Oblicz:

```typescript
const index = `epg-v${indexSchemaVersion}-${environment}-lsports-kafka`
```

### 5.3 Format dat w UI

- Przechowuj w stanie jako ISO string (`YYYY-MM-DDTHH:mm:ss`).
- Wyświetlaj w tabeli przez istniejący `formatTimestamp` (skopiuj util z provider-nuxt).

---

## 6. Konfiguracja i uruchomienie

### 6.1 Zmienne środowiskowe

W `apps/lsports-incidents-analyzer/.env.development`:

```env
TSH=true
ELASTIC_URL=http://127.0.0.1:9200
```

### 6.2 Teleport (dev)

Użytkownik musi mieć `tsh` (jak w notebookach):

```sh
tsh login --proxy=teleport.statscore.com
# opcjonalnie ręcznie:
tsh proxy app es-feed-saver --port 9800
```

Aplikacja z `TSH=true` uruchamia proxy automatycznie (plugin ES).

### 6.3 Komendy Nx

Dodaj targety w `apps/lsports-incidents-analyzer/project.json` (wzoruj się na provider-nuxt / innych appkach Nuxt w monorepo):

```sh
npx nx serve lsports-incidents-analyzer
```

Otwórz: `http://localhost:4201`

### 6.4 Zależności

Używaj wyłącznie z root `package.json`:
- `@elastic/elasticsearch`
- `@epg/shared-feed-saver-utils`
- `@epg/shared-feed-saver-types`
- `@nuxt/ui`, `zod`, `vue-json-pretty` (jeśli potrzebny modal)

**Nie dodawaj** pandas / Pythona.

---

## 7. Struktura plików (checklist)

```
apps/lsports-incidents-analyzer/
  app/
    pages/index.vue
    components/
      IncidentsExtractedForm.vue
      IncidentsMessagesTable.vue
      IncidentsTimelineTable.vue
      JsonModal.vue              # kopia z provider-nuxt
    utils/format-timestamp.utils.ts
  server/
    api/incidents-extracted/analyze.get.ts
    plugins/02.elastic-client.plugin.ts
    config/config.ts
  nuxt.config.ts
  project.json
  .env.development
  README.md                      # krótka instrukcja uruchomienia

libs/shared/feed-saver/utils/src/lib/
  incidents-extracted-messages.utils.ts
  incidents-payload.parser.ts      # extractIncidentsFromPayload
  incidents-extracted-messages.utils.spec.ts
  incidents-payload.parser.spec.ts
```

---

## 8. Reguły implementacji (dla agenta)

1. **TypeScript strict** — zgodnie z `tsconfig.base.json`.
2. **Bez zbędnych refaktorów** — nie zmieniaj provider-nuxt poza ewentualnym wyciągnięciem współdzielonego modułu, jeśli duplikacja > 100 linii.
3. **ESLint** — `nx lint lsports-incidents-analyzer` musi przechodzić.
4. **Testy** — minimum testy parsera payloadu i budowy zapytania ES (mock).
5. **Bezpieczeństwo** — brak ekspozycji publicznej; narzędzie dev-only, bez auth w MVP (jak provider-nuxt).
6. **Limit wyników** — hard cap `maxResults` ≤ 50_000; UI pokazuje ostrzeżenie przy >10k wierszy.
7. **Topic dokładnie** — `lsports-kafka.DI.LSI.Incidents.Extracted` (wielkość liter ma znaczenie).

---

## 9. Kryteria akceptacji

- [ ] Formularz: Event ID + przedział czasu + environment.
- [ ] Po „Analizuj” dane z ES tylko dla topicu `lsports-kafka.DI.LSI.Incidents.Extracted` i podanego `eventId`.
- [ ] Filtr czasu na `@timestamp` działa poprawnie.
- [ ] Tabela wiadomości z `providerSeq`, timestampem, podglądem JSON.
- [ ] Sekcja analityczna z listą incidentów i podsumowaniem (`incidentTypes`).
- [ ] Działa z Teleport (`TSH=true`) na beta i production.
- [ ] `nx lint` i `nx test` (dotknięte projekty) przechodzą.
- [ ] `README.md` w aplikacji opisuje uruchomienie w ≤15 linii.

---

## 10. Kolejność prac (sugerowana)

1. Utils: zapytanie ES + parser payloadu (+ testy).
2. Endpoint `analyze.get.ts`.
3. Szkielet aplikacji Nuxt + plugin ES.
4. Formularz + tabele + modal JSON.
5. README + wpis w root README lub `docs/` z linkiem.
6. Ręczny test na znanym `eventId` z produkcji/bety.

---

## 11. Przykład ręcznego testu API

```sh
curl -s "http://localhost:4201/api/incidents-extracted/analyze?eventId=18001642&timestampFrom=2026-02-01T00:00:00&timestampTo=2026-02-14T10:00:00&environment=production" | jq '.meta, .analysis.summary'
```

*(eventId przykładowy — użyj realnego ID z ES)*

---

## 12. Uwagi dotyczące przyszłych rozszerzeń (poza MVP)

- Eksport CSV/JSON wyników.
- Wykres timeline (Chart.js / ECharts).
- Porównanie dwóch eventId.
- Filtr po `IncidentType`.
- Integracja z `epg ui` jako subkomenda.

---

*Dokument: specyfikacja dla Cursor Agent. Ostatnia aktualizacja: 2026-05-15.*
