export const THEME_STORAGE_KEY = 'lens-manager-theme'

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
