import { useEffect } from 'react'
import {
  resolveTheme,
  type ThemePreference,
} from './interfacePreferences'

export function useInterfaceTheme(
  preference: ThemePreference,
): void {
  useEffect(() => {
    const mediaQuery = window.matchMedia(
      '(prefers-color-scheme: dark)',
    )
    const root = document.documentElement

    function applyTheme(): void {
      const resolvedTheme = resolveTheme(
        preference,
        mediaQuery.matches,
      )

      root.dataset.theme = resolvedTheme
      root.dataset.themePreference =
        preference.toLocaleLowerCase()
      root.style.colorScheme = resolvedTheme
    }

    applyTheme()

    if (preference !== 'SYSTEM') {
      return
    }

    mediaQuery.addEventListener('change', applyTheme)

    return () => {
      mediaQuery.removeEventListener('change', applyTheme)
    }
  }, [preference])
}
