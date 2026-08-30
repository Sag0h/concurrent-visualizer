import { describe, expect, it } from 'vitest'
import { parseProgram } from '../../language/parseProgram'
import {
  isRecordValue,
} from '../../memory/RuntimeValue'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { createExecutionState } from '../createExecutionState'
import { SimulationEngine } from '../SimulationEngine'

function runToCompletion(
  source: string,
): SimulationEngine {
  const engine = new SimulationEngine(
    createExecutionState(parseProgram(source)),
    new FirstReadyScheduler(),
  )

  for (let step = 0; step < 100; step++) {
    if (engine.isFinished()) {
      return engine
    }

    engine.step()
  }

  throw new Error('Record program did not finish')
}

describe('record operations', () => {
  it('creates records and reads and writes local and shared fields', () => {
    const engine = runToCompletion(`
      record Fallo {
        int id;
        int nivel;
        string mensaje;
      }

      shared Fallo fallo = Fallo {
        id: 7,
        nivel: 3,
        mensaje: "temperatura"
      };

      process Controlador {
        Fallo copia = Fallo {
          id: 1,
          nivel: 1,
          mensaje: "local"
        };
        int nivelAnterior = fallo.nivel;
        fallo.nivel = 2;
        copia.id = nivelAnterior;
        int idLocal = copia.id;
      }
    `)

    const record = engine.getState().program.sharedMemory.fallo
    const localMemory =
      engine.getState().program.processes[0].localMemory

    expect(isRecordValue(record)).toBe(true)
    if (isRecordValue(record)) {
      expect(record.fields).toEqual({
        id: 7,
        nivel: 2,
        mensaje: 'temperatura',
      })
    }
    expect(localMemory.nivelAnterior).toBe(3)
    expect(localMemory.idLocal).toBe(3)
  })

  it('records shared accesses at field granularity', () => {
    const engine = runToCompletion(`
      record Estado {
        int izquierda;
        int derecha;
      }

      shared Estado estado = Estado {
        izquierda: 0,
        derecha: 0
      };

      process P1 {
        estado.izquierda = estado.izquierda + 1;
      }

      process P2 {
        estado.derecha = estado.derecha + 1;
      }
    `)

    const locations = engine.getSnapshot()
      .microOperationHistory
      .flatMap((event) => event.location ? [event.location] : [])

    expect(locations).toContainEqual({
      type: 'RECORD_FIELD',
      recordName: 'estado',
      fieldName: 'izquierda',
    })
    expect(locations).toContainEqual({
      type: 'RECORD_FIELD',
      recordName: 'estado',
      fieldName: 'derecha',
    })
    expect(engine.getSnapshot().memoryAccessConflicts).toEqual([])

    const conflictingEngine = runToCompletion(`
      record Estado { int valor; }
      shared Estado estado = Estado { valor: 0 };

      process P1 { estado.valor = 1; }
      process P2 { estado.valor = 2; }
    `)
    const conflicts =
      conflictingEngine.getSnapshot().memoryAccessConflicts

    expect(conflicts.length).toBeGreaterThan(0)
    expect(conflicts[0].first.location).toEqual({
      type: 'RECORD_FIELD',
      recordName: 'estado',
      fieldName: 'valor',
    })
  })

  it('rejects invalid record literals', () => {
    expect(() => parseProgram(`
      record Fallo { int id; int nivel; }
      shared Fallo fallo = Fallo { id: 7 };
    `)).toThrow(
      'Record literal "Fallo" is missing field "nivel"',
    )

    expect(() => parseProgram(`
      record Fallo { int id; }
      shared Fallo fallo = Fallo { otro: 7 };
    `)).toThrow(
      'Record "Fallo" has no field "otro"',
    )

    expect(() => parseProgram(`
      record Fallo { int id; }
      shared Fallo fallo = Fallo { id: "siete" };
    `)).toThrow(
      'Field "id" of record "Fallo" must be int',
    )
  })

  it('rejects record methods until simulated methods are implemented', () => {
    expect(() => parseProgram(`
      record Fallo { int nivel; }
      shared Fallo fallo = Fallo { nivel: 3 };

      process P1 {
        int nivel = fallo.getNivel();
      }
    `)).toThrow(
      'Unknown data structure method "getNivel"',
    )
  })
})
