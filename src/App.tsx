import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import './App.css'
import { createExecutionState } from './core/engine/createExecutionState'
import { SimulationEngine } from './core/engine/SimulationEngine'
import type { SimulationSnapshot } from './core/engine/SimulationSnapshot'
import { parseProgram } from './core/language/parseProgram'
import {
  isPriorityQueueValue,
  isQueueValue,
  isStackValue,
  isRecordValue,
  type RuntimeValue,
} from './core/memory/RuntimeValue'
import { createScheduler } from './core/scheduler/createScheduler'
import type { SchedulerType } from './core/scheduler/SchedulerType'
import { formatExpression } from './core/expressions/formatExpression'
import type { MemoryAccessConflict } from './core/engine/MemoryAccessConflict'
import { exploreForDeadlock } from './core/exploration/exploreForDeadlock'
import { replayDeadlockCounterexample } from './core/exploration/replayDeadlockCounterexample'
import type {
  DeadlockExplorationResult,
  ExplorationLimits,
} from './core/exploration/DeadlockExplorationResult'
import { exploreForMutualExclusionViolation } from './core/exploration/exploreForMutualExclusionViolation'
import { replayMutualExclusionViolationCounterexample } from './core/exploration/replayMutualExclusionViolationCounterexample'
import type { MutualExclusionViolationExplorationResult } from './core/exploration/MutualExclusionViolationExplorationResult'
import {
  ExplorationPanel,
  type ExplorationTarget,
} from './components/ExplorationPanel'
import { ExamplePicker } from './components/ExamplePicker'
import { PlaybackControls } from './components/PlaybackControls'
import { ExecutionFocusPanel } from './components/ExecutionFocusPanel'
import { CodeEditor } from './components/CodeEditor'
import { SettingsModal } from './components/SettingsModal'
import {
  createDefaultInterfacePreferences,
  loadInterfacePreferences,
  saveInterfacePreferences,
} from './settings/interfacePreferences'
import { useInterfaceTheme } from './settings/useInterfaceTheme'
import {
  findProgramExample,
  programExamples,
} from './examples/programExamples'
import {
  advancePlayback,
  playbackIntervalMs,
  type PlaybackSpeed,
} from './playback/playback'

const initialCode = `shared int counter = 0;
shared string message = "Concurrent Visualizer";

process P1 {
    int value = 10;
    value = value + 1;
    counter = counter + 1;
}

process P2 {
    int value = 20;
    value = value + 5;
    counter = counter + 1;
}`

type ExplorationSession =
  | {
      readonly target: 'DEADLOCK'
      readonly originEngine: SimulationEngine
      readonly result: DeadlockExplorationResult
    }
  | {
      readonly target:
        'MUTUAL_EXCLUSION_VIOLATION'
      readonly originEngine: SimulationEngine
      readonly result:
        MutualExclusionViolationExplorationResult
    }

type MobileWorkspaceTab =
  | 'CODE'
  | 'STATE'
  | 'PROCESSES'
  | 'HISTORY'

const mobileWorkspaceTabs: ReadonlyArray<{
  readonly id: MobileWorkspaceTab
  readonly label: string
}> = [
  { id: 'CODE', label: 'Code' },
  { id: 'STATE', label: 'State' },
  { id: 'PROCESSES', label: 'Processes' },
  { id: 'HISTORY', label: 'History' },
]

const mobileWorkspaceMediaQuery = '(max-width: 600px)'

function matchesMobileWorkspace(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(mobileWorkspaceMediaQuery).matches
}

