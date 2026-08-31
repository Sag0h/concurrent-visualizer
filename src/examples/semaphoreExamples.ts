import type { ProgramExample } from './ProgramExample'

export const candyMutualExclusionProblemExample = {
  id: 'semaphore-candy-mutual-exclusion-problem',
  topicId: 'candy-mutual-exclusion',
  title: 'Exclusión mutua: contador de caramelos',
  category: 'SEMAPHORES',
  variant: 'PROBLEM',
  description: 'Los dos procesos incrementan el contador sin mutex: pueden leer el mismo valor y perder una actualización.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `shared int cant = 0;

process Chico1 {
    cant = cant + 1;
}

process Chico2 {
    cant = cant + 1;
}`,
} satisfies ProgramExample

export const eventSignalingProblemExample = {
  id: 'semaphore-event-signaling-problem',
  topicId: 'event-signaling',
  title: 'Señalización de evento',
  category: 'SEMAPHORES',
  variant: 'PROBLEM',
  description: 'El coordinador olvida ejecutar V(inicio), por lo que el trabajador queda bloqueado para siempre.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `sem inicio = 0;

process Trabajador {
    P(inicio);
    bool comenzo = true;
}

process Coordinador {
    bool olvidoSenal = true;
}`,
} satisfies ProgramExample

export const multipleWaitersProblemExample = {
  id: 'semaphore-multiple-waiters-problem',
  topicId: 'multiple-waiters',
  title: 'Múltiples procesos esperando',
  category: 'SEMAPHORES',
  variant: 'PROBLEM',
  description: 'Hay dos trabajadores esperando, pero el coordinador emite una sola señal: uno queda bloqueado.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `sem inicio = 0;

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
}`,
} satisfies ProgramExample

export const countingSemaphoreProblemExample = {
  id: 'semaphore-counting-resource-problem',
  topicId: 'counting-resource',
  title: 'Semáforo contador',
  category: 'SEMAPHORES',
  variant: 'PROBLEM',
  description: 'El recurso sólo admite dos usuarios, pero los trabajadores ignoran el semáforo y pueden entrar los tres.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `sem recursos = 2;
shared int enUso = 0;
shared int maximoObservado = 0;

process Trabajador1 {
    atomic {
        enUso = enUso + 1;
        if (enUso > maximoObservado) {
            maximoObservado = enUso;
        }
    }
    int trabajo = 1;
    atomic {
        enUso = enUso - 1;
    }
}

process Trabajador2 {
    atomic {
        enUso = enUso + 1;
        if (enUso > maximoObservado) {
            maximoObservado = enUso;
        }
    }
    int trabajo = 2;
    atomic {
        enUso = enUso - 1;
    }
}

process Trabajador3 {
    atomic {
        enUso = enUso + 1;
        if (enUso > maximoObservado) {
            maximoObservado = enUso;
        }
    }
    int trabajo = 3;
    atomic {
        enUso = enUso - 1;
    }
}`,
} satisfies ProgramExample

export const unitBufferProblemExample = {
  id: 'semaphore-unit-buffer-problem',
  topicId: 'unit-buffer',
  title: 'Productor/Consumidor: buffer unitario',
  category: 'SEMAPHORES',
  variant: 'PROBLEM',
  description: 'El productor escribe el dato pero olvida avisar con V(lleno), dejando bloqueado al consumidor.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `sem vacio = 1;
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
}`,
} satisfies ProgramExample

export const countedBufferProblemExample = {
  id: 'semaphore-counted-buffer-problem',
  topicId: 'counted-buffer',
  title: 'Productor/Consumidor: buffer con capacidad',
  category: 'SEMAPHORES',
  variant: 'PROBLEM',
  description: 'La tercera producción ignora P(vacio) y sobrescribe un dato antes de que pueda ser consumido.',
  recommendedScheduler: 'FIRST_READY',
  source: `sem vacio = 2;
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
}`,
} satisfies ProgramExample

export const threeProcessBarrierProblemExample = {
  id: 'semaphore-three-process-barrier-problem',
  topicId: 'three-process-barrier',
  title: 'Barrera de tres procesos',
  category: 'SEMAPHORES',
  variant: 'PROBLEM',
  description: 'El último proceso libera sólo dos permisos; uno de los tres participantes nunca atraviesa la barrera.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `sem mutex = 1;
sem barrera = 0;
shared int contador = 0;

process Chico1 {
    P(mutex);
    contador = contador + 1;
    if (contador == 3) {
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
    }
    V(mutex);
    P(barrera);
    bool continuo = true;
}`,
} satisfies ProgramExample

export const readerPreferenceProblemExample = {
  id: 'semaphore-reader-preference-problem',
  topicId: 'reader-preference',
  title: 'Lectores/Escritores con preferencia de lectores',
  category: 'SEMAPHORES',
  variant: 'PROBLEM',
  description: 'El escritor modifica la base sin adquirir rw, por lo que puede interferir con una lectura activa.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `sem rw = 1;
sem mutexR = 1;
shared int nr = 0;
shared int baseDatos = 0;
shared int lectura = 0;

process Lector {
    P(mutexR);
    nr = nr + 1;
    if (nr == 1) {
        P(rw);
    }
    V(mutexR);

    lectura = baseDatos;

    P(mutexR);
    nr = nr - 1;
    if (nr == 0) {
        V(rw);
    }
    V(mutexR);
}

