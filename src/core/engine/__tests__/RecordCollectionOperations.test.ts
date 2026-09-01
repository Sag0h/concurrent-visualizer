import { describe, expect, it } from 'vitest'
import { parseProgram } from '../../language/parseProgram'
import {
  isPriorityQueueValue,
  isQueueValue,
  isRecordValue,
  isStackValue,
} from '../../memory/RuntimeValue'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { createExecutionState } from '../createExecutionState'
import { SimulationEngine } from '../SimulationEngine'

function runToCompletion(
  source: string,
  maximumSteps = 200,
): SimulationEngine {
  const engine = new SimulationEngine(
    createExecutionState(parseProgram(source)),
    new FirstReadyScheduler(),
  )

  for (let step = 0; step < maximumSteps; step++) {
    if (engine.isFinished()) {
      return engine
    }

    engine.step()
  }

  throw new Error(
    'Record-collection program did not finish',
  )
}

describe('record collection operations', () => {
  it('stores records in FIFO queues and returns detached copies', () => {
    const engine = runToCompletion(`
      record Fallo { int id; int nivel; }
      shared queue<Fallo> fallos = queue[
        Fallo { id: 1, nivel: 1 }
      ];

      process Controlador {
        Fallo original = Fallo { id: 2, nivel: 2 };
        fallos.enqueue(original);
        original.nivel = 99;
        Fallo observado = fallos.front();
        observado.nivel = 88;
        Fallo primero = fallos.dequeue();
        Fallo segundo = fallos.dequeue();
        int primerID = primero.getID();
        int segundoNivel = segundo.getNivel();
      }
    `)

    const process = engine.getState().program.processes[0]
    const queue = engine.getState().program.sharedMemory.fallos

    expect(process.localMemory).toMatchObject({
      primerID: 1,
      segundoNivel: 2,
    })
    expect(isRecordValue(process.localMemory.original)).toBe(true)
    if (isRecordValue(process.localMemory.original)) {
      expect(process.localMemory.original.fields.nivel).toBe(99)
    }
    expect(isQueueValue(queue)).toBe(true)
    if (isQueueValue(queue)) {
      expect(queue.elementType).toEqual({
        kind: 'RECORD',
        recordType: 'Fallo',
      })
      expect(queue.items).toEqual([])
    }
  })

  it('keeps priority queues stable when records have equal priority', () => {
    const engine = runToCompletion(`
      record Tarea { int id; string nombre; }
      shared priority_queue<Tarea> tareas = priority_queue[
        (Tarea { id: 1, nombre: "baja" }, 1),
        (Tarea { id: 2, nombre: "primera urgente" }, 5),
        (Tarea { id: 3, nombre: "segunda urgente" }, 5)
      ];

      process Worker {
        Tarea primera = tareas.dequeue();
        Tarea segunda = tareas.dequeue();
        Tarea tercera = tareas.dequeue();
        int primerID = primera.getID();
        int segundoID = segunda.getID();
        int tercerID = tercera.getID();
      }
    `)

    const local = engine.getState().program.processes[0].localMemory
    const queue = engine.getState().program.sharedMemory.tareas

    expect(local).toMatchObject({
      primerID: 2,
      segundoID: 3,
      tercerID: 1,
    })
    expect(isPriorityQueueValue(queue)).toBe(true)
    if (isPriorityQueueValue(queue)) {
      expect(queue.items).toEqual([])
    }
  })

  it('stores records in stacks using LIFO order', () => {
    const engine = runToCompletion(`
      record Evento { int id; }

      process Worker {
        stack<Evento> eventos = stack[
          Evento { id: 1 },
          Evento { id: 2 }
        ];
        eventos.push(Evento { id: 3 });
        Evento cima = eventos.top();
        Evento primero = eventos.pop();
        Evento segundo = eventos.pop();
        int cimaID = cima.getID();
        int primerID = primero.getID();
        int segundoID = segundo.getID();
      }
    `)

    const local = engine.getState().program.processes[0].localMemory

    expect(local).toMatchObject({
      cimaID: 3,
      primerID: 3,
      segundoID: 2,
    })
    expect(isStackValue(local.eventos)).toBe(true)
  })

  it('rejects a record with a different nominal type', () => {
    const engine = new SimulationEngine(
      createExecutionState(parseProgram(`
        record Fallo { int id; }
        record Persona { int id; }

        process Worker {
          queue<Fallo> fallos = queue[];
          Persona persona = Persona { id: 1 };
          fallos.enqueue(persona);
        }
      `)),
      new FirstReadyScheduler(),
    )

    engine.step()
    engine.step()

    expect(() => engine.step()).toThrow(
      'Queue<Fallo> cannot store Persona',
    )

    const wrongResult = new SimulationEngine(
      createExecutionState(parseProgram(`
        record Fallo { int id; }
        record Persona { int id; }

        process Worker {
          queue<Fallo> fallos = queue[Fallo { id: 1 }];
          Persona persona = fallos.dequeue();
        }
      `)),
      new FirstReadyScheduler(),
    )

    wrongResult.step()

    expect(() => wrongResult.step()).toThrow(
      'Variable "persona" is declared as Persona but dequeue() returns Fallo',
    )
  })
})
