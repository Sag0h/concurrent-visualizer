import { describe, expect, it } from 'vitest'
import { parseProgram } from '../../language/parseProgram'
import { isRecordValue } from '../../memory/RuntimeValue'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { createExecutionState } from '../createExecutionState'
import { SimulationEngine } from '../SimulationEngine'

function runToCompletion(
  source: string,
  maxSteps = 300,
): SimulationEngine {
  const engine = new SimulationEngine(
    createExecutionState(parseProgram(source)),
    new FirstReadyScheduler(),
  )

  for (let step = 0; step < maxSteps; step++) {
    if (engine.isFinished()) {
      return engine
    }

    engine.step()
  }

  throw new Error('Record-array program did not finish')
}

describe('record array operations', () => {
  it('creates local and shared arrays and accesses their fields', () => {
    const engine = runToCompletion(`
      record Fallo {
        int id;
        int nivel;
        string mensaje;
      }

      shared Fallo[] fallos = [
        Fallo { id: 1, nivel: 2, mensaje: "temperatura" },
        Fallo { id: 2, nivel: 1, mensaje: "red" }
      ];

      process Controlador {
        Fallo[] locales = [
          Fallo { id: 7, nivel: 1, mensaje: "local" }
        ];
        int nivelAnterior = fallos[1].nivel;
        int idGetter = fallos[0].getID();
        Fallo copia = fallos[0];
        copia.nivel = 99;
        int nivelOriginal = fallos[0].nivel;
        fallos[0].nivel = 3;
        locales[0].id = 8;
        fallos[1] = Fallo { id: 9, nivel: 2, mensaje: "reemplazo" };
        int idReemplazado = fallos[1].id;
        int suma = 0;
        foreach (fallo in fallos) {
          suma = suma + fallo.nivel;
        }
      }
    `)

    const shared = engine.getState().program.sharedMemory.fallos
    const local = engine.getState().program.processes[0].localMemory

    expect(Array.isArray(shared)).toBe(true)
    if (!Array.isArray(shared)) {
      throw new Error('Expected shared record array')
    }

    expect(isRecordValue(shared[0])).toBe(true)
    expect(isRecordValue(shared[1])).toBe(true)
    if (isRecordValue(shared[0]) && isRecordValue(shared[1])) {
      expect(shared[0].fields.nivel).toBe(3)
      expect(shared[1].fields).toEqual({
        id: 9,
        nivel: 2,
        mensaje: 'reemplazo',
      })
    }

    expect(local).toMatchObject({
      nivelAnterior: 1,
      idGetter: 1,
      nivelOriginal: 2,
      idReemplazado: 9,
      suma: 5,
    })

    expect(isRecordValue(local.copia)).toBe(true)
    if (isRecordValue(local.copia)) {
      expect(local.copia.fields.nivel).toBe(99)
    }

    const localRecords = local.locales
    expect(Array.isArray(localRecords)).toBe(true)
    if (Array.isArray(localRecords) && isRecordValue(localRecords[0])) {
      expect(localRecords[0].fields.id).toBe(8)
    }
  })

  it('records shared accesses at indexed-field granularity', () => {
    const engine = runToCompletion(`
      record Fallo { int id; int nivel; }
      shared Fallo[] fallos = [Fallo { id: 1, nivel: 0 }];

      process P1 {
        fallos[0].nivel = fallos[0].nivel + 1;
      }

      process P2 {
        fallos[0].id = fallos[0].id + 1;
      }
    `)

    const locations = engine.getSnapshot()
      .microOperationHistory
      .flatMap((event) => event.location ? [event.location] : [])

    expect(locations).toContainEqual({
      type: 'ARRAY_RECORD_FIELD',
      arrayName: 'fallos',
      index: 0,
      fieldName: 'nivel',
    })
    expect(locations).toContainEqual({
      type: 'ARRAY_RECORD_FIELD',
      arrayName: 'fallos',
      index: 0,
      fieldName: 'id',
    })
    expect(engine.getSnapshot().memoryAccessConflicts).toEqual([])
  })

  it('detects conflicts on the same field of the same element', () => {
    const engine = runToCompletion(`
      record Fallo { int nivel; }
      shared Fallo[] fallos = [Fallo { nivel: 0 }];

      process P1 { fallos[0].nivel = 1; }
      process P2 { fallos[0].nivel = 2; }
    `)

    const conflicts = engine.getSnapshot().memoryAccessConflicts

    expect(conflicts.length).toBeGreaterThan(0)
    expect(conflicts[0].first.location).toEqual({
      type: 'ARRAY_RECORD_FIELD',
      arrayName: 'fallos',
      index: 0,
      fieldName: 'nivel',
    })
  })

  it('rejects malformed literals and incompatible replacements', () => {
    expect(() => parseProgram(`
      record Fallo { int id; int nivel; }
      shared Fallo[] fallos = [Fallo { id: 1 }];
    `)).toThrow(
      'Record literal "Fallo" is missing field "nivel"',
    )

    expect(() => parseProgram(`
      record Fallo { int id; }
      shared Fallo[] fallos = [Fallo { id: "uno" }];
    `)).toThrow(
      'Field "id" of record "Fallo" must be int',
    )

    expect(() => runToCompletion(`
      record Fallo { int id; }
      record Persona { int id; }
      shared Fallo[] fallos = [Fallo { id: 1 }];

      process P1 {
        fallos[0] = Persona { id: 2 };
      }
    `)).toThrow(
      'fallos[0] requires Fallo but received Persona',
    )
  })
})
