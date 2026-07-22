/** Tajik mobile without +992: 9 digits, display as ### ##-##-## */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function normalizePhone(value: string): string {
  return digitsOnly(value).slice(0, 9)
}

export function isValidPhone(value: string): boolean {
  return /^\d{9}$/.test(normalizePhone(value))
}

export function formatPhone(value: string): string {
  const digits = normalizePhone(value)
  const a = digits.slice(0, 3)
  const b = digits.slice(3, 5)
  const c = digits.slice(5, 7)
  const d = digits.slice(7, 9)

  if (digits.length <= 3) return a
  if (digits.length <= 5) return `${a} ${b}`
  if (digits.length <= 7) return `${a} ${b}-${c}`
  return `${a} ${b}-${c}-${d}`
}