process Escritor {
    baseDatos = 42;
}`,
} satisfies ProgramExample

export const diningPhilosophersProblemExample = {
  id: 'semaphore-dining-philosophers-problem',
  topicId: 'dining-philosophers',
  title: 'Filósofos comensales',
  category: 'SEMAPHORES',
  variant: 'PROBLEM',
  description: 'Todos toman primero el tenedor izquierdo: Round Robin reproduce una espera circular entre los cinco.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `sem tenedor0 = 1;
sem tenedor1 = 1;
sem tenedor2 = 1;
sem tenedor3 = 1;
sem tenedor4 = 1;

process Filosofo0 {
    P(tenedor0);
    P(tenedor1);
    bool comiendo = true;
}

process Filosofo1 {
    P(tenedor1);
    P(tenedor2);
    bool comiendo = true;
}

process Filosofo2 {
    P(tenedor2);
    P(tenedor3);
    bool comiendo = true;
}

process Filosofo3 {
    P(tenedor3);
    P(tenedor4);
    bool comiendo = true;
}

process Filosofo4 {
    P(tenedor4);
    P(tenedor0);
    bool comiendo = true;
}`,
} satisfies ProgramExample

export const candyMutualExclusionExample = {
  id: 'semaphore-candy-mutual-exclusion',
  topicId: 'candy-mutual-exclusion',
  title: 'Exclusión mutua: contador de caramelos',
  category: 'SEMAPHORES',
  variant: 'SOLUTION',
  description: 'Dos procesos actualizan un contador compartido protegiéndolo con un semáforo mutex.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `sem mutex = 1;
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
}`,
} satisfies ProgramExample

export const eventSignalingExample = {
  id: 'semaphore-event-signaling',
  topicId: 'event-signaling',
  title: 'Señalización de evento',
  category: 'SEMAPHORES',
  variant: 'SOLUTION',
  description: 'Un trabajador espera hasta que el coordinador anuncia que puede comenzar.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `sem inicio = 0;

process Trabajador {
    P(inicio);
    bool comenzo = true;
}

process Coordinador {
    V(inicio);
}`,
} satisfies ProgramExample

export const multipleWaitersExample = {
  id: 'semaphore-multiple-waiters',
  topicId: 'multiple-waiters',
  title: 'Múltiples procesos esperando',
  category: 'SEMAPHORES',
  variant: 'SOLUTION',
  description: 'Muestra que cada proceso bloqueado necesita su propia señal V.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `sem inicio = 0;

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
}`,
} satisfies ProgramExample

export const countingSemaphoreExample = {
  id: 'semaphore-counting-resource',
  topicId: 'counting-resource',
  title: 'Semáforo contador',
  category: 'SEMAPHORES',
  variant: 'SOLUTION',
  description: 'Tres trabajadores comparten dos unidades disponibles de un recurso.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `sem recursos = 2;

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
}`,
} satisfies ProgramExample

export const unitBufferExample = {
  id: 'semaphore-unit-buffer',
  topicId: 'unit-buffer',
  title: 'Productor/Consumidor: buffer unitario',
  category: 'SEMAPHORES',
  variant: 'SOLUTION',
  description: 'Coordina un productor y un consumidor con semáforos de espacio vacío y dato disponible.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `sem vacio = 1;
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
}`,
} satisfies ProgramExample

export const countedBufferExample = {
  id: 'semaphore-counted-buffer',
  topicId: 'counted-buffer',
  title: 'Productor/Consumidor: buffer con capacidad',
  category: 'SEMAPHORES',
  variant: 'SOLUTION',
  description: 'Representa un buffer de dos lugares y hace visible el bloqueo cuando se completa.',
  recommendedScheduler: 'FIRST_READY',
  source: `sem vacio = 2;
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
}`,
} satisfies ProgramExample

export const threeProcessBarrierExample = {
  id: 'semaphore-three-process-barrier',
  topicId: 'three-process-barrier',
  title: 'Barrera de tres procesos',
  category: 'SEMAPHORES',
  variant: 'SOLUTION',
  description: 'Ningún proceso continúa hasta que los tres alcanzan la barrera.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `sem mutex = 1;
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
}`,
} satisfies ProgramExample

export const readerPreferenceExample = {
  id: 'semaphore-reader-preference',
  topicId: 'reader-preference',
  title: 'Lectores/Escritores con preferencia de lectores',
  category: 'SEMAPHORES',
  variant: 'SOLUTION',
  description: 'Permite lectores concurrentes mientras el escritor conserva acceso exclusivo.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `sem rw = 1;
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
}`,
} satisfies ProgramExample

export const diningPhilosophersExample = {
  id: 'semaphore-dining-philosophers',
  topicId: 'dining-philosophers',
  title: 'Filósofos comensales sin deadlock',
  category: 'SEMAPHORES',
  variant: 'SOLUTION',
  description: 'Cinco filósofos adquieren tenedores con un orden asimétrico que evita la espera circular.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `sem tenedor0 = 1;
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
}`,
} satisfies ProgramExample

export const semaphoreExamples = [
  candyMutualExclusionProblemExample,
  candyMutualExclusionExample,
  eventSignalingProblemExample,
  eventSignalingExample,
  multipleWaitersProblemExample,
  multipleWaitersExample,
  countingSemaphoreProblemExample,
  countingSemaphoreExample,
  unitBufferProblemExample,
  unitBufferExample,
  countedBufferProblemExample,
  countedBufferExample,
  threeProcessBarrierProblemExample,
  threeProcessBarrierExample,
  readerPreferenceProblemExample,
  readerPreferenceExample,
  diningPhilosophersProblemExample,
  diningPhilosophersExample,
] as const satisfies readonly ProgramExample[]
