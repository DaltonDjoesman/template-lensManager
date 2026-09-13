export const THEME_STORAGE_KEY = 'lens-manager-theme'

/** Hex of `--bg` for browser/PWA chrome. Keep in sync with `src/index.css`. */
export const THEME_BG_HEX = {
  light: '#F7F2EA',
  dark: '#1D1710',
} as const

export type ThemePreference = 'system' | 'light' | 'dark'

const VALID: ReadonlySet<string> = new Set(['system', 'light', 'dark'])

export function getThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    if (value && VALID.has(value)) return value as ThemePreference
  } catch {
    /* ignore quota / private mode */
  }
  return 'system'
}

export function resolveAppearance(
  preference: ThemePreference = getThemePreference(),
): 'light' | 'dark' {
  if (preference === 'light' || preference === 'dark') return preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function syncThemeColorMeta(appearance: 'light' | 'dark'): void {
  const metas = document.querySelectorAll('meta[name="theme-color"]')
  metas.forEach((meta) => {
    const media = meta.getAttribute('media')
    if (!media) {
      meta.setAttribute('content', THEME_BG_HEX[appearance])
      return
    }
    if (media.includes('prefers-color-scheme: dark')) {
      meta.setAttribute('content', THEME_BG_HEX.dark)
    } else if (media.includes('prefers-color-scheme: light')) {
      meta.setAttribute('content', THEME_BG_HEX.light)
    }
  })
}

export function applyThemePreference(
  preference: ThemePreference = getThemePreference(),
): void {
  const root = document.documentElement
  if (preference === 'light' || preference === 'dark') {
    root.setAttribute('data-theme', preference)
    root.style.colorScheme = preference
  } else {
    root.removeAttribute('data-theme')
    root.style.colorScheme = ''
  }
  syncThemeColorMeta(resolveAppearance(preference))
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    /* ignore quota / private mode */
  }
  applyThemePreference(preference)
}

/** Keep appearance in sync across tabs and when OS scheme changes in system mode. */
export function initThemeListeners(): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onSchemeChange = () => {
    if (getThemePreference() === 'system') applyThemePreference('system')
  }
  media.addEventListener('change', onSchemeChange)

  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      applyThemePreference(getThemePreference())
    }
  }
  window.addEventListener('storage', onStorage)

  return () => {
    media.removeEventListener('change', onSchemeChange)
    window.removeEventListener('storage', onStorage)
  }
}
