import { describe, expect, it } from 'vitest'
import { parseProgram } from '../../language/parseProgram'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { RoundRobinScheduler } from '../../scheduler/RoundRobinScheduler'
import { createExecutionState } from '../createExecutionState'
import { SimulationEngine } from '../SimulationEngine'

const candyMutualExclusionSource = `
  sem mutex = 1;
  shared int cant = 0;

  process Chico1 {
    bool comiendo = false;
    P(mutex);
    cant = cant + 1;
    V(mutex);
    comiendo = true;
  }

  process Chico2 {
    bool comiendo = false;
    P(mutex);
    cant = cant + 1;
    V(mutex);
    comiendo = true;
  }
`

const eventSignalingSource = `
  sem inicio = 0;

  process Trabajador {
    P(inicio);
    bool comenzo = true;
  }

  process Coordinador {
    V(inicio);
  }
`

const multipleWaitersSource = `
  sem inicio = 0;

  process Trabajador1 {
    P(inicio);
    bool comenzo = true;
  }

  process Trabajador2 {
    P(inicio);
    bool comenzo = true;
  }

  process Coordinador {
    V(inicio);
    V(inicio);
  }
`

const countingSemaphoreSource = `
  sem recursos = 2;

  process Trabajador1 {
    P(recursos);
    bool usoRecurso = true;
    V(recursos);
  }

  process Trabajador2 {
    P(recursos);
    bool usoRecurso = true;
    V(recursos);
  }

  process Trabajador3 {
    P(recursos);
    bool usoRecurso = true;
    V(recursos);
  }
`

const unitBufferSource = `
  sem vacio = 1;
  sem lleno = 0;
  shared int buffer = 0;
  shared int consumido = 0;

  process Consumidor {
    P(lleno);
    consumido = buffer;
    V(vacio);
  }

  process Productor {
    P(vacio);
    buffer = 42;
    V(lleno);
  }
`

const countedBufferSource = `
  sem vacio = 2;
  sem lleno = 0;
  shared int[] buffer = [0, 0];
  shared int[] consumidos = [0, 0, 0];

  process Productor {
    P(vacio);
    atomic {
      buffer[0] = 10;
    }
    V(lleno);

    P(vacio);
    atomic {
      buffer[1] = 20;
    }
    V(lleno);

    P(vacio);
    atomic {
      buffer[0] = 30;
    }
    V(lleno);
  }

  process Consumidor {
    P(lleno);
    atomic {
      consumidos[0] = buffer[0];
    }
    V(vacio);

    P(lleno);
    atomic {
      consumidos[1] = buffer[1];
    }
    V(vacio);

    P(lleno);
    atomic {
      consumidos[2] = buffer[0];
    }
    V(vacio);
  }
`

const threeProcessBarrierSource = `
  sem mutex = 1;
  sem barrera = 0;
  shared int contador = 0;

  process Chico1 {
    P(mutex);
    contador = contador + 1;
    if (contador == 3) {
      V(barrera);
      V(barrera);
      V(barrera);
    }
    V(mutex);
    P(barrera);
    bool continuo = true;
  }

  process Chico2 {
    P(mutex);
    contador = contador + 1;
    if (contador == 3) {
      V(barrera);
      V(barrera);
      V(barrera);
    }
    V(mutex);
    P(barrera);
    bool continuo = true;
  }

  process Chico3 {
    P(mutex);
    contador = contador + 1;
    if (contador == 3) {
      V(barrera);
      V(barrera);
      V(barrera);
    }
    V(mutex);
    P(barrera);
    bool continuo = true;
  }
`

const readerPreferenceSource = `
  sem rw = 1;
  sem mutexR = 1;
  shared int nr = 0;
  shared int baseDatos = 0;
  shared int lectura1 = 0;
  shared int lectura2 = 0;

  process Lector1 {
    P(mutexR);
    nr = nr + 1;
    if (nr == 1) {
      P(rw);
    }
    V(mutexR);

    bool leyendo = true;
    atomic {
      lectura1 = baseDatos;
    }
    int comprobacion = lectura1;
    comprobacion = comprobacion + 1;
    comprobacion = comprobacion + 1;
    comprobacion = comprobacion + 1;
    comprobacion = comprobacion + 1;
    leyendo = false;

    P(mutexR);
    nr = nr - 1;
    if (nr == 0) {
      V(rw);
    }
    V(mutexR);
  }

  process Lector2 {
    P(mutexR);
    nr = nr + 1;
    if (nr == 1) {
      P(rw);
    }
    V(mutexR);

    bool leyendo = true;
    atomic {
      lectura2 = baseDatos;
    }
    int comprobacion = lectura2;
    comprobacion = comprobacion + 1;
    comprobacion = comprobacion + 1;
    comprobacion = comprobacion + 1;
    comprobacion = comprobacion + 1;
    leyendo = false;

    P(mutexR);
    nr = nr - 1;
    if (nr == 0) {
      V(rw);
    }
    V(mutexR);
  }

  process Escritor {
    int preparacion = 0;
    preparacion = preparacion + 1;
    preparacion = preparacion + 1;
    preparacion = preparacion + 1;
    preparacion = preparacion + 1;
    preparacion = preparacion + 1;
    preparacion = preparacion + 1;
    P(rw);
    atomic {
      baseDatos = 42;
    }
    V(rw);
  }
`

