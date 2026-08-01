export function useFormatters(locale = 'ru-RU') {
  function formatPrice(n: number) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'TJS',
      maximumFractionDigits: 0,
    }).format(n)
  }

  function formatWeight(n: number, unit = 'кг') {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n)} ${unit}`
  }

  function formatNumber(n: number, digits = 0) {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n)
  }

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  return {
    formatPrice,
    formatWeight,
    formatNumber,
    formatDateTime,
    formatDate,
  }
}
