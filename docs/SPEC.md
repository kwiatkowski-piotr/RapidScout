# RapidScout — specyfikacja skrócona

## Topic

`lsports-kafka.DI.LSI.Incidents.Extracted`

## Provider w payloadzie

Po analizie eventu **18664683** (production, 2026-05-13 21:00–22:46):

| Pole | Ścieżka | Uwagi |
|------|---------|--------|
| Provider | `Provider.Id` | `PRIMARY_PROVIDER_FIELD` — np. `8`, `253`, `257` |
| Czas payloadu | `Timestamp` (ISO-8601) | Zob. `PAYLOAD_TIME_FIELD_PATHS` |
| Fallback | `MessageDocument.provider` | Gdy brak `Provider` w JSON |

## Struktura wiadomości LSI

Jedna wiadomość ES = jeden event (`Name`, `Kind`, `Id`, `Period`, `Provider`).

Parser obsługuje też starszy format Trade: `Livescore.Periods[].Incidents[]` lub top-level `Incidents[]`.

## Wykres

`GET /api/incidents-extracted/analyze` zwraca `analysis.providerChart`:

- `points[]` — `timeEs`, `timePayload`, `provider`, `incidentKey`, `name`, `kind`, `scoreLabel` (z `Values`) …
- `summaryEs` / `summaryPayload` — `winsByProvider`, `medianTimeByProvider`

**Grupowanie LSI:** ten sam moment między providerami — klucz `Id:Period:Name:<Values po pozycjach lub Timestamp>`.

**UI:** wykres opóźnień — oś X = zdarzenia (etykieta `Name` + wynik z `Values`), oś Y = opóźnienie względem najszybszego (skala log), serie `P{id}`.