const diningPhilosophersSource = `
  sem tenedor0 = 1;
  sem tenedor1 = 1;
  sem tenedor2 = 1;
  sem tenedor3 = 1;
  sem tenedor4 = 1;

  process Filosofo0 {
    P(tenedor0);
    P(tenedor1);
    bool comiendo = true;
    int bocados = 0;
    bocados = bocados + 1;
    bocados = bocados + 1;
    bocados = bocados + 1;
    bocados = bocados + 1;
    comiendo = false;
    V(tenedor1);
    V(tenedor0);
  }

  process Filosofo1 {
    int espera = 0;
    espera = espera + 1;
    espera = espera + 1;
    espera = espera + 1;
    P(tenedor1);
    P(tenedor2);
    bool comiendo = true;
    int bocados = 0;
    bocados = bocados + 1;
    bocados = bocados + 1;
    bocados = bocados + 1;
    bocados = bocados + 1;
    comiendo = false;
    V(tenedor2);
    V(tenedor1);
  }

  process Filosofo2 {
    P(tenedor2);
    P(tenedor3);
    bool comiendo = true;
    int bocados = 0;
    bocados = bocados + 1;
    bocados = bocados + 1;
    bocados = bocados + 1;
    bocados = bocados + 1;
    comiendo = false;
    V(tenedor3);
    V(tenedor2);
  }

  process Filosofo3 {
    int espera = 0;
    espera = espera + 1;
    espera = espera + 1;
    espera = espera + 1;
    P(tenedor3);
    P(tenedor4);
    bool comiendo = true;
    int bocados = 0;
    bocados = bocados + 1;
    bocados = bocados + 1;
    bocados = bocados + 1;
    bocados = bocados + 1;
    comiendo = false;
    V(tenedor4);
    V(tenedor3);
  }

  process Filosofo4 {
    int espera = 0;
    espera = espera + 1;
    espera = espera + 1;
    espera = espera + 1;
    P(tenedor0);
    P(tenedor4);
    bool comiendo = true;
    int bocados = 0;
    bocados = bocados + 1;
    bocados = bocados + 1;
    bocados = bocados + 1;
    bocados = bocados + 1;
    comiendo = false;
    V(tenedor4);
    V(tenedor0);
  }
`

