/** Portuguese postal code: 4 digits, hyphen, 3 digits (e.g. 2400-123). */
export function formatPostalCode(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 7)
  if (digits.length <= 4) return digits
  return `${digits.slice(0, 4)}-${digits.slice(4)}`
}

/** ISO `YYYY-MM-DD` → display `DD/MM/YYYY`. */
export function isoDateToPt(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Mask digits into `DD/MM/YYYY` while typing. */
export function formatPtDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

/** Parse complete `DD/MM/YYYY` (or digits) to ISO `YYYY-MM-DD`, or '' if incomplete/invalid. */
export function ptDateToIso(pt: string): string {
  const digits = pt.replace(/\D/g, '')
  if (digits.length !== 8) return ''
  const day = Number(digits.slice(0, 2))
  const month = Number(digits.slice(2, 4))
  const year = Number(digits.slice(4, 8))
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return ''
  }
  const dt = new Date(year, month - 1, day)
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return ''
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
