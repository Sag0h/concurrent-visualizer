import { useState } from 'react'
import './App.css'
import { createExecutionState } from './core/engine/createExecutionState'
import { SimulationEngine } from './core/engine/SimulationEngine'
import type { SimulationSnapshot } from './core/engine/SimulationSnapshot'
import { parseProgram } from './core/language/parseProgram'
import type { RuntimeValue } from './core/memory/RuntimeValue'
import { createScheduler } from './core/scheduler/createScheduler'
import type { SchedulerType } from './core/scheduler/SchedulerType'

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

  const [randomSeed, setRandomSeed] = useState(42)

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

      const newEngine = new SimulationEngine(
        createExecutionState(program),
        createScheduler(
          schedulerType,
          randomSeed,
        ),
      )

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

    engine.step()

    setSnapshot(
      engine.getSnapshot(),
    )
  }

  function handleReset() {
    if (!engine) {
      return
    }

    engine.reset()

    setSnapshot(
      engine.getSnapshot(),
    )
  }

  function handleRun() {
    if (!engine) {
      return
    }

    while (
      !engine.isFinished()
      && !engine.hasReachedStepLimit()
    ) {
      engine.step()
    }

    setSnapshot(
      engine.getSnapshot(),
    )
  }

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
                  <label htmlFor="seed">
                    Seed
                  </label>

                  <input
                    id="seed"
                    className="seed-input"
                    type="number"
                    value={randomSeed}
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

                <span>
                  Program:{' '}
                  <strong>
                    {engine.isFinished()
                      ? 'FINISHED'
                      : 'RUNNING'}
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

                        <h4>
                          Local memory
                        </h4>

                        <MemoryTable
                          memory={
                            process.localMemory
                          }
                        />
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

              <section>
                <h2>Execution History</h2>

                <div className="history">
                  {engine.getState().history.length === 0 ? (
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
                        </tr>
                      </thead>

                      <tbody>
                        {engine
                          .getState()
                          .history
                          .map((entry) => (
                            <tr key={entry.step}>
                              <td>{entry.step}</td>
                              <td>{entry.processId}</td>
                              <td>
                                {entry.instructionType}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
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
