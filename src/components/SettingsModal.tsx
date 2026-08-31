import { useEffect, useRef } from 'react'
import type {
  InterfacePreferences,
  OptionalPanelPreferences,
  ThemePreference,
} from '../settings/interfacePreferences'

interface SettingsModalProps {
  readonly preferences: InterfacePreferences
  readonly onChange: (preferences: InterfacePreferences) => void
  readonly onReset: () => void
  readonly onClose: () => void
}

const themeOptions: ReadonlyArray<{
  readonly value: ThemePreference
  readonly label: string
}> = [
  { value: 'SYSTEM', label: 'System' },
  { value: 'LIGHT', label: 'Light' },
  { value: 'DARK', label: 'Dark' },
]

const panelOptions: ReadonlyArray<{
  readonly key: keyof OptionalPanelPreferences
  readonly label: string
  readonly description: string
}> = [
  {
    key: 'examples',
    label: 'Educational examples',
    description: 'Show the catalogue above the source editor.',
  },
  {
    key: 'exploration',
    label: 'BFS explorer',
    description: 'Show bounded interleaving exploration controls.',
  },
  {
    key: 'diagnostics',
    label: 'Execution diagnostics',
    description: 'Show observations derived from the current trace.',
  },
  {
    key: 'microoperations',
    label: 'Micro-operations',
    description: 'Offer the detailed read, compute and write history.',
  },
]

export function SettingsModal({
  preferences,
  onChange,
  onReset,
  onClose,
}: SettingsModalProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previouslyFocused = document.activeElement
    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) {
        return
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled)',
        ),
      )

      if (focusable.length === 0) {
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey
        && document.activeElement === last
      ) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow

      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus()
      }
    }
  }, [])

  function updateTheme(theme: ThemePreference): void {
    onChange({
      ...preferences,
      theme,
    })
  }

  function updatePanel(
    panel: keyof OptionalPanelPreferences,
    visible: boolean,
  ): void {
    onChange({
      ...preferences,
      panels: {
        ...preferences.panels,
        [panel]: visible,
      },
    })
  }

  return (
    <div
      className="settings-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        ref={dialogRef}
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        aria-describedby="settings-description"
      >
        <header className="settings-dialog-header">
          <div>
            <span className="settings-eyebrow">
              WORKSPACE PREFERENCES
            </span>
            <h2 id="settings-title">Settings</h2>
            <p id="settings-description">
              Adapt the interface without changing the simulation.
            </p>
          </div>

          <button
            ref={closeButtonRef}
            className="settings-close-button"
            type="button"
            aria-label="Close settings"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="settings-section">
          <div className="settings-section-heading">
            <h3>Appearance</h3>
            <p>System follows your device preference.</p>
          </div>

          <fieldset className="theme-selector">
            <legend>Theme</legend>
            {themeOptions.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="theme"
                  value={option.value}
                  checked={preferences.theme === option.value}
                  onChange={() => updateTheme(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
        </div>

        <div className="settings-section">
          <div className="settings-section-heading">
            <h3>Optional panels</h3>
            <p>Hidden panels keep their data and can return anytime.</p>
          </div>

          <div className="settings-switch-list">
            {panelOptions.map((option) => (
              <label
                className="settings-switch-row"
                key={option.key}
              >
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>

                <span className="settings-switch">
                  <input
                    type="checkbox"
                    checked={preferences.panels[option.key]}
                    onChange={(event) => updatePanel(
                      option.key,
                      event.target.checked,
                    )}
                  />
                  <span aria-hidden="true" />
                </span>
              </label>
            ))}
          </div>
        </div>

        <footer className="settings-dialog-footer">
          <button
            className="settings-reset-button"
            type="button"
            onClick={onReset}
          >
            Restore defaults
          </button>
          <button
            className="settings-done-button"
            type="button"
            onClick={onClose}
          >
            Done
          </button>
        </footer>
      </section>
    </div>
  )
}
