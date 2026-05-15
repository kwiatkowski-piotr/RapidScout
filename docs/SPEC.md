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

**Grupowanie incydentów (LSI, po `analyze`):** nie używamy samego wyniku z `Values` jako jedynego kryterium „tej samej” kartki u różnych providerów.

1. **Kubełek:** `Kind` + `Name` + `Period` + `Id` (np. `Statistic` + `YellowCard` + `2` + `6`).
2. **Czas:** sortowanie po `reportedAtEs` (czas ES wiadomości).
3. **Łańcuch:** kolejne wiadomości w kubełku należą do tego samego klastra, jeśli odstęp od **poprzedniej** w kolejności czasu jest ≤ `INCIDENT_TIME_CLUSTER_GAP_MS` (**12 s**, stała w `lib/consts.ts`).
4. **`incidentKey`:** po klastrowaniu ma postać `tc:Kind:Name:Period:Id:c{n}`.

**Uzasadnienie 12 s (event 18664683, 13.05.2026):** na próbce z początku strumienia kolejne komunikaty `YellowCard` rozdzielały się o **dziesiątki sekund** (osobne zdarzenia na boisku), podczas gdy ten sam fakt u różnych providerów zwykle pojawia się w odstępie rzędu ms–kilku sekund. **12 s** to zapas na wolniejsze feedy przy zachowaniu bezpiecznego odstępu od kolejnej prawdziwej kartki.

Parser nadal wypełnia `scoreLabel` z `Values` — używane w etykietach wykresu / tooltipach, **nie** jako jedyny klucz grupowania kartek.

**UI:** wykres opóźnień — oś X = zdarzenia (etykieta `Name` + wynik z `Values`), oś Y = opóźnienie względem najszybszego (skala log), serie `P{id}`.
