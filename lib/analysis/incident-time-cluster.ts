import type { ExtractedIncident } from '../elasticsearch/incidents-payload.parser'

/**
 * LSI wiadomości mają Kind + Name w payloadzie. Dla nich grupujemy po czasie
 * (nie po samym wyniku z Values).
 */
export function shouldClusterIncidentByTime(incident: ExtractedIncident): boolean {
  return typeof incident.kind === 'string' && typeof incident.name === 'string'
}

export function incidentClusterBucketKey(incident: ExtractedIncident): string {
  const kind = incident.kind ?? ''
  const name = incident.name ?? ''
  const period = incident.period ?? ''
  const id = incident.incidentType ?? ''
  return `${kind}\t${name}\t${period}\t${id}`
}

/**
 * W obrębie jednego kubełka (Kind, Name, Period, Id) sortujemy po `reportedAtEs`
 * i dzielimy na klastry: nowy klaster, gdy odstęp od **poprzedniej** wiadomości
 * w tym kubełku (w czasie) jest większy niż `gapMs`.
 *
 * Używamy wyłącznie czasu ES (`reportedAtEs`) — stabilne przy przełączniku czasu na wykresie.
 */
export function applyIncidentTimeClustering(
  incidents: ExtractedIncident[],
  gapMs: number,
): void {
  const buckets = new Map<string, ExtractedIncident[]>()

  for (const incident of incidents) {
    if (!shouldClusterIncidentByTime(incident)) continue
    const key = incidentClusterBucketKey(incident)
    const list = buckets.get(key) ?? []
    list.push(incident)
    buckets.set(key, list)
  }

  for (const [, group] of buckets) {
    group.sort((a, b) => (a.reportedAtEs ?? 0) - (b.reportedAtEs ?? 0))

    let clusterIdx = 0
    for (let i = 0; i < group.length; i++) {
      const cur = group[i]!
      if (i === 0) {
        clusterIdx = 1
      } else {
        const prev = group[i - 1]!
        const gap = (cur.reportedAtEs ?? 0) - (prev.reportedAtEs ?? 0)
        if (gap > gapMs) clusterIdx += 1
      }

      const safe = incidentClusterBucketKey(cur)
        .replace(/\t/g, ':')
        .replace(/[^a-zA-Z0-9:._-]/g, '_')
      cur.incidentKey = `tc:${safe}:c${clusterIdx}`
    }
  }
}
