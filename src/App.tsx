import { useState } from 'react'
import './App.css'
import { createExecutionState } from './core/engine/createExecutionState'
import { SimulationEngine } from './core/engine/SimulationEngine'
import type { SimulationSnapshot } from './core/engine/SimulationSnapshot'
import { parseProgram } from './core/language/parseProgram'
import type { RuntimeValue } from './core/memory/RuntimeValue'
import { createScheduler } from './core/scheduler/createScheduler'
import type { SchedulerType } from './core/scheduler/SchedulerType'
import { formatExpression } from './core/expressions/formatExpression'
import type { MemoryAccessConflict } from './core/engine/MemoryAccessConflict'

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

function App() {
  const [code, setCode] = useState(initialCode)

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

  const [error, setError] =
    useState<string | null>(null)

  const [isDirty, setIsDirty] = 
    useState(true)

  function handleBuild() {
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

    } catch (buildError) {
      setEngine(null)
      setSnapshot(null)

      if (buildError instanceof Error) {
        setError(buildError.message)
      } else {
        setError('Unknown build error')
      }
    }
  }

  function invalidateBuild() {
    setEngine(null)
    setSnapshot(null)
    setIsDirty(true)
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

    invalidateBuild()
  }

  function handleStep() {
    if (!engine) {
      return
    }

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

  function handleReset() {
    if (!engine) {
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

  function generateRandomSeed(): number {
    return Math.floor(
      Math.random() * 2_147_483_647,
    )
  }

  const [historyMode, setHistoryMode] =
    useState<'instructions' | 'microoperations'>(
      'instructions',
    )

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
    engine?.isFinished()
      ? 'FINISHED'
      : snapshot
        && snapshot.processes.length > 0
        && snapshot.processes.every(
          (process) =>
            process.state === 'BLOCKED'
            || process.state === 'FINISHED',
        )
        && snapshot.processes.some(
          (process) =>
            process.state === 'BLOCKED',
        )
          ? 'BLOCKED'
          : 'RUNNING'

  return (
    <main className="app">
      <header className="header">
        <div>
          <h1>Concurrent Visualizer</h1>
          <p>
            Concurrent programming simulator
          </p>
        </div>
      </header>

      <section className="workspace">
        <div className="editor-panel">
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

          <textarea
            className="code-editor"
            value={code}
            onChange={(event) => {
              setCode(event.target.value)
              invalidateBuild()
            }}
            onKeyDown={handleEditorKeyDown}
            spellCheck={false}
          />

          <div className="controls">
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

            <button
              onClick={handleStep}
              disabled={
                !engine
                || engine.isFinished()
              }
            >
              Step
            </button>

            <button
              onClick={handleRun}
              disabled={
                !engine
                || engine.isFinished()
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

          {error && (
            <div className="error-box">
              <strong>Build error</strong>
              <pre>{error}</pre>
            </div>
          )}
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

              <section>
                <h2>Processes</h2>

                <div className="process-grid">
                  {snapshot.processes.map(
                    (process) => (
                      <article
                        className="process-card"
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

              <section>
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
                <section>
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

              <section>
                <div className="history-header">
                  <h2>Execution History</h2>

                  <div className="history-tabs">
                    <button
                      type="button"
                      className={
                        historyMode === 'instructions'
                          ? 'history-tab active'
                          : 'history-tab'
                      }
                      onClick={() =>
                        setHistoryMode('instructions')
                      }
                    >
                      Instructions
                    </button>

                    <button
                      type="button"
                      className={
                        historyMode === 'microoperations'
                          ? 'history-tab active'
                          : 'history-tab'
                      }
                      onClick={() =>
                        setHistoryMode('microoperations')
                      }
                    >
                      Micro-operations
                    </button>
                  </div>
                </div>

                <div className="history">
                  {historyMode === 'instructions' ? (
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
                              >
                                <td>{entry.step}</td>
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

                              const hasSynchronizedAccess =
                                synchronizedConflicts.some(belongsToConflict)

                              const hasUnknownAccess =
                                unknownConflicts.some(belongsToConflict)

                              return (
                                <tr
                                  key={`${entry.step}-${entry.processId}-${entry.type}-${index}`}
                                  className={
                                    hasPotentialRace
                                      ? 'memory-conflict-row'
                                      : hasUnknownAccess
                                        ? 'memory-unknown-row'
                                      : hasSynchronizedAccess
                                        ? 'memory-synchronized-row'
                                        : undefined
                                  }
                                >
                                  <td>{entry.step}</td>
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

                                    {hasPotentialRace && (
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
                              potential race
                              {potentialRaces.length === 1 ? '' : 's'}
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
                          Classification applies to this observed execution.
                          It is not a proof for every possible interleaving.
                        </p>

                        {conflictsNeedingAttention.length > 0
                          && snapshot.memoryConflictSummaries.length > 0 && (
                          <div className="memory-conflict-summary-grid">
                            {snapshot.memoryConflictSummaries.map(
                              (summary, index) => {
                                const locationDescription =
                                  summary.location.type === 'VARIABLE'
                                    ? summary.location.name
                                    : `${summary.location.arrayName}[${summary.location.index}]`

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
                                      {summary.conflictCount}{' '}
                                      conflict
                                      {summary.conflictCount === 1
                                        ? ''
                                        : 's'}
                                    </span>
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
                                                : 'memory-conflict-indicator'
                                            }
                                          >
                                            {conflict.classification === 'UNKNOWN'
                                              ? 'Unknown'
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

    case 'AMBIGUOUS_SEMAPHORE_PROTOCOL':
      return `Semaphore use is not a verified mutex protocol: ${conflict.reason.semaphoreNames.join(', ')}.`

    case 'UNPROTECTED':
      return 'The accesses do not share a recognized protection mechanism.'
  }
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

export default App
