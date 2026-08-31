import { describe, expect, it } from 'vitest'
import { parseProgram } from '../../language/parseProgram'
import { isRecordValue } from '../../memory/RuntimeValue'
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

  throw new Error('Simulated-operation program did not finish')
}

describe('simulated operations', () => {
  it('parses print as a dedicated instruction', () => {
    const program = parseProgram(`
      process P1 {
        print("nivel", 3);
      }
    `)

    expect(program.processes[0].instructions[0]).toMatchObject({
      type: 'SIMULATED_OPERATION',
      operationName: 'print',
      arguments: [
        { type: 'LITERAL', value: 'nivel' },
        { type: 'LITERAL', value: 3 },
      ],
    })
  })

  it('captures print arguments in a deterministic event', () => {
    const engine = createEngine(`
      record Fallo { int id; int nivel; }
      shared Fallo fallo = Fallo { id: 25, nivel: 3 };

      process Controlador {
        print("Fallo", fallo.getID(), fallo.getNivel() + 1);
      }
    `)

    runToCompletion(engine)

    const printEvent = engine.getState().history.find(
      (event) => event.simulatedOperationEvent,
    )
    const readLocations = engine.getSnapshot()
      .microOperationHistory
      .filter((event) => event.type === 'SHARED_READ')
      .map((event) => event.location)

    expect(printEvent).toMatchObject({
      instructionType: 'SIMULATED_OPERATION',
      description: 'print("Fallo", 25, 4)',
      simulatedOperationEvent: {
        operationName: 'print',
        arguments: ['Fallo', 25, 4],
      },
    })
    expect(readLocations).toContainEqual({
      type: 'RECORD_FIELD',
      recordName: 'fallo',
      fieldName: 'id',
    })
    expect(readLocations).toContainEqual({
      type: 'RECORD_FIELD',
      recordName: 'fallo',
      fieldName: 'nivel',
    })
  })

  it('freezes printed records without changing program memory', () => {
    const engine = createEngine(`
      record Fallo { int nivel; }
      shared Fallo fallo = Fallo { nivel: 3 };

      process Controlador {
        print(fallo);
        fallo.nivel = 2;
        print();
      }
    `)

    runToCompletion(engine)

    const events = engine.getState().history
      .flatMap((event) => event.simulatedOperationEvent
        ? [event.simulatedOperationEvent]
        : [])
    const printedRecord = events[0].arguments[0]
    const currentRecord =
      engine.getState().program.sharedMemory.fallo

    expect(isRecordValue(printedRecord)).toBe(true)
    if (isRecordValue(printedRecord)) {
      expect(printedRecord.fields.nivel).toBe(3)
    }
    expect(isRecordValue(currentRecord)).toBe(true)
    if (isRecordValue(currentRecord)) {
      expect(currentRecord.fields.nivel).toBe(2)
    }
    expect(events[1].arguments).toEqual([])
  })

  it('rejects suspended function calls inside print for now', () => {
    const engine = createEngine(`
      function identity(int value) {
        return value;
      }

      process P1 {
        print(identity(3));
      }
    `)

    expect(() => engine.step()).toThrow(
      'Function calls inside print() are not supported yet',
    )
  })

  it('records simulated methods on shared and local records', () => {
    const engine = createEngine(`
      record Fallo { int id; int nivel; }
      shared Fallo fallo = Fallo { id: 25, nivel: 3 };

      process Controlador {
        Fallo copia = Fallo { id: 9, nivel: 1 };
        fallo.procesar();
        copia.notificar("local", fallo.getNivel());
      }
    `)

    runToCompletion(engine)

    const events = engine.getState().history
      .flatMap((event) => event.simulatedOperationEvent
        ? [event.simulatedOperationEvent]
        : [])

    expect(events).toEqual([
      {
        operationName: 'procesar',
        arguments: [],
        receiver: {
          name: 'fallo',
          recordType: 'Fallo',
          scope: 'SHARED',
        },
      },
      {
        operationName: 'notificar',
        arguments: ['local', 3],
        receiver: {
          name: 'copia',
          recordType: 'Fallo',
          scope: 'LOCAL',
        },
      },
    ])
    expect(engine.getState().history).toContainEqual(
      expect.objectContaining({
        description: 'fallo.procesar()',
      }),
    )
    expect(engine.getState().history).toContainEqual(
      expect.objectContaining({
        description: 'copia.notificar("local", 3)',
      }),
    )
  })

  it('runs the user-facing print and record-method example', () => {
    const engine = createEngine(`
      record Fallo {
        int id;
        int nivel;
        string mensaje;
      }

      shared Fallo fallo = Fallo {
        id: 25,
        nivel: 3,
        mensaje: "temperatura"
      };

      process Controlador {
        Fallo copia = Fallo {
          id: 9,
          nivel: 1,
          mensaje: "copia local"
        };

        print("Estado inicial", fallo);
        print("ID", fallo.getID(), "nivel", fallo.getNivel());

        fallo.procesar();
        copia.notificar("copia local", fallo.getNivel());

        fallo.nivel = 2;
        print("Nivel actualizado", fallo.getNivel());
        print();
      }
    `)

    runToCompletion(engine)

    const operations = engine.getState().history
      .flatMap((event) => event.simulatedOperationEvent
        ? [event.simulatedOperationEvent]
        : [])
    const sharedRecord =
      engine.getState().program.sharedMemory.fallo

    expect(
      operations.map((operation) => operation.operationName),
    ).toEqual([
      'print',
      'print',
      'procesar',
      'notificar',
      'print',
      'print',
    ])
    expect(operations[1].arguments).toEqual([
      'ID',
      25,
      'nivel',
      3,
    ])
    expect(operations[3].receiver).toMatchObject({
      name: 'copia',
      recordType: 'Fallo',
      scope: 'LOCAL',
    })
    expect(isRecordValue(sharedRecord)).toBe(true)
    if (isRecordValue(sharedRecord)) {
      expect(sharedRecord.fields.nivel).toBe(2)
    }
  })

  it('validates simulated-method receivers and getter usage', () => {
    expect(() => parseProgram(`
      record Fallo { int id; }
      shared Fallo fallo = Fallo { id: 1 };

      process P1 {
        fallo.getID();
      }
    `)).toThrow(
      'Getter "getID" returns a value and cannot be used as a statement',
    )

    const engine = createEngine(`
      process P1 {
        int value = 1;
        value.procesar();
      }
    `)

    engine.step()
    expect(() => engine.step()).toThrow(
      'Simulated method "procesar" requires record receiver "value"',
    )
  })
})
