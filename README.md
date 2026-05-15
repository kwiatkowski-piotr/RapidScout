# RapidScout

Narzędzie webowe do analizy wiadomości Kafka `lsports-kafka.DI.LSI.Incidents.Extracted` z Elasticsearch (Feed Saver).

## Wymagania

- Node.js 20+
- `tsh` (Teleport) z dostępem do `es-feed-saver`

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

## Test API (przykład)

```sh
curl -s "http://localhost:4201/api/incidents-extracted/analyze?eventId=18664683&timestampFrom=2026-05-13T21:00:00&timestampTo=2026-05-13T22:46:00&environment=production" | jq '.meta, .analysis.summary'
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