function App() {
  const [code, setCode] = useState(initialCode)

  const [interfacePreferences, setInterfacePreferences] =
    useState(loadInitialInterfacePreferences)

  const [isSettingsOpen, setIsSettingsOpen] =
    useState(false)

  const [mobileWorkspaceTab, setMobileWorkspaceTab] =
    useState<MobileWorkspaceTab>('CODE')

  const [isMobileExamplesOpen, setIsMobileExamplesOpen] =
    useState(false)

  const [isMobileWorkspace, setIsMobileWorkspace] =
    useState(matchesMobileWorkspace)

  const [selectedExampleId, setSelectedExampleId] =
    useState('')

  const [pendingExampleId, setPendingExampleId] =
    useState<string | null>(null)

  const [hasUserEditedCode, setHasUserEditedCode] =
    useState(false)

  const [schedulerType, setSchedulerType] =
    useState<SchedulerType>('ROUND_ROBIN')

  const [useRandomSeed, setUseRandomSeed] = 
    useState(false)

  const [randomSeed, setRandomSeed] = 
    useState(42)

  const [activeSeed, setActiveSeed] =
    useState(42)

  const [engine, setEngine] =
    useState<SimulationEngine | null>(null)

  const [snapshot, setSnapshot] =
    useState<SimulationSnapshot | null>(null)

  const [isPlaying, setIsPlaying] =
    useState(false)

  const [playbackSpeed, setPlaybackSpeed] =
    useState<PlaybackSpeed>(1)

  const [error, setError] =
    useState<string | null>(null)

  const [isDirty, setIsDirty] = 
    useState(true)

  const [explorationLimits, setExplorationLimits] =
    useState<ExplorationLimits>({
      maxDepth: 30,
      maxStates: 1000,
    })

  const [explorationTarget, setExplorationTarget] =
    useState<ExplorationTarget>('DEADLOCK')

  const [explorationSession, setExplorationSession] =
    useState<ExplorationSession | null>(null)

  const [replayChoiceIndex, setReplayChoiceIndex] =
    useState<number | null>(null)

  const [historyMode, setHistoryMode] =
    useState<'instructions' | 'microoperations'>(
      'instructions',
    )

  const displayedHistoryMode =
    interfacePreferences.panels.microoperations
      ? historyMode
      : 'instructions'

  const historyRef =
    useRef<HTMLDivElement>(null)

  useInterfaceTheme(interfacePreferences.theme)

  useEffect(() => {
    try {
      saveInterfacePreferences(
        window.localStorage,
        interfacePreferences,
      )
    } catch {
      // The app remains usable when storage is unavailable.
    }
  }, [interfacePreferences])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia(
      mobileWorkspaceMediaQuery,
    )
    const handleChange = () => setIsMobileWorkspace(
      mediaQuery.matches,
    )

    handleChange()
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener(
      'change',
      handleChange,
    )
  }, [])

  useEffect(() => {
    if (!isPlaying || !engine) {
      return
    }

    const intervalId = window.setInterval(() => {
      try {
        const result = advancePlayback(engine)

        setSnapshot(result.snapshot)
        setError(null)

        if (!result.shouldContinue) {
          setIsPlaying(false)
        }
      } catch (playbackError) {
        setError(errorMessage(
          playbackError,
          'Unknown playback error',
        ))
        setSnapshot(engine.getSnapshot())
        setIsPlaying(false)
      }
    }, playbackIntervalMs(playbackSpeed))

    return () => window.clearInterval(intervalId)
  }, [engine, isPlaying, playbackSpeed])

  useEffect(() => {
    const history = historyRef.current

    if (!history) {
      return
    }

    history.scrollTop = history.scrollHeight
  }, [displayedHistoryMode, snapshot?.stepCount])

  function handleBuild() {
    setIsPlaying(false)

    try {
        const program = parseProgram(code)

        const seed =
          schedulerType === 'RANDOM'
          && useRandomSeed
            ? generateRandomSeed()
            : randomSeed

        const newEngine = new SimulationEngine(
          createExecutionState(program),
          createScheduler(
            schedulerType,
            seed,
          ),
        )

        setActiveSeed(seed)
        setEngine(newEngine)
        setSnapshot(newEngine.getSnapshot())
        setError(null)
        setIsDirty(false)
        setExplorationSession(null)
        setReplayChoiceIndex(null)

    } catch (buildError) {
      setEngine(null)
      setSnapshot(null)
      setExplorationSession(null)
      setReplayChoiceIndex(null)

      if (buildError instanceof Error) {
        setError(buildError.message)
      } else {
        setError('Unknown build error')
      }
    }
  }

  function invalidateBuild() {
    setIsPlaying(false)
    setEngine(null)
    setSnapshot(null)
    setIsDirty(true)
    setExplorationSession(null)
    setReplayChoiceIndex(null)
  }

  function handleAddProcess() {
    const processNumbers = Array.from(
      code.matchAll(/\bprocess\s+P(\d+)\b/g),
      (match) => Number(match[1]),
    )

    const nextNumber =
      processNumbers.length === 0
        ? 1
        : Math.max(...processNumbers) + 1

    const newProcess =
      `process P${nextNumber} {\n\n}`

    setCode((currentCode) => {
      const cleanCode = currentCode.trimEnd()

      return `${cleanCode}\n\n${newProcess}`
    })

    setHasUserEditedCode(true)
    setPendingExampleId(null)

    invalidateBuild()
  }

  function applySelectedExample(exampleId: string) {
    const example = findProgramExample(exampleId)

    if (!example) {
      return
    }

    setCode(example.source)
    setSchedulerType(example.recommendedScheduler)
    setSelectedExampleId(example.id)
    setPendingExampleId(null)
    setHasUserEditedCode(false)
    setIsMobileExamplesOpen(false)
    invalidateBuild()
  }

  function handleRequestExampleLoad() {
    if (!selectedExampleId) {
      return
    }

    if (hasUserEditedCode) {
      setPendingExampleId(selectedExampleId)
      return
    }

    applySelectedExample(selectedExampleId)
  }

  function handleStep() {
    if (!engine) {
      return
    }

    setIsPlaying(false)

    try {
      engine.step()

      setError(null)

      setSnapshot(
        engine.getSnapshot(),
      )
    } catch (runtimeError) {
      if (runtimeError instanceof Error) {
        setError(runtimeError.message)
      } else {
        setError(
          'Unknown runtime error',
        )
      }

      setSnapshot(
        engine.getSnapshot(),
      )
    }
  }

  function handleStepBack() {
    if (
      !engine
      || replayChoiceIndex !== null
    ) {
      return
    }

    setIsPlaying(false)

    try {
      engine.stepBack()
      setSnapshot(engine.getSnapshot())
      setError(null)
    } catch (rewindError) {
      setError(errorMessage(
        rewindError,
        'Unknown rewind error',
      ))
      setSnapshot(engine.getSnapshot())
    }
  }

  function handleReset() {
    if (!engine) {
      return
    }

    setIsPlaying(false)

    if (
      replayChoiceIndex !== null
      && explorationSession
    ) {
      const replayEngine =
        explorationSession.originEngine.fork()

      setEngine(replayEngine)
      setSnapshot(replayEngine.getSnapshot())
      setReplayChoiceIndex(0)
      setError(null)

      return
    }

    if (
      schedulerType === 'RANDOM'
      && useRandomSeed
    ) {
      try {
        const program = parseProgram(code)
        const newSeed = generateRandomSeed()

        const newEngine = new SimulationEngine(
          createExecutionState(program),
          createScheduler(
            schedulerType,
            newSeed,
          ),
        )

        setActiveSeed(newSeed)
        setEngine(newEngine)
        setSnapshot(
          newEngine.getSnapshot(),
        )

        return
      } catch (resetError) {
        if (resetError instanceof Error) {
          setError(resetError.message)
        }

        return
      }
    }

    engine.reset()
    setSnapshot(engine.getSnapshot())
  }

  function handleRun() {
    if (!engine) {
      return
    }

    setIsPlaying(false)

    try {
      while (
        !engine.isFinished()
        && !engine.hasReachedStepLimit()
      ) {
        const progressed = engine.step()

        if (!progressed) {
          break
        }
      }

      setSnapshot(
        engine.getSnapshot(),
      )

      setError(null)
    } catch (runtimeError) {
      if (runtimeError instanceof Error) {
        setError(runtimeError.message)
      } else {
        setError('Unknown runtime error')
      }

      setSnapshot(
        engine.getSnapshot(),
      )
    }
  }

  function handleExplore() {
    if (!engine) {
      return
    }

    setIsPlaying(false)

    try {
      const originEngine = engine.fork()
      if (explorationTarget === 'DEADLOCK') {
        setExplorationSession({
          target: 'DEADLOCK',
          originEngine,
          result: exploreForDeadlock(
            originEngine,
            explorationLimits,
          ),
        })
      } else {
        setExplorationSession({
          target:
            'MUTUAL_EXCLUSION_VIOLATION',
          originEngine,
          result:
            exploreForMutualExclusionViolation(
              originEngine,
              explorationLimits,
            ),
        })
      }
      setReplayChoiceIndex(null)
      setError(null)
    } catch (explorationError) {
      setError(errorMessage(
        explorationError,
        'Unknown exploration error',
      ))
    }
  }

  function handleStartCounterexampleReplay() {
    const counterexample =
      explorationSession?.result.counterexample

    if (!explorationSession || !counterexample) {
      return
    }

    setIsPlaying(false)

    const replayEngine =
      explorationSession.originEngine.fork()

    setEngine(replayEngine)
    setSnapshot(replayEngine.getSnapshot())
    setReplayChoiceIndex(0)
    setError(null)
  }

  function handleReplayNextChoice() {
    const counterexample =
      explorationSession?.result.counterexample

    if (
      !engine
      || !counterexample
      || replayChoiceIndex === null
      || replayChoiceIndex
        >= counterexample.processChoices.length
    ) {
      return
    }

    setIsPlaying(false)

    try {
      const processId =
        counterexample.processChoices[replayChoiceIndex]
      const transition = engine
        .getEnabledTransitions()
        .find(
          (candidate) =>
            candidate.processId === processId,
        )

      if (!transition) {
        throw new Error(
          `Recorded process "${processId}" is not enabled`,
        )
      }

      engine.stepTransition(transition)
      setReplayChoiceIndex(replayChoiceIndex + 1)
      setSnapshot(engine.getSnapshot())
      setError(null)
    } catch (replayError) {
      setError(errorMessage(
        replayError,
        'Unknown replay error',
      ))
    }
  }

  function handleReplayAllChoices() {
    if (!explorationSession) {
      return
    }

    setIsPlaying(false)

    try {
      let replayEngine: SimulationEngine
      let choiceCount: number

      if (explorationSession.target === 'DEADLOCK') {
        const counterexample =
          explorationSession.result.counterexample

        if (!counterexample) {
          return
        }

        replayEngine = replayDeadlockCounterexample(
          explorationSession.originEngine,
          counterexample,
        )
        choiceCount =
          counterexample.processChoices.length
      } else {
        const counterexample =
          explorationSession.result.counterexample

        if (!counterexample) {
          return
        }

        replayEngine =
          replayMutualExclusionViolationCounterexample(
            explorationSession.originEngine,
            counterexample,
          )
        choiceCount =
          counterexample.processChoices.length
      }

      setEngine(replayEngine)
      setSnapshot(replayEngine.getSnapshot())
      setReplayChoiceIndex(choiceCount)
      setError(null)
    } catch (replayError) {
      setError(errorMessage(
        replayError,
        'Unknown replay error',
      ))
    }
  }

  function handleExitCounterexampleReplay() {
    if (!explorationSession) {
      return
    }

    setIsPlaying(false)

    const originEngine =
      explorationSession.originEngine.fork()

    setEngine(originEngine)
    setSnapshot(originEngine.getSnapshot())
    setReplayChoiceIndex(null)
    setError(null)
  }

  function handleExplorationTargetChange(
    target: ExplorationTarget,
  ) {
    setExplorationTarget(target)
    setExplorationSession(null)
    setReplayChoiceIndex(null)
  }

  function handleReplayDeadlock() {
    if (!engine || !snapshot?.deadlock) {
      return
    }

    setIsPlaying(false)

    const targetStep =
      snapshot.deadlock.replayTargetStep

    engine.reset()

    while (
      engine.getState().stepCount < targetStep
      && !engine.isFinished()
      && !engine.hasReachedStepLimit()
    ) {
      const progressed = engine.step()

      if (!progressed) {
        break
      }
    }

    setSnapshot(engine.getSnapshot())
    setError(null)
  }

  function generateRandomSeed(): number {
    return Math.floor(
      Math.random() * 2_147_483_647,
    )
  }

  const handleEditorKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    const textarea = event.currentTarget
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const indentation = '    '

    function updateEditor(
      newCode: string,
      newSelectionStart: number,
      newSelectionEnd: number,
    ) {
      setCode(newCode)
      setHasUserEditedCode(true)
      setPendingExampleId(null)
      invalidateBuild()

      requestAnimationFrame(() => {
        textarea.selectionStart = newSelectionStart
        textarea.selectionEnd = newSelectionEnd
      })
    }

    if (event.key === 'Tab') {
      event.preventDefault()

      const hasSelection = start !== end

      const lineStart =
        code.lastIndexOf('\n', start - 1) + 1

      if (event.shiftKey) {
        if (!hasSelection) {
          const line = code.slice(
            lineStart,
            code.indexOf('\n', lineStart) === -1
              ? code.length
              : code.indexOf('\n', lineStart),
          )

          const spacesToRemove =
            Math.min(
              indentation.length,
              line.length - line.trimStart().length,
            )

          if (spacesToRemove === 0) {
            return
          }

          const newCode =
            code.slice(0, lineStart) +
            code.slice(lineStart + spacesToRemove)

          const newCursor =
            Math.max(
              lineStart,
              start - spacesToRemove,
            )

          updateEditor(
            newCode,
            newCursor,
            newCursor,
          )

          return
        }

        const selectedStart =
          code.lastIndexOf('\n', start - 1) + 1

        const nextNewLine =
          code.indexOf('\n', end)

        const selectedEnd =
          nextNewLine === -1
            ? code.length
            : nextNewLine

        const selectedText =
          code.slice(selectedStart, selectedEnd)

        const lines = selectedText.split('\n')

        let removedFromFirstLine = 0
        let totalRemoved = 0

        const unindentedLines =
          lines.map((line, index) => {
            const spacesToRemove =
              Math.min(
                indentation.length,
                line.length - line.trimStart().length,
              )

            if (index === 0) {
              removedFromFirstLine = spacesToRemove
            }

            totalRemoved += spacesToRemove

            return line.slice(spacesToRemove)
          })

        const replacement =
          unindentedLines.join('\n')

        const newCode =
          code.slice(0, selectedStart) +
          replacement +
          code.slice(selectedEnd)

        const newStart =
          Math.max(
            selectedStart,
            start - removedFromFirstLine,
          )

        const newEnd =
          Math.max(
            newStart,
            end - totalRemoved,
          )

        updateEditor(
          newCode,
          newStart,
          newEnd,
        )

        return
      }

      if (hasSelection) {
        const selectedStart =
          code.lastIndexOf('\n', start - 1) + 1

        const nextNewLine =
          code.indexOf('\n', end)

        const selectedEnd =
          nextNewLine === -1
            ? code.length
            : nextNewLine

        const selectedText =
          code.slice(selectedStart, selectedEnd)

        const lines =
          selectedText.split('\n')

        const indentedText =
          lines
            .map((line) => indentation + line)
            .join('\n')

        const newCode =
          code.slice(0, selectedStart) +
          indentedText +
          code.slice(selectedEnd)

        const newStart =
          start + indentation.length

        const newEnd =
          end + indentation.length * lines.length

        updateEditor(
          newCode,
          newStart,
          newEnd,
        )

        return
      }

      const newCode =
        code.slice(0, start) +
        indentation +
        code.slice(end)

      updateEditor(
        newCode,
        start + indentation.length,
        start + indentation.length,
      )

      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()

      const lineStart =
        code.lastIndexOf('\n', start - 1) + 1

      const currentLine =
        code.slice(lineStart, start)

      const currentIndentation =
        currentLine.match(/^\s*/)?.[0] ?? ''

      const beforeCursor =
        code.slice(0, start)

      const afterCursor =
        code.slice(end)

      const trimmedBeforeCursor =
        currentLine.trimEnd()

      const shouldIndent =
        trimmedBeforeCursor.endsWith('{')

      const isBetweenBraces =
        shouldIndent &&
        afterCursor.startsWith('}')

      if (isBetweenBraces) {
        const insertion =
          '\n' +
          currentIndentation +
          indentation +
          '\n' +
          currentIndentation

        const newCode =
          beforeCursor +
          insertion +
          afterCursor

        const newCursor =
          start +
          1 +
          currentIndentation.length +
          indentation.length

        updateEditor(
          newCode,
          newCursor,
          newCursor,
        )

        return
      }

      const nextIndentation =
        shouldIndent
          ? currentIndentation + indentation
          : currentIndentation

      const insertion =
        '\n' + nextIndentation

      const newCode =
        beforeCursor +
        insertion +
        afterCursor

      const newCursor =
        start + insertion.length

      updateEditor(
        newCode,
        newCursor,
        newCursor,
      )
    }
  }

  const potentialRaces =
    snapshot?.memoryAccessConflicts.filter(
      (conflict) =>
        conflict.classification === 'POTENTIAL_RACE',
    ) ?? []

  const synchronizedConflicts =
    snapshot?.memoryAccessConflicts.filter(
      (conflict) =>
        conflict.classification === 'SYNCHRONIZED',
    ) ?? []

  const mutualExclusionViolations =
    potentialRaces.filter(
      (conflict) =>
        conflict.diagnostic
          === 'MUTUAL_EXCLUSION_VIOLATION',
    )

  const unknownConflicts =
    snapshot?.memoryAccessConflicts.filter(
      (conflict) =>
        conflict.classification === 'UNKNOWN',
    ) ?? []

  const conflictsNeedingAttention = [
    ...potentialRaces,
    ...unknownConflicts,
  ]

  const programStatus =
    snapshot?.executionStatus ?? 'RUNNING'

  function handleMobileWorkspaceTabKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    tab: MobileWorkspaceTab,
  ) {
    const currentIndex = mobileWorkspaceTabs.findIndex(
      (candidate) => candidate.id === tab,
    )
    let nextIndex: number | null = null

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % mobileWorkspaceTabs.length
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (
        currentIndex - 1 + mobileWorkspaceTabs.length
      ) % mobileWorkspaceTabs.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = mobileWorkspaceTabs.length - 1
    }

    if (nextIndex === null) {
      return
    }

    event.preventDefault()

    const nextTab = mobileWorkspaceTabs[nextIndex]
    const tabList = event.currentTarget.parentElement

    setMobileWorkspaceTab(nextTab.id)

    window.requestAnimationFrame(() => {
      tabList
        ?.querySelector<HTMLButtonElement>(
          `#mobile-workspace-tab-${nextTab.id.toLowerCase()}`,
        )
        ?.focus()
    })
  }

  const canAdvanceSimulation =
    engine !== null
    && replayChoiceIndex === null
    && !engine.isFinished()
    && snapshot?.executionStatus !== 'DEADLOCK'
    && snapshot?.executionStatus
      !== 'STEP_LIMIT_REACHED'

  const activeSourceLine =
    snapshot?.executionFocus?.sourceRange?.start.line

  return (
    <main className="app">
      <header className="header">
        <div>
          <h1>Concurrent Visualizer</h1>
          <p>
            Concurrent programming simulator
          </p>
        </div>

        <button
          className="settings-button"
          type="button"
          aria-label="Settings"
          aria-haspopup="dialog"
          aria-expanded={isSettingsOpen}
          onClick={() => setIsSettingsOpen(true)}
        >
          <span aria-hidden="true">⚙</span>
          <span className="settings-button-label">Settings</span>
        </button>
      </header>

      {isSettingsOpen && (
        <SettingsModal
          preferences={interfacePreferences}
          onChange={setInterfacePreferences}
          onReset={() => setInterfacePreferences(
            createDefaultInterfacePreferences(),
          )}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {isMobileWorkspace && (
        <div
          className="mobile-workspace-tabs"
          role="tablist"
          aria-label="Workspace views"
        >
          {mobileWorkspaceTabs.map((tab) => (
            <button
              id={`mobile-workspace-tab-${tab.id.toLowerCase()}`}
              type="button"
              role="tab"
              aria-controls="mobile-workspace-content"
              aria-selected={mobileWorkspaceTab === tab.id}
              tabIndex={mobileWorkspaceTab === tab.id ? 0 : -1}
              className={
                mobileWorkspaceTab === tab.id
                  ? 'mobile-workspace-tab active'
                  : 'mobile-workspace-tab'
              }
              key={tab.id}
              onClick={() => setMobileWorkspaceTab(tab.id)}
              onKeyDown={(event) =>
                handleMobileWorkspaceTabKeyDown(event, tab.id)
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <section
        id="mobile-workspace-content"
        className="workspace"
        role={isMobileWorkspace ? 'tabpanel' : undefined}
        aria-labelledby={
          isMobileWorkspace
            ? `mobile-workspace-tab-${mobileWorkspaceTab.toLowerCase()}`
            : undefined
        }
        data-mobile-tab={mobileWorkspaceTab.toLowerCase()}
      >
        <div className="editor-panel">
          <div className="editor-scroll-region">
            <div className="panel-header">
            <h2>Program</h2>

            <div className="scheduler-control">
              <label htmlFor="scheduler">
                Scheduler
              </label>

              <select
                id="scheduler"
                value={schedulerType}
                onChange={(event) => {
                  setSchedulerType(
                    event.target.value as SchedulerType,
                  )

                  invalidateBuild()
                }}
              >
                <option value="FIRST_READY">
                  First Ready
                </option>

                <option value="ROUND_ROBIN">
                  Round Robin
                </option>

                <option value="RANDOM">
                  Random
                </option>
              </select>
              {schedulerType === 'RANDOM' && (
                <>
                  <label className="random-seed-toggle">
                    <input
                      type="checkbox"
                      checked={useRandomSeed}
                      onChange={(event) => {
                        setUseRandomSeed(
                          event.target.checked,
                        )

                        invalidateBuild()
                      }}
                    />

                    Random seed
                  </label>
                  <label htmlFor="seed">
                    Seed
                  </label>

                  <input
                    id="seed"
                    className="seed-input"
                    type="number"
                    value={randomSeed}
                    disabled={useRandomSeed}
                    onChange={(event) => {
                      setRandomSeed(
                        Number(event.target.value),
                      )

                      invalidateBuild()
                    }}
                  />
                </>
              )}
            </div>
            </div>

          {interfacePreferences.panels.examples && (
            <>
              <button
                className="mobile-examples-toggle"
                type="button"
                aria-controls="mobile-examples-panel"
                aria-expanded={isMobileExamplesOpen}
                onClick={() => setIsMobileExamplesOpen(
                  (current) => !current,
                )}
              >
                <span>
                  <strong>Educational examples</strong>
                  <small>Browse the catalogue</small>
                </span>
                <span aria-hidden="true">
                  {isMobileExamplesOpen ? '−' : '+'}
                </span>
              </button>

              <div
                id="mobile-examples-panel"
                className={
                  isMobileExamplesOpen
                    ? 'mobile-examples-panel open'
                    : 'mobile-examples-panel'
                }
              >
                <ExamplePicker
                  examples={programExamples}
                  selectedExampleId={selectedExampleId}
                  onSelect={(exampleId) => {
                    setSelectedExampleId(exampleId)
                    setPendingExampleId(null)
                  }}
                  onRequestLoad={handleRequestExampleLoad}
                />

                {pendingExampleId && (
                  <div
                    className="example-replace-warning"
                    role="alert"
                  >
                    <div>
                      <strong>Replace your edited program?</strong>
                      <p>
                        Loading this example will replace the current editor contents.
                        The example will not be built or run automatically.
                      </p>
                    </div>

                    <div className="example-replace-actions">
                      <button
                        type="button"
                        onClick={() =>
                          applySelectedExample(pendingExampleId)
                        }
                      >
                        Replace and load
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingExampleId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

            <CodeEditor
              value={code}
              activeLine={activeSourceLine}
              onChange={(event) => {
                setCode(event.target.value)
                setHasUserEditedCode(true)
                setPendingExampleId(null)
                invalidateBuild()
              }}
              onKeyDown={handleEditorKeyDown}
            />
          </div>

          <div className="editor-controls-dock">
            <div className="controls">
              <div className="control-group">
                <button onClick={handleBuild}>
                  Build
                </button>

                {isDirty && (
                  <span className="build-required">
                    Build required
                  </span>
                )}

                <button onClick={handleAddProcess}>
                  Add Process
                </button>
              </div>

              <div className="control-group">
                <button
                  onClick={handleStepBack}
                  disabled={
                    !engine
                    || replayChoiceIndex !== null
                    || snapshot?.stepCount === 0
                  }
                  title={
                    replayChoiceIndex !== null
                      ? 'Step Back is unavailable during counterexample replay'
                      : 'Reconstruct the previous deterministic step'
                  }
                >
                  Step Back
                </button>

                <button
                  onClick={handleStep}
                  disabled={
                    !canAdvanceSimulation
                    || isPlaying
                  }
                >
                  Step
                </button>

                <button
                  onClick={handleRun}
                  disabled={
                    !canAdvanceSimulation
                    || isPlaying
                  }
                >
                  Run
                </button>

                <button
                  onClick={handleReset}
                  disabled={!engine}
                >
                  Reset
                </button>
              </div>
            </div>

            <PlaybackControls
              isPlaying={isPlaying}
              canPlay={canAdvanceSimulation}
              speed={playbackSpeed}
              executionStatus={snapshot?.executionStatus}
              onToggle={() =>
                setIsPlaying((current) => !current)
              }
              onSpeedChange={setPlaybackSpeed}
            />

            {error && (
              <div className="error-box" role="alert">
                <strong>Error</strong>
                <pre>{error}</pre>
              </div>
            )}
          </div>
        </div>

        <div className="simulation-panel">
          {!engine || !snapshot ? (
            <div className="not-built">
              <h2>Simulation</h2>
              <p>
                Build the program to start
                the simulation.
              </p>
            </div>
          ) : (
            <>
              <section className="status-bar">
                <span>
                  Step:{' '}
                  <strong>
                    {snapshot.stepCount}
                  </strong>
                </span>

                <span>
                  Scheduler:{' '}
                  <strong>
                    {schedulerLabel(
                      schedulerType,
                    )}
                  </strong>
                </span>

                {schedulerType === 'RANDOM' && (
                  <span>
                    Seed:{' '}
                    <strong>{activeSeed}</strong>
                  </span>
                )}

                <span>
                  Program:{' '}
                  <strong>
                    {programStatus}
                  </strong>
                </span>
              </section>

              <div className="simulation-mobile-section simulation-state-section">
                <ExecutionFocusPanel
                  focus={snapshot.executionFocus}
                />
              </div>

              {interfacePreferences.panels.exploration && (
                <div className="simulation-mobile-section simulation-state-section">
                  <ExplorationPanel
                    target={explorationTarget}
                    limits={explorationLimits}
                    result={
                      explorationSession?.result ?? null
                    }
                    replayChoiceIndex={replayChoiceIndex}
                    onTargetChange={
                      handleExplorationTargetChange
                    }
                    onLimitsChange={setExplorationLimits}
                    onExplore={handleExplore}
                    onStartReplay={
                      handleStartCounterexampleReplay
                    }
                    onReplayNext={handleReplayNextChoice}
                    onReplayAll={handleReplayAllChoices}
                    onExitReplay={
                      handleExitCounterexampleReplay
                    }
                  />
                </div>
              )}

              <section className="simulation-mobile-section simulation-processes-section">
                <h2>Processes</h2>

                <div className="process-grid">
                  {snapshot.processes.map(
                    (process) => (
                      <article
                        className={
                          process.id
                            === snapshot.executionFocus?.processId
                            ? 'process-card process-card-focused'
                            : 'process-card'
                        }
                        key={process.id}
                      >
                        <div className="process-header">
                          <h3>
                            {process.id}
                          </h3>

                          <span
                            className={
                              `state state-${process.state.toLowerCase()}`
                            }
                          >
                            {process.state}
                          </span>
                        </div>

                        {process.id
                          === snapshot.executionFocus?.processId && (
                          <span className="process-focus-badge">
                            LAST STEP
                          </span>
                        )}

                        <p>
                          Program counter:{' '}
                          <strong>
                            {
                              process.programCounter
                            }
                          </strong>
                        </p>

                        {process.blockingReason?.type === 'AWAIT' && (
                          <div className="await-blocking-reason">
                            <strong>Waiting for</strong>

                            <code>
                              {formatExpression(
                                process.blockingReason.condition,
                              )}
                            </code>
                          </div>
                        )}

                        {process.blockingReason?.type === 'SEMAPHORE_P' && (
                          <div className="semaphore-blocking-reason">
                            <strong>Waiting on P</strong>

                            <code>
                              {`P(${process.blockingReason.semaphoreName})`}
                            </code>
                          </div>
                        )}

                        <h4>
                          Local memory
                        </h4>

                        <MemoryTable
                          memory={
                            process.localMemory
                          }
                        />
                        <h4>Call Stack</h4>

                        {process.callStack.length === 0 ? (
                          <p className="empty">
                            No active function calls
                          </p>
                        ) : (
                          <div className="call-stack">
                            {[...process.callStack]
                              .reverse()
                              .map((frame, index) => (
                                <div
                                  className="call-frame"
                                  key={`${frame.functionName}-${index}`}
                                >
                                  <div className="call-frame-header">
                                    <strong>
                                      {frame.functionName}()
                                    </strong>

                                    {index === 0 && (
                                      <span className="active-frame">
                                        ACTIVE
                                      </span>
                                    )}
                                  </div>

                                  <MemoryTable
                                    memory={frame.localMemory}
                                  />
                                </div>
                              ))}
                          </div>
                        )}
                      </article>
                    ),
                  )}
                </div>
              </section>

              <section className="simulation-mobile-section simulation-state-section">
                <h2>
                  Shared Memory
                </h2>

                <div className="shared-memory">
                  <MemoryTable
                    memory={
                      snapshot.sharedMemory
                    }
                  />
                </div>
              </section>

              {snapshot.semaphores.length > 0 && (
                <section className="simulation-mobile-section simulation-state-section">
                  <h2>Semaphores</h2>

                  <div className="semaphore-grid">
                    {snapshot.semaphores.map(
                      (semaphore) => (
                        <article
                          className="semaphore-card"
                          key={semaphore.name}
                        >
                          <div className="semaphore-header">
                            <code>{semaphore.name}</code>

                            <strong className="semaphore-value">
                              {semaphore.value}
                            </strong>
                          </div>

                          <div className="semaphore-waiters">
                            <span>
                              Waiting processes
                            </span>

                            {semaphore.waitingProcessIds.length === 0 ? (
                              <span className="empty">
                                None
                              </span>
                            ) : (
                              <div className="semaphore-waiter-list">
                                {semaphore.waitingProcessIds.map(
                                  (processId) => (
                                    <span
                                      className="semaphore-waiter"
                                      key={processId}
                                    >
                                      {processId}
                                    </span>
                                  ),
                                )}
                              </div>
                            )}
                          </div>

                          <small>
                            Informational only · no FIFO order
                          </small>
                        </article>
                      ),
                    )}
                  </div>
                </section>
              )}

              {snapshot.deadlock && (
                <section
                  className="deadlock-panel simulation-mobile-section simulation-state-section"
                  aria-labelledby="deadlock-heading"
                >
                  <div className="deadlock-header">
                    <div>
                      <span className="deadlock-badge">
                        DEADLOCK
                      </span>

                      <h2 id="deadlock-heading">
                        Deadlock detected
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={
                        replayChoiceIndex !== null
                          ? handleReplayAllChoices
                          : handleReplayDeadlock
                      }
                    >
                      {replayChoiceIndex !== null
                        ? 'Replay counterexample'
                        : 'Replay deadlock'}
                    </button>
                  </div>

                  <p>{snapshot.deadlock.summary}</p>

                  <div className="deadlock-facts">
                    <span>
                      Detected at step{' '}
                      <strong>
                        {snapshot.deadlock.detectedAtStep}
                      </strong>
                    </span>

                    <span>
                      Type:{' '}
                      <strong>
                        {snapshot.deadlock.kind === 'CIRCULAR_WAIT'
                          ? 'Circular wait'
                          : 'Terminal blocking'}
                      </strong>
                    </span>

                    <span>
                      Graph:{' '}
                      <strong>
                        {snapshot.deadlock.graphIsComplete
                          ? 'Complete'
                          : 'Partial'}
                      </strong>
                    </span>
                  </div>

                  <div className="deadlock-entities">
                    <div>
                      <h3>Processes involved</h3>

                      <div className="deadlock-tags">
                        {snapshot.deadlock.involvedProcessIds.map(
                          (processId) => (
                            <span key={processId}>
                              {processId}
                            </span>
                          ),
                        )}
                      </div>
                    </div>

                    <div>
                      <h3>Resources involved</h3>

                      {snapshot.deadlock.involvedResources.length === 0 ? (
                        <p className="empty">
                          No concrete resource dependency
                          could be inferred.
                        </p>
                      ) : (
                        <div className="deadlock-tags">
                          {snapshot.deadlock.involvedResources.map(
                            (resource) => (
                              <span key={resource.id}>
                                {resource.kind.toLowerCase()}
                                {': '}
                                {resource.name}
                              </span>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {snapshot.deadlock.waitForEdges.length > 0 && (
                    <div className="deadlock-graph">
                      <h3>Wait-for graph</h3>

                      <table>
                        <thead>
                          <tr>
                            <th>Waiting process</th>
                            <th>Resource</th>
                            <th>Inferred holder</th>
                          </tr>
                        </thead>

                        <tbody>
                          {snapshot.deadlock.waitForEdges.map(
                            (edge) => {
                              const resource =
                                snapshot.deadlock?.involvedResources.find(
                                  (candidate) =>
                                    candidate.id === edge.resourceId,
                                )

                              return (
                                <tr
                                  key={`${edge.waitingProcessId}-${edge.resourceId}-${edge.holdingProcessId}`}
                                >
                                  <td>
                                    {edge.waitingProcessId}
                                  </td>
                                  <td>
                                    <code>
                                      {resource?.name
                                        ?? edge.resourceId}
                                    </code>
                                  </td>
                                  <td>
                                    {edge.holdingProcessId}
                                  </td>
                                </tr>
                              )
                            },
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {snapshot.deadlock.cycles.length > 0 ? (
                    <div className="deadlock-cycles">
                      <h3>Detected cycles</h3>

                      {snapshot.deadlock.cycles.map(
                        (cycle, index) => (
                          <p key={cycle.processIds.join('-')}>
                            <strong>
                              Cycle {index + 1}:
                            </strong>{' '}
                            {cycle.processIds.join(' ↔ ')}
                          </p>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="deadlock-limitation">
                      Every unfinished process is blocked, but
                      the available information is insufficient
                      to prove a circular resource dependency.
                    </p>
                  )}

                  <p className="deadlock-replay-note">
                    Replay resets the same scheduler and executes
                    the recorded number of steps again.
                  </p>
                </section>
              )}

              {interfacePreferences.panels.diagnostics
                && snapshot.runtimeDiagnostics.length > 0 && (
                <section
                  className="runtime-diagnostics simulation-mobile-section simulation-state-section"
                  aria-labelledby="runtime-diagnostics-heading"
                >
                  <div className="runtime-diagnostics-header">
                    <div>
                      <span className="runtime-diagnostics-badge">
                        TRACE DIAGNOSTICS
                      </span>

                      <h2 id="runtime-diagnostics-heading">
                        Execution diagnostics
                      </h2>
                    </div>

                    <span>
                      {snapshot.runtimeDiagnostics.length}{' '}
                      observation(s)
                    </span>
                  </div>

                  <p className="runtime-diagnostics-intro">
                    These findings explain the execution observed so far.
                    They do not predict every possible interleaving.
                  </p>

                  <div className="runtime-diagnostic-grid">
                    {snapshot.runtimeDiagnostics.map(
                      (diagnostic) => (
                        <article
                          className={
                            `runtime-diagnostic-card runtime-diagnostic-${diagnostic.severity.toLowerCase()}`
                          }
                          key={`${diagnostic.code}-${diagnostic.processIds.join('-')}`}
                        >
                          <div className="runtime-diagnostic-title">
                            <span>{diagnostic.severity}</span>
                            <h3>{diagnostic.title}</h3>
                          </div>

                          <p>{diagnostic.summary}</p>

                          <div className="runtime-diagnostic-facts">
                            <span>
                              Step{' '}
                              <strong>{diagnostic.detectedAtStep}</strong>
                            </span>

                            {diagnostic.processIds.map(
                              (processId) => (
                                <span key={processId}>
                                  {processId}
                                </span>
                              ),
                            )}
                          </div>

                          <h4>Evidence in this trace</h4>

                          <ul>
                            {diagnostic.evidence.map(
                              (item) => (
                                <li key={item}>{item}</li>
                              ),
                            )}
                          </ul>

                          <p className="runtime-diagnostic-scope">
                            <strong>Scope:</strong>{' '}
                            {diagnostic.scopeNote}
                          </p>
                        </article>
                      ),
                    )}
                  </div>
                </section>
              )}

              <section className="simulation-mobile-section simulation-history-section">
                <div className="history-header">
                  <h2>Execution History</h2>

                  <div className="history-tabs">
                    <button
                      type="button"
                      className={
                        displayedHistoryMode === 'instructions'
                          ? 'history-tab active'
                          : 'history-tab'
                      }
                      onClick={() =>
                        setHistoryMode('instructions')
                      }
                    >
                      Instructions
                    </button>

                    {interfacePreferences.panels.microoperations && (
                      <button
                        type="button"
                        className={
                          displayedHistoryMode === 'microoperations'
                            ? 'history-tab active'
                            : 'history-tab'
                        }
                        onClick={() =>
                          setHistoryMode('microoperations')
                        }
                      >
                        Micro-operations
                      </button>
                    )}
                  </div>
                </div>

                <div
                  className="history"
                  ref={historyRef}
                >
                  {displayedHistoryMode === 'instructions' ? (
                    engine.getState().history.length === 0 ? (
                      <p className="empty">
                        No instructions executed yet.
                      </p>
                    ) : (
                      <table>
                        <thead>
                          <tr>
                            <th>Step</th>
                            <th>Process</th>
                            <th>Instruction</th>
                            <th>Status</th>
                            <th>Detail</th>
                          </tr>
                        </thead>

                        <tbody>
                          {engine
                            .getState()
                            .history
                            .map((entry) => (
                              <tr
                                key={`${entry.step}-${entry.processId}`}
                                className={
                                  entry.step
                                    === snapshot.executionFocus?.step
                                    ? 'history-current-row'
                                    : undefined
                                }
                                aria-current={
                                  entry.step
                                    === snapshot.executionFocus?.step
                                    ? 'step'
                                    : undefined
                                }
                              >
                                <td>
                                  {entry.step}
                                  {entry.step
                                    === snapshot.executionFocus?.step && (
                                    <span className="history-current-indicator">
                                      Latest
                                    </span>
                                  )}
                                </td>
                                <td>{entry.processId}</td>

                                <td>
                                  {entry.instructionType}
                                </td>

                                <td>
                                  {entry.semaphoreEvent ? (
                                    <span
                                      className={
                                        `semaphore-status semaphore-status-${entry.semaphoreEvent.status.toLowerCase()}`
                                      }
                                    >
                                      {entry.semaphoreEvent.status}
                                    </span>
                                  ) : entry.awaitStatus ? (
                                    <span
                                      className={
                                        `await-status await-status-${entry.awaitStatus.toLowerCase()}`
                                      }
                                    >
                                      {entry.awaitStatus}
                                    </span>
                                  ) : entry.dataStructureEvent ? (
                                    <span className="data-structure-operation-status">
                                      {entry.dataStructureEvent.scope}
                                      {` · ${entry.dataStructureEvent.structureKind} · ATOMIC`}
                                    </span>
                                  ) : entry.simulatedOperationEvent ? (
                                    <span className="data-structure-operation-status">
                                      SIMULATED · DETERMINISTIC
                                    </span>
                                  ) : (
                                    '—'
                                  )}
                                </td>

                                <td>
                                  {entry.semaphoreEvent ? (
                                    <span className="semaphore-history-detail">
                                      <code>
                                        {`${entry.semaphoreEvent.operation}(${entry.semaphoreEvent.semaphoreName})`}
                                      </code>

                                      <span>
                                        {entry.semaphoreEvent.valueBefore}
                                        {' → '}
                                        {entry.semaphoreEvent.valueAfter}
                                      </span>
                                    </span>
                                  ) : (
                                    entry.description ?? '—'
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )
                  ) : snapshot.microOperationHistory.length === 0 ? (
                    <p className="empty">
                      No micro-operations executed yet.
                    </p>
                  ) : (
                    <>
                      <table>
                        <thead>
                          <tr>
                            <th>Step</th>
                            <th>Process</th>
                            <th>Operation</th>
                            <th>Detail</th>
                          </tr>
                        </thead>

                        <tbody>
                          {snapshot.microOperationHistory.map(
                            (entry, index) => {
                              const belongsToConflict = (
                                conflict: typeof snapshot.memoryAccessConflicts[number],
                              ) =>
                                (
                                  conflict.first.step === entry.step
                                  && conflict.first.processId === entry.processId
                                  && conflict.first.type === entry.type
                                )
                                || (
                                  conflict.second.step === entry.step
                                  && conflict.second.processId === entry.processId
                                  && conflict.second.type === entry.type
                                )

                              const hasPotentialRace =
                                potentialRaces.some(belongsToConflict)

                              const hasMutualExclusionViolation =
                                mutualExclusionViolations.some(
                                  belongsToConflict,
                                )

                              const hasSynchronizedAccess =
                                synchronizedConflicts.some(belongsToConflict)

                              const hasUnknownAccess =
                                unknownConflicts.some(belongsToConflict)

                              const isLatestMicroOperation =
                                index
                                  === snapshot.microOperationHistory.length - 1

                              const rowClassName = [
                                isLatestMicroOperation
                                  ? 'history-current-row'
                                  : '',
                                hasPotentialRace
                                  ? 'memory-conflict-row'
                                  : hasUnknownAccess
                                    ? 'memory-unknown-row'
                                    : hasSynchronizedAccess
                                      ? 'memory-synchronized-row'
                                      : '',
                              ].filter(Boolean).join(' ')

                              return (
                                <tr
                                  key={`${entry.step}-${entry.processId}-${entry.type}-${index}`}
                                  className={rowClassName || undefined}
                                  aria-current={
                                    isLatestMicroOperation
                                      ? 'step'
                                      : undefined
                                  }
                                >
                                  <td>
                                    {entry.step}
                                    {isLatestMicroOperation && (
                                      <span className="history-current-indicator">
                                        Latest
                                      </span>
                                    )}
                                  </td>
                                  <td>{entry.processId}</td>
                                  <td>
                                    <span
                                      className={`micro-operation micro-operation-${entry.type.toLowerCase()}`}
                                    >
                                      {entry.type}
                                    </span>
                                  </td>

                                  <td>
                                    {entry.description}

                                    {hasMutualExclusionViolation && (
                                      <span className="memory-exclusion-indicator">
                                        Mutex violation
                                      </span>
                                    )}

                                    {hasPotentialRace
                                      && !hasMutualExclusionViolation && (
                                      <span className="memory-conflict-indicator">
                                        Potential race
                                      </span>
                                    )}

                                    {hasSynchronizedAccess && (
                                      <span className="memory-synchronized-indicator">
                                        Synchronized
                                      </span>
                                    )}

                                    {hasUnknownAccess && (
                                      <span className="memory-unknown-indicator">
                                        Unknown
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              )
                            },
                          )}
                        </tbody>
                      </table>

                      <div className="memory-conflicts">
                        <div className="memory-conflicts-header">
                          <h3>Memory Access Analysis</h3>

                          <div>
                            <span className="memory-conflict-count">
                              {potentialRaces.length}{' '}
                              potential race observation
                              {potentialRaces.length === 1 ? '' : 's'}
                            </span>

                            {' · '}

                            <span className="memory-exclusion-count">
                              {mutualExclusionViolations.length}{' '}
                              mutex violation
                              {mutualExclusionViolations.length === 1
                                ? ''
                                : 's'}
                            </span>

                            {' · '}

                            <span className="memory-synchronized-count">
                              {synchronizedConflicts.length}{' '}
                              synchronized
                            </span>

                            {' · '}

                            <span className="memory-unknown-count">
                              {unknownConflicts.length}{' '}
                              unknown
                            </span>
                          </div>
                        </div>
                        <p className="analysis-scope-note">
                          This is a protocol analysis of the observed trace,
                          not a formal data-race proof or a guarantee about
                          every possible interleaving.
                        </p>

                        {conflictsNeedingAttention.length > 0
                          && snapshot.memoryConflictSummaries.length > 0 && (
                          <div className="memory-conflict-summary-grid">
                            {snapshot.memoryConflictSummaries.map(
                              (summary, index) => {
                                const locationDescription =
                                  summary.location.type === 'VARIABLE'
                                    ? summary.location.name
                                    : summary.location.type === 'ARRAY_ELEMENT'
                                      ? `${summary.location.arrayName}[${summary.location.index}]`
                                      : `${summary.location.recordName}.${summary.location.fieldName}`

                                return (
                                  <div
                                    className="memory-conflict-summary-card"
                                    key={`${locationDescription}-${index}`}
                                  >
                                    <code>
                                      {locationDescription}
                                    </code>

                                    <span>
                                      {
                                        summary.processes.join(', ')
                                      }
                                    </span>

                                    <span>
                                      {summary.potentialRaceCount}{' '}
                                      potential observation
                                      {summary.potentialRaceCount === 1
                                        ? ''
                                        : 's'}
                                    </span>

                                    {summary.mutualExclusionViolationCount > 0 && (
                                      <span className="memory-exclusion-count">
                                        {summary.mutualExclusionViolationCount}{' '}
                                        mutex violation
                                        {summary.mutualExclusionViolationCount === 1
                                          ? ''
                                          : 's'}
                                      </span>
                                    )}
                                  </div>
                                )
                              },
                            )}
                          </div>
                        )}
                        {conflictsNeedingAttention.length === 0 ? (
                            <p className="empty">
                              No unprotected or ambiguous shared-memory conflicts detected.
                            </p>
                          ) : (
                            <table>
                              <thead>
                                <tr>
                                  <th>Location</th>
                                  <th>First access</th>
                                  <th>Second access</th>
                                  <th>Analysis</th>
                                </tr>
                              </thead>

                              <tbody>
                                {conflictsNeedingAttention.map(
                                  (conflict, index) => {
                                    const location =
                                      conflict.first.location

                                    const locationDescription =
                                      location?.type
                                        === 'VARIABLE'
                                        ? location.name
                                        : location?.type
                                            === 'ARRAY_ELEMENT'
                                          ? `${location.arrayName}[${location.index}]`
                                          : location?.type === 'RECORD_FIELD'
                                            ? `${location.recordName}.${location.fieldName}`
                                          : 'Unknown'

                                    return (
                                      <tr
                                        key={`${conflict.first.step}-${conflict.second.step}-${index}`}
                                      >
                                        <td>
                                          <code>
                                            {locationDescription}
                                          </code>
                                        </td>

                                        <td>
                                          <strong>
                                            {
                                              conflict
                                                .first
                                                .processId
                                            }
                                          </strong>
                                          {' · '}
                                          {
                                            conflict
                                              .first
                                              .type
                                          }
                                          {' · Step '}
                                          {
                                            conflict
                                              .first
                                              .step
                                          }
                                        </td>

                                        <td>
                                          <strong>
                                            {
                                              conflict
                                                .second
                                                .processId
                                            }
                                          </strong>
                                          {' · '}
                                          {
                                            conflict
                                              .second
                                              .type
                                          }
                                          {' · Step '}
                                          {
                                            conflict
                                              .second
                                              .step
                                          }
                                        </td>

                                        <td>
                                          <span
                                            className={
                                              conflict.classification === 'UNKNOWN'
                                                ? 'memory-unknown-indicator'
                                                : conflict.diagnostic
                                                    === 'MUTUAL_EXCLUSION_VIOLATION'
                                                  ? 'memory-exclusion-indicator'
                                                : 'memory-conflict-indicator'
                                            }
                                          >
                                            {conflict.classification === 'UNKNOWN'
                                              ? 'Unknown'
                                              : conflict.diagnostic
                                                  === 'MUTUAL_EXCLUSION_VIOLATION'
                                                ? 'Mutex violation'
                                                : 'Potential race'}
                                          </span>

                                          <div className="memory-analysis-reason">
                                            {describeConflictReason(conflict)}
                                          </div>
                                        </td>
                                      </tr>
                                    )
                                  },
                                )}
                              </tbody>
                            </table>
                          )}
                          {synchronizedConflicts.length > 0 && (
                            <>
                              <h4>Synchronized Shared-Memory Accesses</h4>

                              <table>
                                <thead>
                                  <tr>
                                    <th>Location</th>
                                    <th>First access</th>
                                    <th>Second access</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {synchronizedConflicts.map(
                                    (conflict, index) => {
                                      const location =
                                        conflict.first.location

                                      const locationDescription =
                                        location?.type === 'VARIABLE'
                                          ? location.name
                                          : location?.type === 'ARRAY_ELEMENT'
                                            ? `${location.arrayName}[${location.index}]`
                                            : location?.type === 'RECORD_FIELD'
                                              ? `${location.recordName}.${location.fieldName}`
                                            : 'Unknown'

                                      return (
                                        <tr
                                          key={`synchronized-${conflict.first.step}-${conflict.second.step}-${index}`}
                                          className="memory-synchronized-row"
                                        >
                                          <td>
                                            <code>
                                              {locationDescription}
                                            </code>
                                          </td>

                                          <td>
                                            <strong>
                                              {conflict.first.processId}
                                            </strong>
                                            {' · '}
                                            {conflict.first.type}
                                            {' · Step '}
                                            {conflict.first.step}
                                          </td>

                                          <td>
                                            <strong>
                                              {conflict.second.processId}
                                            </strong>
                                            {' · '}
                                            {conflict.second.type}
                                            {' · Step '}
                                            {conflict.second.step}
                                          </td>

                                          <td>
                                            <span className="memory-synchronized-indicator">
                                              Synchronized
                                            </span>

                                            <div className="memory-analysis-reason">
                                              {describeConflictReason(conflict)}
                                            </div>
                                          </td>
                                        </tr>
                                      )
                                    },
                                  )}
                                </tbody>
                              </table>
                            </>
                          )}
                      </div>
                    </>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </section>
    </main>
  )
}

interface MemoryTableProps {
  memory: Record<string, RuntimeValue>
}

function MemoryTable({
  memory,
}: MemoryTableProps) {
  const entries = Object.entries(memory)

  if (entries.length === 0) {
    return (
      <p className="empty">
        Empty
      </p>
    )
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Variable</th>
          <th>Value</th>
        </tr>
      </thead>

      <tbody>
        {entries.map(
          ([name, value]) => (
            <tr key={name}>
              <td>{name}</td>

              <td>
                {formatValue(value)}
              </td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  )
}

function formatValue(
  value: RuntimeValue,
): string {
  if (isQueueValue(value)) {
    if (value.items.length === 0) {
      return `queue<${value.elementType}> [empty]`
    }

    return `queue<${value.elementType}> [front → ${value.items.join(', ')} ← back]`
  }

  if (isPriorityQueueValue(value)) {
    if (value.items.length === 0) {
      return `priority_queue<${value.elementType}> [empty]`
    }

    return `priority_queue<${value.elementType}> [highest → ${value.items
      .map((item) => `${String(item.value)} (p=${item.priority})`)
      .join(', ')} ← lowest]`
  }

  if (isStackValue(value)) {
    if (value.items.length === 0) {
      return `stack<${value.elementType}> [empty]`
    }

    return `stack<${value.elementType}> [bottom → ${value.items.join(', ')} ← top]`
  }

  if (isRecordValue(value)) {
    return `${value.recordType} { ${Object.entries(value.fields)
      .map(([name, fieldValue]) => `${name}: ${String(fieldValue)}`)
      .join(', ')} }`
  }

  if (Array.isArray(value)) {
    return `[${value.join(', ')}]`
  }

  return String(value)
}

function describeConflictReason(
  conflict: MemoryAccessConflict,
): string {
  switch (conflict.reason.type) {
    case 'ATOMIC_REGION':
      return 'Both accesses ran inside atomic regions.'

    case 'SEMAPHORE_MUTEX':
      return `Observed mutex protocol with ${conflict.reason.semaphoreName}.`

    case 'SEMAPHORE_SIGNALING':
      return `Observed direct V(${conflict.reason.semaphoreName}) → P(${conflict.reason.semaphoreName}) handoff orders these accesses.`

    case 'AMBIGUOUS_SEMAPHORE_PROTOCOL':
      return `Semaphore use is not a verified mutex protocol: ${conflict.reason.semaphoreNames.join(', ')}.`

    case 'INCONSISTENT_PROTECTION':
      return `The accesses use inconsistent protection (${describeProtection(conflict.reason.first)} vs ${describeProtection(conflict.reason.second)}). This remains a potential race, not a formal proof.`

    case 'OBSERVED_MUTEX_OVERLAP':
      return `The trace shows one process accessing the location while the other still holds an incompatible mutex (${describeProtection(conflict.reason.first)} vs ${describeProtection(conflict.reason.second)}).`

    case 'UNPROTECTED':
      return 'The accesses do not share a recognized protection mechanism. This is a potential race observation, not proof of a data race.'
  }
}

function describeProtection(
  protection: Extract<
    MemoryAccessConflict['reason'],
    {
      type:
        | 'INCONSISTENT_PROTECTION'
        | 'OBSERVED_MUTEX_OVERLAP'
    }
  >['first'],
): string {
  const mechanisms: string[] = []

  if (protection.atomicRegion) {
    mechanisms.push('atomic')
  }

  mechanisms.push(
    ...protection.mutexSemaphoreNames.map(
      (name) => `${name} (mutex)`,
    ),
  )
  mechanisms.push(
    ...protection.ambiguousSemaphoreNames.map(
      (name) => `ambiguous semaphore ${name}`,
    ),
  )

  return mechanisms.length > 0
    ? mechanisms.join(' + ')
    : 'no recognized protection'
}

function schedulerLabel(
  type: SchedulerType,
): string {
  switch (type) {
    case 'FIRST_READY':
      return 'First Ready'

    case 'ROUND_ROBIN':
      return 'Round Robin'

    case 'RANDOM':
      return 'Random'
  }
}

function errorMessage(
  value: unknown,
  fallback: string,
): string {
  return value instanceof Error
    ? value.message
    : fallback
}

function loadInitialInterfacePreferences() {
  try {
    return loadInterfacePreferences(window.localStorage)
  } catch {
    return createDefaultInterfacePreferences()
  }
}

export default App
