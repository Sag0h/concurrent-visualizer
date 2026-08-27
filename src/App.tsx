import { useState } from 'react'
import './App.css'
import { literal, binary, variable } from './core/expressions/expressionFactories'
import {
  assign,
  finish,
  noOp,
  variableTarget,
} from './core/instructions/instructionFactories'
import type { Process } from './core/process/Process'
import type { Program } from './core/engine/Program'
import { createExecutionState } from './core/engine/createExecutionState'
import { SimulationEngine } from './core/engine/SimulationEngine'
import { RoundRobinScheduler } from './core/scheduler/RoundRobinScheduler'

function createDemoEngine(): SimulationEngine {
  const p1: Process = {
    id: 'P1',
    state: 'READY',
    programCounter: 0,
    localMemory: {
      value: 10,
    },
    instructions: [
      noOp(),
      assign(
        variableTarget('value'),
        binary(
          '+',
          variable('value'),
          literal(1),
        ),
      ),
      noOp(),
      finish(),
    ],
  }

  const p2: Process = {
    id: 'P2',
    state: 'READY',
    programCounter: 0,
    localMemory: {
      value: 20,
    },
    instructions: [
      noOp(),
      assign(
        variableTarget('value'),
        binary(
          '+',
          variable('value'),
          literal(5),
        ),
      ),
      finish(),
    ],
  }

  const program: Program = {
    processes: [p1, p2],
    sharedMemory: {
      counter: 0,
      message: 'Concurrent Visualizer',
    },
  }

  return new SimulationEngine(
    createExecutionState(program),
    new RoundRobinScheduler(),
  )
}

function App() {
  const [engine] = useState(() => createDemoEngine())
  const [snapshot, setSnapshot] = useState(
    () => engine.getSnapshot(),
  )

  function handleStep() {
    engine.step()
    setSnapshot(engine.getSnapshot())
  }

  function handleReset() {
    engine.reset()
    setSnapshot(engine.getSnapshot())
  }

  return (
    <main className="app">
      <header className="header">
        <div>
          <h1>Concurrent Visualizer</h1>
          <p>Concurrent programming simulator</p>
        </div>

        <div className="controls">
          <button
            onClick={handleStep}
            disabled={engine.isFinished()}
          >
            Step
          </button>

          <button onClick={handleReset}>
            Reset
          </button>
        </div>
      </header>

      <section className="status-bar">
        <span>
          Step: <strong>{snapshot.stepCount}</strong>
        </span>

        <span>
          Scheduler: <strong>Round Robin</strong>
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
          {snapshot.processes.map((process) => (
            <article
              className="process-card"
              key={process.id}
            >
              <div className="process-header">
                <h3>{process.id}</h3>

                <span
                  className={`state state-${process.state.toLowerCase()}`}
                >
                  {process.state}
                </span>
              </div>

              <p>
                Program counter:{' '}
                <strong>
                  {process.programCounter}
                </strong>
              </p>

              <h4>Local memory</h4>

              <MemoryTable
                memory={process.localMemory}
              />
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>Shared Memory</h2>

        <div className="shared-memory">
          <MemoryTable
            memory={snapshot.sharedMemory}
          />
        </div>
      </section>
    </main>
  )
}

interface MemoryTableProps {
  memory: Record<
    string,
    number | boolean | string | (number | boolean | string)[]
  >
}

function MemoryTable({
  memory,
}: MemoryTableProps) {
  const entries = Object.entries(memory)

  if (entries.length === 0) {
    return <p className="empty">Empty</p>
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
        {entries.map(([name, value]) => (
          <tr key={name}>
            <td>{name}</td>
            <td>
              {Array.isArray(value)
                ? `[${value.join(', ')}]`
                : String(value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default App
