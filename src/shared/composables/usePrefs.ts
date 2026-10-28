// App-wide display preferences (language + theme), shared by every feature
// view. Module-level refs: both views see the same values, and switching
// routes never resets them.
import { ref } from 'vue'
import { initialLang, LANGS, t as tx, type Lang } from '../i18n'
import { applyTheme, initialTheme, MOON_ICON, SUN_ICON, type Theme } from '../lib/theme'

const lang = ref<Lang>(initialLang())
const theme = ref<Theme>(initialTheme())

function setLang(l: Lang) {
  lang.value = l
  document.documentElement.lang = l
  document.documentElement.dataset.lang = l
  try { localStorage.setItem('ic-lang', l) } catch { /* ignore */ }
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  applyTheme(theme.value)
}

/** Translate with the shared dictionary in the current language. */
function t(key: string, ...args: (string | number)[]): string {
  return tx(lang.value, key, ...args)
}

export function usePrefs() {
  return { lang, theme, setLang, toggleTheme, t, LANGS, SUN_ICON, MOON_ICON, applyTheme }
}
