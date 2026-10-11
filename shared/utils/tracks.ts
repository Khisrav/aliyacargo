/** Handover scanning. Flip to true when the warehouse starts requiring track codes. */
export const tracksEnabled = false

export const MAX_TRACK_CODE_LENGTH = 120

/** Scanner text, with control characters (including Enter) removed. */
export function normalizeTrackCode(raw: string): string | null {
  const code = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim()
  if (!code || code.length > MAX_TRACK_CODE_LENGTH) return null
  return code
}

export function collectTrackCodes(raw: unknown):
  | { ok: true, codes: string[] }
  | { ok: false, reason: 'invalid' | 'long' } {
  if (!Array.isArray(raw)) return { ok: false, reason: 'invalid' }

  const codes: string[] = []
  const seen = new Set<string>()

  for (const item of raw) {
    if (typeof item !== 'string') return { ok: false, reason: 'invalid' }
    const stripped = item.replace(/[\u0000-\u001F\u007F]/g, '').trim()
    if (!stripped) continue
    if (stripped.length > MAX_TRACK_CODE_LENGTH) return { ok: false, reason: 'long' }
    if (seen.has(stripped)) continue
    seen.add(stripped)
    codes.push(stripped)
  }

  return { ok: true, codes }
}

export function trackCountLabel(count: number): string {
  const n10 = count % 10
  const n100 = count % 100
  const word = n10 === 1 && n100 !== 11
    ? 'трек'
    : n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)
      ? 'трека'
      : 'треков'
  return `${count} ${word}`
}
