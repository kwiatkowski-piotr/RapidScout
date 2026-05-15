import { DateTime } from 'luxon'

export function formatTimestamp(timestamp: number): string {
  const dateTime = DateTime.fromMillis(timestamp)
  return (
    dateTime.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS, {
      locale: 'pl',
    }) + `.${dateTime.get('millisecond')}`
  )
}