describe('M7 academic semaphore cases', () => {
  it('protects the candy counter with mutual exclusion while leaving local work outside', () => {
    const engine = new SimulationEngine(
      createExecutionState(
        parseProgram(candyMutualExclusionSource),
      ),
      new RoundRobinScheduler(),
      100,
    )

    const processesInCriticalSection =
      new Set<string>()
    let maximumConcurrentProcesses = 0

    while (!engine.isFinished()) {
      const previousHistoryLength =
        engine.getState().history.length

      const progressed = engine.step()

      expect(progressed).toBe(true)

      const newEvents =
        engine.getState().history.slice(
          previousHistoryLength,
        )

      for (const event of newEvents) {
        const semaphoreEvent = event.semaphoreEvent

        if (
          !semaphoreEvent
          || semaphoreEvent.status !== 'SUCCEEDED'
          || semaphoreEvent.semaphoreName !== 'mutex'
        ) {
          continue
        }

        if (semaphoreEvent.operation === 'P') {
          expect(
            processesInCriticalSection.size,
          ).toBe(0)

          processesInCriticalSection.add(
            event.processId,
          )

          maximumConcurrentProcesses = Math.max(
            maximumConcurrentProcesses,
            processesInCriticalSection.size,
          )

          continue
        }

        expect(
          processesInCriticalSection.has(
            event.processId,
          ),
        ).toBe(true)

        processesInCriticalSection.delete(
          event.processId,
        )
      }
    }

    const snapshot = engine.getSnapshot()

    expect(snapshot.sharedMemory.cant).toBe(2)
    expect(snapshot.semaphores).toEqual([
      {
        name: 'mutex',
        value: 1,
        waitingProcessIds: [],
      },
    ])
    expect(snapshot.processes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'Chico1',
          state: 'FINISHED',
          localMemory: {
            comiendo: true,
          },
        }),
        expect.objectContaining({
          id: 'Chico2',
          state: 'FINISHED',
          localMemory: {
            comiendo: true,
          },
        }),
      ]),
    )

    expect(maximumConcurrentProcesses).toBe(1)
    expect(processesInCriticalSection.size).toBe(0)
    expect(
      engine.getState().history.some(
        (event) =>
          event.semaphoreEvent?.operation === 'P'
          && event.semaphoreEvent.status === 'BLOCKED',
      ),
    ).toBe(true)

    expect(
      snapshot.memoryAccessConflicts.length,
    ).toBeGreaterThan(0)
    expect(
      snapshot.memoryAccessConflicts.every(
        (conflict) =>
          conflict.classification
            === 'SYNCHRONIZED'
          && conflict.reason.type
            === 'SEMAPHORE_MUTEX'
          && conflict.reason.semaphoreName
            === 'mutex',
      ),
    ).toBe(true)
  })

  it('signals an event from a coordinator to a blocked worker', () => {
    const engine = new SimulationEngine(
      createExecutionState(
        parseProgram(eventSignalingSource),
      ),
      new RoundRobinScheduler(),
      20,
    )

    expect(engine.step()).toBe(true)

    let snapshot = engine.getSnapshot()

    expect(snapshot.semaphores).toEqual([
      {
        name: 'inicio',
        value: 0,
        waitingProcessIds: ['Trabajador'],
      },
    ])
    expect(
      snapshot.processes.find(
        (process) => process.id === 'Trabajador',
      ),
    ).toMatchObject({
      state: 'BLOCKED',
      blockingReason: {
        type: 'SEMAPHORE_P',
        semaphoreName: 'inicio',
      },
      localMemory: {},
    })

    expect(engine.step()).toBe(true)

    snapshot = engine.getSnapshot()

    expect(snapshot.semaphores).toEqual([
      {
        name: 'inicio',
        value: 1,
        waitingProcessIds: ['Trabajador'],
      },
    ])
    expect(
      snapshot.processes.find(
        (process) => process.id === 'Trabajador',
      )?.state,
    ).toBe('BLOCKED')

    expect(engine.step()).toBe(true)

    snapshot = engine.getSnapshot()

    expect(snapshot.semaphores).toEqual([
      {
        name: 'inicio',
        value: 0,
        waitingProcessIds: [],
      },
    ])
    expect(
      snapshot.processes.find(
        (process) => process.id === 'Trabajador',
      ),
    ).toMatchObject({
      state: 'READY',
      blockingReason: undefined,
      localMemory: {},
    })

    expect(engine.step()).toBe(true)
    expect(engine.isFinished()).toBe(true)

    snapshot = engine.getSnapshot()

    expect(
      snapshot.processes.find(
        (process) => process.id === 'Trabajador',
      )?.localMemory,
    ).toEqual({
      comenzo: true,
    })
    expect(snapshot.memoryAccessConflicts).toEqual([])

    expect(
      engine.getState().history
        .filter((event) => event.semaphoreEvent)
        .map((event) => ({
          processId: event.processId,
          semaphoreEvent: event.semaphoreEvent,
        })),
    ).toEqual([
      {
        processId: 'Trabajador',
        semaphoreEvent: {
          operation: 'P',
          semaphoreName: 'inicio',
          status: 'BLOCKED',
          valueBefore: 0,
          valueAfter: 0,
        },
      },
      {
        processId: 'Coordinador',
        semaphoreEvent: {
          operation: 'V',
          semaphoreName: 'inicio',
          status: 'SUCCEEDED',
          valueBefore: 0,
          valueAfter: 1,
        },
      },
      {
        processId: 'Trabajador',
        semaphoreEvent: {
          operation: 'P',
          semaphoreName: 'inicio',
          status: 'SUCCEEDED',
          valueBefore: 1,
          valueAfter: 0,
        },
      },
    ])
  })

  it('requires one signal for each worker waiting on the same semaphore', () => {
    const engine = new SimulationEngine(
      createExecutionState(
        parseProgram(multipleWaitersSource),
      ),
      new RoundRobinScheduler(),
      30,
    )

    expect(engine.step()).toBe(true)
    expect(engine.step()).toBe(true)

    let snapshot = engine.getSnapshot()

    expect(snapshot.semaphores).toEqual([
      {
        name: 'inicio',
        value: 0,
        waitingProcessIds: [
          'Trabajador1',
          'Trabajador2',
        ],
      },
    ])

    expect(engine.step()).toBe(true)

    snapshot = engine.getSnapshot()

    expect(snapshot.semaphores).toEqual([
      {
        name: 'inicio',
        value: 1,
        waitingProcessIds: [
          'Trabajador1',
          'Trabajador2',
        ],
      },
    ])

    expect(engine.step()).toBe(true)

    snapshot = engine.getSnapshot()

    expect(snapshot.semaphores).toEqual([
      {
        name: 'inicio',
        value: 0,
        waitingProcessIds: [],
      },
    ])
    expect(
      snapshot.processes.find(
        (process) => process.id === 'Trabajador1',
      )?.state,
    ).toBe('READY')
    expect(
      snapshot.processes.find(
        (process) => process.id === 'Trabajador2',
      )?.state,
    ).toBe('READY')

    expect(engine.step()).toBe(true)

    snapshot = engine.getSnapshot()

    expect(snapshot.semaphores).toEqual([
      {
        name: 'inicio',
        value: 0,
        waitingProcessIds: ['Trabajador2'],
      },
    ])

    expect(engine.step()).toBe(true)

    snapshot = engine.getSnapshot()

    expect(snapshot.semaphores).toEqual([
      {
        name: 'inicio',
        value: 1,
        waitingProcessIds: ['Trabajador2'],
      },
    ])

    while (!engine.isFinished()) {
      expect(engine.step()).toBe(true)
    }

    snapshot = engine.getSnapshot()

    expect(snapshot.semaphores).toEqual([
      {
        name: 'inicio',
        value: 0,
        waitingProcessIds: [],
      },
    ])
    expect(snapshot.processes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'Trabajador1',
          state: 'FINISHED',
          localMemory: {
            comenzo: true,
          },
        }),
        expect.objectContaining({
          id: 'Trabajador2',
          state: 'FINISHED',
          localMemory: {
            comenzo: true,
          },
        }),
      ]),
    )

    expect(
      engine.getState().history
        .filter((event) => event.semaphoreEvent)
        .map((event) => ({
          processId: event.processId,
          operation:
            event.semaphoreEvent?.operation,
          status: event.semaphoreEvent?.status,
          transition:
            `${event.semaphoreEvent?.valueBefore}->${event.semaphoreEvent?.valueAfter}`,
        })),
    ).toEqual([
      {
        processId: 'Trabajador1',
        operation: 'P',
        status: 'BLOCKED',
        transition: '0->0',
      },
      {
        processId: 'Trabajador2',
        operation: 'P',
        status: 'BLOCKED',
        transition: '0->0',
      },
      {
        processId: 'Coordinador',
        operation: 'V',
        status: 'SUCCEEDED',
        transition: '0->1',
      },
      {
        processId: 'Trabajador1',
        operation: 'P',
        status: 'SUCCEEDED',
        transition: '1->0',
      },
      {
        processId: 'Trabajador2',
        operation: 'P',
        status: 'BLOCKED',
        transition: '0->0',
      },
      {
        processId: 'Coordinador',
        operation: 'V',
        status: 'SUCCEEDED',
        transition: '0->1',
      },
      {
        processId: 'Trabajador2',
        operation: 'P',
        status: 'SUCCEEDED',
        transition: '1->0',
      },
    ])
  })

  it('allows at most the available units of a counted resource', () => {
    const engine = new SimulationEngine(
      createExecutionState(
        parseProgram(countingSemaphoreSource),
      ),
      new RoundRobinScheduler(),
      30,
    )

    expect(engine.step()).toBe(true)
    expect(engine.step()).toBe(true)
    expect(engine.step()).toBe(true)

    let snapshot = engine.getSnapshot()

    expect(snapshot.semaphores).toEqual([
      {
        name: 'recursos',
        value: 0,
        waitingProcessIds: ['Trabajador3'],
      },
    ])
    expect(snapshot.processes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'Trabajador1',
          state: 'READY',
          localMemory: {},
        }),
        expect.objectContaining({
          id: 'Trabajador2',
          state: 'READY',
          localMemory: {},
        }),
        expect.objectContaining({
          id: 'Trabajador3',
          state: 'BLOCKED',
          blockingReason: {
            type: 'SEMAPHORE_P',
            semaphoreName: 'recursos',
          },
          localMemory: {},
        }),
      ]),
    )

    while (!engine.isFinished()) {
      expect(engine.step()).toBe(true)
    }

    snapshot = engine.getSnapshot()

    expect(snapshot.semaphores).toEqual([
      {
        name: 'recursos',
        value: 2,
        waitingProcessIds: [],
      },
    ])
    expect(snapshot.processes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'Trabajador1',
          state: 'FINISHED',
          localMemory: {
            usoRecurso: true,
          },
        }),
        expect.objectContaining({
          id: 'Trabajador2',
          state: 'FINISHED',
          localMemory: {
            usoRecurso: true,
          },
        }),
        expect.objectContaining({
          id: 'Trabajador3',
          state: 'FINISHED',
          localMemory: {
            usoRecurso: true,
          },
        }),
      ]),
    )
    expect(snapshot.memoryAccessConflicts).toEqual([])

    const activeResourceUsers = new Set<string>()
    let maximumConcurrentUsers = 0
    const semaphoreEvents = engine.getState().history
      .filter((event) => event.semaphoreEvent)

    for (const event of semaphoreEvents) {
      const semaphoreEvent = event.semaphoreEvent

      if (semaphoreEvent?.status !== 'SUCCEEDED') {
        continue
      }

      if (semaphoreEvent.operation === 'P') {
        activeResourceUsers.add(event.processId)
        maximumConcurrentUsers = Math.max(
          maximumConcurrentUsers,
          activeResourceUsers.size,
        )
        expect(activeResourceUsers.size).toBeLessThanOrEqual(2)
      } else {
        expect(
          activeResourceUsers.has(event.processId),
        ).toBe(true)
        activeResourceUsers.delete(event.processId)
      }
    }

    expect(maximumConcurrentUsers).toBe(2)
    expect(activeResourceUsers.size).toBe(0)
    expect(
      semaphoreEvents.map((event) => ({
        processId: event.processId,
        operation: event.semaphoreEvent?.operation,
        status: event.semaphoreEvent?.status,
        transition:
          `${event.semaphoreEvent?.valueBefore}->${event.semaphoreEvent?.valueAfter}`,
      })),
    ).toEqual([
      {
        processId: 'Trabajador1',
        operation: 'P',
        status: 'SUCCEEDED',
        transition: '2->1',
      },
      {
        processId: 'Trabajador2',
        operation: 'P',
        status: 'SUCCEEDED',
        transition: '1->0',
      },
      {
        processId: 'Trabajador3',
        operation: 'P',
        status: 'BLOCKED',
        transition: '0->0',
      },
      {
        processId: 'Trabajador1',
        operation: 'V',
        status: 'SUCCEEDED',
        transition: '0->1',
      },
      {
        processId: 'Trabajador2',
        operation: 'V',
        status: 'SUCCEEDED',
        transition: '1->2',
      },
      {
        processId: 'Trabajador3',
        operation: 'P',
        status: 'SUCCEEDED',
        transition: '2->1',
      },
      {
        processId: 'Trabajador3',
        operation: 'V',
        status: 'SUCCEEDED',
        transition: '1->2',
      },
    ])
  })

  it('coordinates one producer and one consumer through a unit buffer', () => {
    const engine = new SimulationEngine(
      createExecutionState(
        parseProgram(unitBufferSource),
      ),
      new RoundRobinScheduler(),
      30,
    )

    expect(engine.step()).toBe(true)

    let snapshot = engine.getSnapshot()

    expect(snapshot.semaphores).toEqual([
      {
        name: 'vacio',
        value: 1,
        waitingProcessIds: [],
      },
      {
        name: 'lleno',
        value: 0,
        waitingProcessIds: ['Consumidor'],
      },
    ])
    expect(
      snapshot.processes.find(
        (process) => process.id === 'Consumidor',
      ),
    ).toMatchObject({
      state: 'BLOCKED',
      blockingReason: {
        type: 'SEMAPHORE_P',
        semaphoreName: 'lleno',
      },
    })

    expect(engine.step()).toBe(true)
    expect(engine.step()).toBe(true)
    expect(engine.step()).toBe(true)
    expect(engine.step()).toBe(true)

    snapshot = engine.getSnapshot()

    expect(snapshot.sharedMemory).toEqual({
      buffer: 42,
      consumido: 0,
    })
    expect(snapshot.semaphores).toEqual([
      {
        name: 'vacio',
        value: 0,
        waitingProcessIds: [],
      },
      {
        name: 'lleno',
        value: 1,
        waitingProcessIds: ['Consumidor'],
      },
    ])
    expect(
      snapshot.processes.find(
        (process) => process.id === 'Consumidor',
      )?.state,
    ).toBe('BLOCKED')

    expect(engine.step()).toBe(true)
    expect(engine.step()).toBe(true)
    expect(engine.step()).toBe(true)
    expect(engine.step()).toBe(true)
    expect(engine.step()).toBe(true)
    expect(engine.isFinished()).toBe(true)

    snapshot = engine.getSnapshot()

    expect(snapshot.sharedMemory).toEqual({
      buffer: 42,
      consumido: 42,
    })
    expect(snapshot.semaphores).toEqual([
      {
        name: 'vacio',
        value: 1,
        waitingProcessIds: [],
      },
      {
        name: 'lleno',
        value: 0,
        waitingProcessIds: [],
      },
    ])
    expect(snapshot.processes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'Consumidor',
          state: 'FINISHED',
        }),
        expect.objectContaining({
          id: 'Productor',
          state: 'FINISHED',
        }),
      ]),
    )

    expect(
      engine.getState().history
        .filter((event) => event.semaphoreEvent)
        .map((event) => ({
          processId: event.processId,
          semaphoreName:
            event.semaphoreEvent?.semaphoreName,
          operation: event.semaphoreEvent?.operation,
          status: event.semaphoreEvent?.status,
          transition:
            `${event.semaphoreEvent?.valueBefore}->${event.semaphoreEvent?.valueAfter}`,
        })),
    ).toEqual([
      {
        processId: 'Consumidor',
        semaphoreName: 'lleno',
        operation: 'P',
        status: 'BLOCKED',
        transition: '0->0',
      },
      {
        processId: 'Productor',
        semaphoreName: 'vacio',
        operation: 'P',
        status: 'SUCCEEDED',
        transition: '1->0',
      },
      {
        processId: 'Productor',
        semaphoreName: 'lleno',
        operation: 'V',
        status: 'SUCCEEDED',
        transition: '0->1',
      },
      {
        processId: 'Consumidor',
        semaphoreName: 'lleno',
        operation: 'P',
        status: 'SUCCEEDED',
        transition: '1->0',
      },
      {
        processId: 'Consumidor',
        semaphoreName: 'vacio',
        operation: 'V',
        status: 'SUCCEEDED',
        transition: '0->1',
      },
    ])

    expect(snapshot.memoryAccessConflicts).toEqual([
      expect.objectContaining({
        classification: 'SYNCHRONIZED',
        reason: {
          type: 'SEMAPHORE_SIGNALING',
          semaphoreName: 'lleno',
        },
      }),
    ])
  })

  it('blocks a producer when a counted buffer has no free slots', () => {
    const engine = new SimulationEngine(
      createExecutionState(
        parseProgram(countedBufferSource),
      ),
      new FirstReadyScheduler(),
      100,
    )

    while (
      !engine.getState().history.some(
        (event) =>
          event.processId === 'Productor'
          && event.semaphoreEvent?.operation === 'P'
          && event.semaphoreEvent.semaphoreName === 'vacio'
          && event.semaphoreEvent.status === 'BLOCKED',
      )
    ) {
      expect(engine.step()).toBe(true)
    }

    let snapshot = engine.getSnapshot()

    expect(snapshot.sharedMemory).toEqual({
      buffer: [10, 20],
      consumidos: [0, 0, 0],
    })
    expect(snapshot.semaphores).toEqual([
      {
        name: 'vacio',
        value: 0,
        waitingProcessIds: ['Productor'],
      },
      {
        name: 'lleno',
        value: 2,
        waitingProcessIds: [],
      },
    ])
    expect(
      snapshot.processes.find(
        (process) => process.id === 'Productor',
      ),
    ).toMatchObject({
      state: 'BLOCKED',
      blockingReason: {
        type: 'SEMAPHORE_P',
        semaphoreName: 'vacio',
      },
    })

    while (!engine.isFinished()) {
      expect(engine.step()).toBe(true)

      for (const semaphore of engine.getSnapshot().semaphores) {
        expect(semaphore.value).toBeGreaterThanOrEqual(0)
        expect(semaphore.value).toBeLessThanOrEqual(2)
      }
    }

    snapshot = engine.getSnapshot()

    expect(snapshot.sharedMemory).toEqual({
      buffer: [30, 20],
      consumidos: [10, 20, 30],
    })
    expect(snapshot.semaphores).toEqual([
      {
        name: 'vacio',
        value: 2,
        waitingProcessIds: [],
      },
      {
        name: 'lleno',
        value: 0,
        waitingProcessIds: [],
      },
    ])
    expect(snapshot.processes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'Productor',
          state: 'FINISHED',
        }),
        expect.objectContaining({
          id: 'Consumidor',
          state: 'FINISHED',
        }),
      ]),
    )

    const semaphoreEvents = engine.getState().history
      .filter((event) => event.semaphoreEvent)
      .map((event) => ({
        processId: event.processId,
        semaphoreName:
          event.semaphoreEvent?.semaphoreName,
        operation: event.semaphoreEvent?.operation,
        status: event.semaphoreEvent?.status,
        transition:
          `${event.semaphoreEvent?.valueBefore}->${event.semaphoreEvent?.valueAfter}`,
      }))

    expect(semaphoreEvents).toEqual([
      {
        processId: 'Productor',
        semaphoreName: 'vacio',
        operation: 'P',
        status: 'SUCCEEDED',
        transition: '2->1',
      },
      {
        processId: 'Productor',
        semaphoreName: 'lleno',
        operation: 'V',
        status: 'SUCCEEDED',
        transition: '0->1',
      },
      {
        processId: 'Productor',
        semaphoreName: 'vacio',
        operation: 'P',
        status: 'SUCCEEDED',
        transition: '1->0',
      },
      {
        processId: 'Productor',
        semaphoreName: 'lleno',
        operation: 'V',
        status: 'SUCCEEDED',
        transition: '1->2',
      },
      {
        processId: 'Productor',
        semaphoreName: 'vacio',
        operation: 'P',
        status: 'BLOCKED',
        transition: '0->0',
      },
      {
        processId: 'Consumidor',
        semaphoreName: 'lleno',
        operation: 'P',
        status: 'SUCCEEDED',
        transition: '2->1',
      },
      {
        processId: 'Consumidor',
        semaphoreName: 'vacio',
        operation: 'V',
        status: 'SUCCEEDED',
        transition: '0->1',
      },
      {
        processId: 'Productor',
        semaphoreName: 'vacio',
        operation: 'P',
        status: 'SUCCEEDED',
        transition: '1->0',
      },
      {
        processId: 'Productor',
        semaphoreName: 'lleno',
        operation: 'V',
        status: 'SUCCEEDED',
        transition: '1->2',
      },
      {
        processId: 'Consumidor',
        semaphoreName: 'lleno',
        operation: 'P',
        status: 'SUCCEEDED',
        transition: '2->1',
      },
      {
        processId: 'Consumidor',
        semaphoreName: 'vacio',
        operation: 'V',
        status: 'SUCCEEDED',
        transition: '0->1',
      },
      {
        processId: 'Consumidor',
        semaphoreName: 'lleno',
        operation: 'P',
        status: 'SUCCEEDED',
        transition: '1->0',
      },
      {
        processId: 'Consumidor',
        semaphoreName: 'vacio',
        operation: 'V',
        status: 'SUCCEEDED',
        transition: '1->2',
      },
    ])

    expect(
      snapshot.memoryAccessConflicts.length,
    ).toBeGreaterThan(0)
    expect(
      snapshot.memoryAccessConflicts.every(
        (conflict) =>
          conflict.classification === 'SYNCHRONIZED'
          && conflict.reason.type === 'ATOMIC_REGION',
      ),
    ).toBe(true)
  })

  it('keeps three processes behind a one-shot barrier until all arrive', () => {
    const engine = new SimulationEngine(
      createExecutionState(
        parseProgram(threeProcessBarrierSource),
      ),
      new RoundRobinScheduler(),
      150,
    )

    let maximumBarrierWaiters = 0

    while (!engine.isFinished()) {
      expect(engine.step()).toBe(true)

      const snapshot = engine.getSnapshot()
      const barrier = snapshot.semaphores.find(
        (semaphore) => semaphore.name === 'barrera',
      )

      maximumBarrierWaiters = Math.max(
        maximumBarrierWaiters,
        barrier?.waitingProcessIds.length ?? 0,
      )

      const crossedProcesses = snapshot.processes
        .filter(
          (process) =>
            process.localMemory.continuo === true,
        )

      if (crossedProcesses.length > 0) {
        expect(snapshot.sharedMemory.contador).toBe(3)
      }
    }

    const snapshot = engine.getSnapshot()

    expect(snapshot.sharedMemory.contador).toBe(3)
    expect(snapshot.semaphores).toEqual([
      {
        name: 'mutex',
        value: 1,
        waitingProcessIds: [],
      },
      {
        name: 'barrera',
        value: 0,
        waitingProcessIds: [],
      },
    ])
    expect(snapshot.processes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'Chico1',
          state: 'FINISHED',
          localMemory: {
            continuo: true,
          },
        }),
        expect.objectContaining({
          id: 'Chico2',
          state: 'FINISHED',
          localMemory: {
            continuo: true,
          },
        }),
        expect.objectContaining({
          id: 'Chico3',
          state: 'FINISHED',
          localMemory: {
            continuo: true,
          },
        }),
      ]),
    )
    expect(maximumBarrierWaiters).toBeGreaterThanOrEqual(2)

    const semaphoreHistory = engine.getState().history
      .filter((event) => event.semaphoreEvent)

    const barrierSignals = semaphoreHistory.filter(
      (event) =>
        event.semaphoreEvent?.operation === 'V'
        && event.semaphoreEvent.semaphoreName === 'barrera',
    )
    const successfulBarrierWaits = semaphoreHistory.filter(
      (event) =>
        event.semaphoreEvent?.operation === 'P'
        && event.semaphoreEvent.semaphoreName === 'barrera'
        && event.semaphoreEvent.status === 'SUCCEEDED',
    )

    expect(barrierSignals).toHaveLength(3)
    expect(successfulBarrierWaits).toHaveLength(3)
    expect(
      new Set(
        barrierSignals.map((event) => event.processId),
      ).size,
    ).toBe(1)

    for (const processId of [
      'Chico1',
      'Chico2',
      'Chico3',
    ]) {
      const mutexReleaseIndex = semaphoreHistory.findIndex(
        (event) =>
          event.processId === processId
          && event.semaphoreEvent?.operation === 'V'
          && event.semaphoreEvent.semaphoreName === 'mutex',
      )
      const barrierWaitIndex = semaphoreHistory.findIndex(
        (event) =>
          event.processId === processId
          && event.semaphoreEvent?.operation === 'P'
          && event.semaphoreEvent.semaphoreName === 'barrera',
      )

      expect(mutexReleaseIndex).toBeGreaterThanOrEqual(0)
      expect(barrierWaitIndex).toBeGreaterThan(
        mutexReleaseIndex,
      )
    }

    expect(
      snapshot.memoryAccessConflicts.length,
    ).toBeGreaterThan(0)
    expect(
      snapshot.memoryAccessConflicts.every(
        (conflict) =>
          conflict.classification === 'SYNCHRONIZED'
          && conflict.reason.type === 'SEMAPHORE_MUTEX'
          && conflict.reason.semaphoreName === 'mutex',
      ),
    ).toBe(true)
  })

  it('allows concurrent readers while keeping a writer exclusive', () => {
    const engine = new SimulationEngine(
      createExecutionState(
        parseProgram(readerPreferenceSource),
      ),
      new RoundRobinScheduler(),
      250,
    )

    let maximumActiveReaders = 0
    let observedConcurrentReaders = false
    let observedBlockedWriter = false

    while (!engine.isFinished()) {
      expect(engine.step()).toBe(true)

      const snapshot = engine.getSnapshot()
      const activeReaders = snapshot.sharedMemory.nr

      expect(activeReaders).toBeGreaterThanOrEqual(0)
      expect(activeReaders).toBeLessThanOrEqual(2)

      maximumActiveReaders = Math.max(
        maximumActiveReaders,
        activeReaders as number,
      )

      const reader1 = snapshot.processes.find(
        (process) => process.id === 'Lector1',
      )
      const reader2 = snapshot.processes.find(
        (process) => process.id === 'Lector2',
      )
      const writer = snapshot.processes.find(
        (process) => process.id === 'Escritor',
      )

      if (
        reader1?.localMemory.leyendo === true
        && reader2?.localMemory.leyendo === true
      ) {
        observedConcurrentReaders = true
        expect(snapshot.sharedMemory.nr).toBe(2)
        expect(snapshot.sharedMemory.baseDatos).toBe(0)
      }

      if (
        writer?.state === 'BLOCKED'
        && writer.blockingReason?.type === 'SEMAPHORE_P'
        && writer.blockingReason.semaphoreName === 'rw'
      ) {
        expect(snapshot.sharedMemory.baseDatos).toBe(0)

        if ((snapshot.sharedMemory.nr as number) > 0) {
          observedBlockedWriter = true
        }
      }

      if (snapshot.sharedMemory.baseDatos === 42) {
        expect(snapshot.sharedMemory.nr).toBe(0)
        expect(reader1?.localMemory.leyendo).toBe(false)
        expect(reader2?.localMemory.leyendo).toBe(false)
      }
    }

    const snapshot = engine.getSnapshot()

    expect(maximumActiveReaders).toBe(2)
    expect(observedConcurrentReaders).toBe(true)
    expect(observedBlockedWriter).toBe(true)
    expect(snapshot.sharedMemory).toEqual({
      nr: 0,
      baseDatos: 42,
      lectura1: 0,
      lectura2: 0,
    })
    expect(snapshot.semaphores).toEqual([
      {
        name: 'rw',
        value: 1,
        waitingProcessIds: [],
      },
      {
        name: 'mutexR',
        value: 1,
        waitingProcessIds: [],
      },
    ])
    expect(snapshot.processes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'Lector1',
          state: 'FINISHED',
          localMemory: {
            leyendo: false,
            comprobacion: 4,
          },
        }),
        expect.objectContaining({
          id: 'Lector2',
          state: 'FINISHED',
          localMemory: {
            leyendo: false,
            comprobacion: 4,
          },
        }),
        expect.objectContaining({
          id: 'Escritor',
          state: 'FINISHED',
          localMemory: {
            preparacion: 6,
          },
        }),
      ]),
    )

    const semaphoreHistory = engine.getState().history
      .filter((event) => event.semaphoreEvent)
    const writerWaits = semaphoreHistory.filter(
      (event) =>
        event.processId === 'Escritor'
        && event.semaphoreEvent?.operation === 'P'
        && event.semaphoreEvent.semaphoreName === 'rw'
        && event.semaphoreEvent.status === 'BLOCKED',
    )
    const readerRwAcquisitions = semaphoreHistory.filter(
      (event) =>
        event.processId.startsWith('Lector')
        && event.semaphoreEvent?.operation === 'P'
        && event.semaphoreEvent.semaphoreName === 'rw'
        && event.semaphoreEvent.status === 'SUCCEEDED',
    )
    const readerRwReleases = semaphoreHistory.filter(
      (event) =>
        event.processId.startsWith('Lector')
        && event.semaphoreEvent?.operation === 'V'
        && event.semaphoreEvent.semaphoreName === 'rw',
    )

    expect(writerWaits.length).toBeGreaterThan(0)
    expect(readerRwAcquisitions).toHaveLength(1)
    expect(readerRwReleases).toHaveLength(1)

    expect(
      snapshot.memoryAccessConflicts.length,
    ).toBeGreaterThan(0)
    expect(
      snapshot.memoryAccessConflicts.every(
        (conflict) =>
          conflict.classification === 'SYNCHRONIZED',
      ),
    ).toBe(true)
    expect(
      new Set(
        snapshot.memoryAccessConflicts.map(
          (conflict) => conflict.reason.type,
        ),
      ),
    ).toEqual(
      new Set([
        'ATOMIC_REGION',
        'SEMAPHORE_MUTEX',
      ]),
    )
  })

  it('avoids dining-philosopher deadlock while preserving selective mutual exclusion', () => {
    const engine = new SimulationEngine(
      createExecutionState(
        parseProgram(diningPhilosophersSource),
      ),
      new RoundRobinScheduler(),
      400,
    )

    const forkHolders = new Map<string, string>()
    let maximumConcurrentPhilosophers = 0
    let observedNonNeighborOverlap = false
    let observedBlockedPhilosopher = false

    while (!engine.isFinished()) {
      const previousHistoryLength =
        engine.getState().history.length

      expect(engine.step()).toBe(true)

      const newEvents = engine.getState().history.slice(
        previousHistoryLength,
      )

      for (const event of newEvents) {
        const semaphoreEvent = event.semaphoreEvent

        if (!semaphoreEvent) {
          continue
        }

        if (semaphoreEvent.status === 'BLOCKED') {
          observedBlockedPhilosopher = true
          continue
        }

        if (semaphoreEvent.operation === 'P') {
          expect(
            forkHolders.has(semaphoreEvent.semaphoreName),
          ).toBe(false)
          forkHolders.set(
            semaphoreEvent.semaphoreName,
            event.processId,
          )
          continue
        }

        expect(
          forkHolders.get(semaphoreEvent.semaphoreName),
        ).toBe(event.processId)
        forkHolders.delete(semaphoreEvent.semaphoreName)
      }

      const eatingPhilosophers = engine.getSnapshot().processes
        .filter(
          (process) => process.localMemory.comiendo === true,
        )
        .map((process) => Number(process.id.at(-1)))

      maximumConcurrentPhilosophers = Math.max(
        maximumConcurrentPhilosophers,
        eatingPhilosophers.length,
      )

      for (let first = 0; first < eatingPhilosophers.length; first += 1) {
        for (
          let second = first + 1;
          second < eatingPhilosophers.length;
          second += 1
        ) {
          const distance = Math.abs(
            eatingPhilosophers[first]
            - eatingPhilosophers[second],
          )

          expect([1, 4]).not.toContain(distance)
          observedNonNeighborOverlap = true
        }
      }
    }

    const snapshot = engine.getSnapshot()
    const semaphoreHistory = engine.getState().history
      .filter((event) => event.semaphoreEvent)

    expect(engine.isFinished()).toBe(true)
    expect(snapshot.semaphores).toEqual(
      [0, 1, 2, 3, 4].map((index) => ({
        name: `tenedor${index}`,
        value: 1,
        waitingProcessIds: [],
      })),
    )
    expect(snapshot.processes).toHaveLength(5)
    expect(
      snapshot.processes.every(
        (process) =>
          process.state === 'FINISHED'
          && process.localMemory.comiendo === false
          && process.localMemory.bocados === 4,
      ),
    ).toBe(true)
    expect(maximumConcurrentPhilosophers).toBeGreaterThanOrEqual(2)
    expect(observedNonNeighborOverlap).toBe(true)
    expect(observedBlockedPhilosopher).toBe(true)
    expect(forkHolders.size).toBe(0)

    for (let philosopher = 0; philosopher < 5; philosopher += 1) {
      const processId = `Filosofo${philosopher}`
      const successfulAcquisitions = semaphoreHistory.filter(
        (event) =>
          event.processId === processId
          && event.semaphoreEvent?.operation === 'P'
          && event.semaphoreEvent.status === 'SUCCEEDED',
      )
      const releases = semaphoreHistory.filter(
        (event) =>
          event.processId === processId
          && event.semaphoreEvent?.operation === 'V',
      )

      expect(successfulAcquisitions).toHaveLength(2)
      expect(releases).toHaveLength(2)
    }

    expect(
      semaphoreHistory
        .filter(
          (event) =>
            event.processId === 'Filosofo4'
            && event.semaphoreEvent?.operation === 'P'
            && event.semaphoreEvent.status === 'SUCCEEDED',
        )
        .map(
          (event) => event.semaphoreEvent?.semaphoreName,
        ),
    ).toEqual(['tenedor0', 'tenedor4'])

    expect(snapshot.memoryAccessConflicts).toHaveLength(0)
  })
})
