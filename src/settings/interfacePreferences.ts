export type ThemePreference = 'SYSTEM' | 'LIGHT' | 'DARK'

export interface OptionalPanelPreferences {
  readonly examples: boolean
  readonly exploration: boolean
  readonly diagnostics: boolean
  readonly microoperations: boolean
}

export interface InterfacePreferences {
  readonly version: 1
  readonly theme: ThemePreference
  readonly panels: OptionalPanelPreferences
}

interface PreferenceStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const INTERFACE_PREFERENCES_STORAGE_KEY =
  'concurrent-visualizer.interface-preferences'

export function createDefaultInterfacePreferences(): InterfacePreferences {
  return {
    version: 1,
    theme: 'SYSTEM',
    panels: {
      examples: true,
      exploration: true,
      diagnostics: true,
      microoperations: true,
    },
  }
}

export function loadInterfacePreferences(
  storage: PreferenceStorage,
): InterfacePreferences {
  const defaults = createDefaultInterfacePreferences()

  try {
    const serialized = storage.getItem(
      INTERFACE_PREFERENCES_STORAGE_KEY,
    )

    if (!serialized) {
      return defaults
    }

    const parsed: unknown = JSON.parse(serialized)

    if (!isRecord(parsed) || parsed.version !== 1) {
      return defaults
    }

    const panels = isRecord(parsed.panels)
      ? parsed.panels
      : {}

    return {
      version: 1,
      theme: isThemePreference(parsed.theme)
        ? parsed.theme
        : defaults.theme,
      panels: {
        examples: booleanOrDefault(
          panels.examples,
          defaults.panels.examples,
        ),
        exploration: booleanOrDefault(
          panels.exploration,
          defaults.panels.exploration,
        ),
        diagnostics: booleanOrDefault(
          panels.diagnostics,
          defaults.panels.diagnostics,
        ),
        microoperations: booleanOrDefault(
          panels.microoperations,
          defaults.panels.microoperations,
        ),
      },
    }
  } catch {
    return defaults
  }
}

export function saveInterfacePreferences(
  storage: PreferenceStorage,
  preferences: InterfacePreferences,
): boolean {
  try {
    storage.setItem(
      INTERFACE_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    )
    return true
  } catch {
    return false
  }
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): 'light' | 'dark' {
  if (preference === 'SYSTEM') {
    return systemPrefersDark ? 'dark' : 'light'
  }

  return preference === 'DARK' ? 'dark' : 'light'
}

function booleanOrDefault(
  value: unknown,
  fallback: boolean,
): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function isThemePreference(
  value: unknown,
): value is ThemePreference {
  return value === 'SYSTEM'
    || value === 'LIGHT'
    || value === 'DARK'
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
}
