import { describe, expect, it } from 'vitest'
import { parseProgram } from '../../language/parseProgram'
import {
  isUninitializedVariableValue,
} from '../../memory/RuntimeValue'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { createExecutionState } from '../createExecutionState'
import { SimulationEngine } from '../SimulationEngine'

function createEngine(source: string): SimulationEngine {
  return new SimulationEngine(
    createExecutionState(parseProgram(source)),
    new FirstReadyScheduler(),
  )
}

function runToCompletion(
  engine: SimulationEngine,
  maximumSteps = 100,
): void {
  for (let step = 0; step < maximumSteps; step++) {
    if (engine.isFinished()) {
      return
    }

    engine.step()
  }

  throw new Error('Program did not finish')
}

describe('uninitialized local variables', () => {
  it('parses primitive and record declarations without initializers', () => {
    const program = parseProgram(`
      record Fallo { int id; int nivel; }

      process P1 {
        int nivel;
        Fallo fallo;
      }
    `)

    expect(program.processes[0].instructions).toMatchObject([
      {
        type: 'DECLARE',
        name: 'nivel',
        declaredType: {
          container: 'SCALAR',
          valueType: {
            kind: 'PRIMITIVE',
            primitiveType: 'int',
          },
        },
        initialValue: undefined,
      },
      {
        type: 'DECLARE',
        name: 'fallo',
        declaredType: {
          container: 'SCALAR',
          valueType: {
            kind: 'RECORD',
            recordType: 'Fallo',
          },
        },
        initialValue: undefined,
      },
    ])
  })

  it('assigns dequeued records and their fields without placeholder values', () => {
    const engine = createEngine(`
      record Fallo { int id; int nivel; }

      shared queue<Fallo> fallos = queue[
        Fallo { id: 7, nivel: 3 }
      ];

      process P1 {
        Fallo fallo;
        int nivel;
        fallo = fallos.dequeue();
        nivel = fallo.getNivel();
        print(fallo.getId(), nivel);
      }
    `)

    runToCompletion(engine)

    expect(engine.getState().program.processes[0].localMemory)
      .toMatchObject({
        fallo: {
          kind: 'RECORD',
          recordType: 'Fallo',
          fields: { id: 7, nivel: 3 },
        },
        nivel: 3,
      })
  })

  it('rejects a read before initialization', () => {
    const engine = createEngine(`
      process P1 {
        int nivel;
        print(nivel);
      }
    `)

    engine.step()

    expect(() => engine.step()).toThrow(
      'Variable "nivel" cannot be read before initialization',
    )
  })

  it('validates the type of the first assignment', () => {
    const engine = createEngine(`
      process P1 {
        int nivel;
        nivel = true;
      }
    `)

    engine.step()

    expect(() => engine.step()).toThrow(
      'Variable "nivel" requires int but received bool',
    )
  })

  it('accepts an uninitialized local variable as an out destination', () => {
    const engine = createEngine(`
      monitor Counter {
        procedure read(out int value) {
          value = 7;
        }
      }

      process P1 {
        int result;
        Counter.read(result);
      }
    `)

    runToCompletion(engine)

    expect(engine.getState().program.processes[0].localMemory.result)
      .toBe(7)
  })

  it('restores the uninitialized marker with Step Back and Reset', () => {
    const engine = createEngine(`
      process P1 {
        int value;
        value = 10;
      }
    `)

    engine.step()
    expect(isUninitializedVariableValue(
      engine.getState().program.processes[0].localMemory.value,
    )).toBe(true)

    engine.step()
    expect(engine.getState().program.processes[0].localMemory.value)
      .toBe(10)

    expect(engine.stepBack()).toBe(true)
    expect(isUninitializedVariableValue(
      engine.getState().program.processes[0].localMemory.value,
    )).toBe(true)

    engine.reset()
    expect(engine.getState().program.processes[0].localMemory)
      .toEqual({})
  })

  it('continues requiring initialization for shared variables', () => {
    expect(() => parseProgram(`
      shared int value;
      process P1 { }
    `)).toThrow('Expected "=" after variable name')
  })
})
