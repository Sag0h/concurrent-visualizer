import { describe, expect, it } from 'vitest'
import {
  createDefaultInterfacePreferences,
  INTERFACE_PREFERENCES_STORAGE_KEY,
  loadInterfacePreferences,
  resolveTheme,
  saveInterfacePreferences,
} from '../interfacePreferences'

describe('interface preferences', () => {
  it('loads defaults when no preferences are stored', () => {
    expect(loadInterfacePreferences(createStorage())).toEqual(
      createDefaultInterfacePreferences(),
    )
  })

  it('loads valid fields and defaults missing panel options', () => {
    const storage = createStorage({
      [INTERFACE_PREFERENCES_STORAGE_KEY]: JSON.stringify({
        version: 1,
        theme: 'DARK',
        panels: {
          examples: false,
          exploration: false,
        },
      }),
    })

    expect(loadInterfacePreferences(storage)).toEqual({
      version: 1,
      theme: 'DARK',
      panels: {
        examples: false,
        exploration: false,
        diagnostics: true,
        microoperations: true,
      },
    })
  })

  it('recovers safely from invalid JSON and unsupported versions', () => {
    const invalidJson = createStorage({
      [INTERFACE_PREFERENCES_STORAGE_KEY]: '{invalid',
    })
    const unsupportedVersion = createStorage({
      [INTERFACE_PREFERENCES_STORAGE_KEY]: JSON.stringify({
        version: 99,
        theme: 'DARK',
      }),
    })

    expect(loadInterfacePreferences(invalidJson)).toEqual(
      createDefaultInterfacePreferences(),
    )
    expect(loadInterfacePreferences(unsupportedVersion)).toEqual(
      createDefaultInterfacePreferences(),
    )
  })

  it('saves preferences and reports unavailable storage', () => {
    const storage = createStorage()
    const preferences = {
      ...createDefaultInterfacePreferences(),
      theme: 'LIGHT' as const,
    }

    expect(saveInterfacePreferences(storage, preferences)).toBe(true)
    expect(loadInterfacePreferences(storage)).toEqual(preferences)

    expect(saveInterfacePreferences({
      getItem: () => null,
      setItem: () => {
        throw new Error('Storage unavailable')
      },
    }, preferences)).toBe(false)
  })

  it('resolves explicit and system themes', () => {
    expect(resolveTheme('SYSTEM', true)).toBe('dark')
    expect(resolveTheme('SYSTEM', false)).toBe('light')
    expect(resolveTheme('LIGHT', true)).toBe('light')
    expect(resolveTheme('DARK', false)).toBe('dark')
  })
})

function createStorage(
  initialValues: Record<string, string> = {},
) {
  const values = new Map(Object.entries(initialValues))

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}
