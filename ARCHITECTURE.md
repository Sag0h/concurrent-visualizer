# Concurrent Visualizer --- Arquitectura

> Este documento describe la arquitectura vigente. Debe actualizarse
> cuando el diseño real cambie.

## 1. Visión

Concurrent Visualizer es una aplicación web educativa capaz de
interpretar y simular pseudocódigo concurrente.

El objetivo no es crear animaciones prefabricadas para problemas
específicos. Los problemas deben emerger de la ejecución real del
programa ingresado.

Flujo vigente:

``` text
Código fuente
    ↓
Tokenizer
    ↓
Parser
    ↓
AST / Program
    ↓
Simulation Engine
    ↓
ExecutionState / SimulationSnapshot
    ↓
Visualización / Análisis
```

## 2. Stack

-   React
-   TypeScript
-   Vite
-   ESLint
-   Git

Previstos cuando sean necesarios:

-   Tailwind CSS;
-   React Flow para visualizaciones de procesos, recursos y canales.

No se requiere backend para la primera versión.

## 3. Principio fundamental

El motor de simulación es independiente de React.

La UI consume el estado producido por el motor, pero no contiene la
lógica de concurrencia.

Esto permite:

-   probar el motor mediante tests;
-   ejecutar análisis sin renderizar la UI;
-   cambiar la interfaz sin modificar la semántica;
-   explorar múltiples ejecuciones programáticamente;
-   reutilizar el mismo motor para distintos modelos de concurrencia.

## 4. Estructura general

La arquitectura se organiza alrededor de un núcleo de simulación
separado de la interfaz.

Estructura conceptual:

``` text
src/
├── core/
│   ├── engine/
│   ├── scheduler/
│   ├── process/
│   ├── instructions/
│   ├── expressions/
│   ├── memory/
│   └── analysis/
├── components/
└── App.tsx
```

La estructura exacta puede evolucionar a medida que se incorporen nuevas
primitivas concurrentes.

## 5. Entidades fundamentales

### Program

`Program` representa un programa concurrente completo.

Actualmente contiene:

-   procesos;
-   memoria compartida;
-   definiciones de funciones;
-   semáforos.

Los semáforos forman parte del programa, pero permanecen separados de la
memoria compartida ordinaria. Esta separación es semántica: un semáforo
es un recurso de sincronización y no una variable `int` común accesible
mediante asignaciones del lenguaje.

A futuro `Program` podrá incorporar monitores, canales y configuración
adicional del modelo de ejecución.

### Semaphore

Un `Semaphore` representa actualmente un semáforo general/contador:

``` ts
interface Semaphore {
    readonly name: string
    value: number
}
```

El valor es un entero no negativo. En V1 no existe un tipo especial de
semáforo binario: un semáforo general inicializado en `1` puede
utilizarse para exclusión mutua cuando los procesos respetan
correctamente el protocolo `P` / `V`.

El objeto no mantiene:

-   owner;
-   cola FIFO de procesos;
-   política de fairness;
-   permisos reservados durante la reactivación.

Los procesos que esperan un semáforo se representan mediante su propio
estado y `blockingReason`.

### Process

`Process` representa una unidad de ejecución concurrente.

Cada proceso mantiene estado propio, incluyendo:

-   identificador;
-   estado;
-   program counter;
-   instrucciones;
-   memoria local;
-   execution stack;
-   call stack;
-   evaluaciones suspendidas;
-   estado temporal de microoperaciones;
-   profundidad atómica;
-   motivo de bloqueo cuando corresponde.

Estados soportados:

``` text
READY
RUNNING
BLOCKED
FINISHED
```

`BLOCKED` se utiliza actualmente tanto para `await` como para una
operación `P(s)` que no puede completarse.

### BlockingReason

El proceso conserva por qué está bloqueado. Actualmente existen al menos
dos motivos conceptuales:

``` text
AWAIT(condition)
SEMAPHORE_P(semaphoreName)
```

Para `await` se conserva la condición necesaria para reevaluarla.

Para `P` se conserva el nombre del semáforo esperado.

Esta información pertenece al proceso y no implica una cola FIFO dentro
del recurso.

### Instruction

`Instruction` representa una instrucción visible del pseudocódigo.

La capa concurrente incluye actualmente instrucciones como:

``` text
atomic { ... }
await (B);
await (B) { ... }
P(mutex);
V(mutex);
```

`P` y `V` tienen nodos propios del AST (`SEMAPHORE_P` y `SEMAPHORE_V`).

Una instrucción fuente no constituye necesariamente una única acción
atómica del simulador. Cuando contiene operaciones relevantes para la
interferencia puede descomponerse en microoperaciones internas.

### MicroOperation

Una microoperación constituye la unidad mínima de ejecución atómica del
motor cuando una instrucción requiere descomposición concurrente.

Por ejemplo:

``` text
x = x + 1;
```

puede ejecutarse conceptualmente como:

``` text
SHARED_READ x
COMPUTE
SHARED_WRITE x
```

Entre microoperaciones el scheduler puede seleccionar otro proceso salvo
cuando una región de atomicidad activa lo impide.

`P` y `V`, en cambio, son operaciones de sincronización atómicas por sí
mismas y no se modelan como accesos ordinarios a memoria compartida.

## 6. Runtime de expresiones suspendibles

El evaluador inmediato sirve para expresiones puras, pero no para
llamadas a funciones que pueden requerir múltiples instrucciones y
steps.

Cada proceso mantiene una pila de evaluaciones pendientes.
Conceptualmente:

``` text
Expression
    ↓
se detecta FUNCTION_CALL
    ↓
se suspende la instrucción
    ↓
la función se ejecuta mediante el call stack normal
    ↓
return
    ↓
la llamada se reemplaza por el valor retornado
    ↓
la expresión continúa
```

El mecanismo se utiliza en declaraciones, asignaciones, estructuras de
control, `return`, argumentos de funciones, `foreach` e índices/targets
de arrays.

Regla arquitectónica:

> Una expresión que pueda contener una llamada a función no debe
> evaluarse directamente como expresión inmediata sin pasar por el
> runtime suspendible.

Las guardas de `await` son una excepción deliberadamente restringida:
por ahora no admiten llamadas a funciones. Una guarda debe poder
evaluarse inmediatamente sobre el estado actual y producir un booleano.

## 7. Runtime de microoperaciones compartidas

Las asignaciones sobre memoria compartida pueden conservar estado
temporal entre steps.

El runtime mantiene conceptualmente:

``` text
SharedAssignmentRuntime
├── instruction
├── phase
├── pendingExpression
├── pendingTargetIndex
├── computedValue
└── targetLocation
```

Fases actuales:

``` text
READ
COMPUTE
TARGET_READ
WRITE
```

`READ` captura valores observados de memoria compartida. `COMPUTE`
evalúa la expresión restante. `TARGET_READ` resuelve lecturas
compartidas necesarias para determinar un target de array. `WRITE`
utiliza el valor y la ubicación ya resueltos.

Esto permite representar lost updates e interferencias reales sin
introducir comportamientos especiales para ejemplos concretos.

## 8. Captura de valores observados

Una lectura compartida captura el valor observado en ese instante.

Dos procesos ejecutando:

``` text
x = x + 1;
```

pueden producir:

``` text
P1 SHARED_READ  x = 0
P2 SHARED_READ  x = 0
P1 COMPUTE      1
P2 COMPUTE      1
P1 SHARED_WRITE x = 1
P2 SHARED_WRITE x = 1
```

El cambio posterior de `x` no modifica el valor ya observado por un
proceso.

La misma regla se aplica a lecturas utilizadas para resolver targets de
arrays.

## 9. MemoryLocation

Los accesos compartidos se representan mediante ubicaciones concretas:

``` text
VARIABLE(name)
ARRAY_ELEMENT(arrayName, index)
```

Por lo tanto `values[0]` y `values[1]` son ubicaciones diferentes.

`MemoryLocation` es utilizada por eventos de microoperación, historial
de accesos, detección y agrupación de conflictos, visualización y
futuros análisis de sincronización.

Los semáforos no son `MemoryLocation`: sus operaciones pertenecen al
subsistema de sincronización.

## 10. ExecutionState y SimulationSnapshot

`ExecutionState` representa el estado global mutable de una simulación e
incluye conceptualmente:

-   `Program`;
-   contador global de steps;
-   historial de instrucciones;
-   historial de microoperaciones.

El estado de los semáforos reside actualmente dentro de
`Program.semaphores`.

El historial de instrucciones fuente y el de microoperaciones permanecen
separados para ofrecer una vista cercana al código y otra orientada a
interleavings.

`SimulationSnapshot` expone una representación segura para la UI.
Actualmente incluye memoria, procesos, `blockingReason`, call stacks,
historial de microoperaciones, análisis de conflictos y snapshots de
semáforos.

Cada `SemaphoreSnapshot` contiene nombre, valor actual y los ids de los
procesos actualmente bloqueados en `P` sobre ese recurso. Esta última
información se deriva de `Process.blockingReason`; no se duplica como
estado mutable dentro del semáforo.

## 11. Scheduler

El scheduler decide qué proceso `READY` obtiene el próximo step.

Schedulers disponibles:

-   First Ready;
-   Round Robin;
-   Random reproducible mediante seed.

En condiciones normales puede cambiar de proceso entre microoperaciones.

Una región `atomic` activa es una excepción: mientras un proceso
ejecutable mantiene `atomicDepth > 0`, conserva la ejecución.

La reactivación de procesos bloqueados permanece separada de la política
del scheduler. Estar `READY` significa ser elegible para ejecutar; no
implica haber reservado una condición o recurso.

Esto es fundamental tanto para `await` como para semáforos.

## 12. SimulationEngine

`SimulationEngine` aplica transiciones válidas sobre `ExecutionState`.

API principal:

``` ts
engine.step()
engine.reset()
engine.getState()
engine.getSnapshot()
```

`step()` devuelve si hubo progreso real.

Antes de seleccionar el siguiente proceso, el engine puede reevaluar
procesos bloqueados por mecanismos cuya condición haya cambiado.

Conceptualmente:

``` text
inicio del step
    ↓
reevaluar procesos BLOCKED
    ↓
determinar procesos READY
    ↓
respetar atomicidad activa si corresponde
    ↓
scheduler selecciona proceso
    ↓
ejecutar transición
```

Un error de runtime no debe dejar un proceso permanentemente en
`RUNNING`.

Cuando una instrucción requiere microoperaciones, completar una
instrucción fuente puede necesitar múltiples llamadas a `step()`.

El estado inicial de la simulación se conserva mediante clonación
estructural, lo que permite que `reset()` restaure también los valores
iniciales de los semáforos que forman parte del `Program`.

## 13. Atomicidad explícita

El lenguaje soporta:

``` text
atomic {
    ...
}
```

Una región `atomic` es no intercalable, pero no elimina sus
microoperaciones.

`atomicDepth` representa regiones anidadas:

``` text
fuera de atomic       0
atomic exterior       1
atomic anidado        2
salida del anidado    1
salida del exterior   0
```

Mientras un proceso ejecutable mantiene `atomicDepth > 0`, conserva la
ejecución antes de consultar la política normal del scheduler.

El unwind por `return`, `break` y `continue` debe liberar correctamente
frames `EXIT_ATOMIC`. Las regiones vacías tampoco deben dejar
profundidad residual.

## 14. `await`: acción atómica condicional

El lenguaje soporta:

``` text
await (B);
```

y:

``` text
await (B) {
    S
}
```

Si `B` es falsa:

``` text
process.state = BLOCKED
blockingReason = AWAIT(B)
programCounter permanece en await
```

La espera no se implementa mediante busy waiting.

### Reactivación

Antes de una nueva selección del scheduler se pueden reevaluar las
guardas de procesos bloqueados.

Si una guarda pasa a ser verdadera, el proceso queda `READY`, pero la
reactivación no reserva la condición.

Si varios procesos quedan habilitados simultáneamente, todos pueden
quedar `READY`. El scheduler selecciona uno y ese proceso vuelve a
evaluar la guarda cuando intenta ejecutar el `await`.

Por ello un proceso reactivado puede volver a bloquearse.

### Cuerpo habilitado

Si `B` es verdadera, la comprobación exitosa y `S` forman una acción
atómica condicional.

El runtime reutiliza la infraestructura de `atomicDepth` para impedir un
interleaving entre la guarda exitosa y el final del cuerpo, manteniendo
visibles sus microoperaciones.

Por ahora:

-   la guarda debe producir `bool`;
-   no se permiten llamadas a funciones dentro de la guarda;
-   se rechaza `await` dentro de una región `atomic`;
-   sí pueden existir regiones `atomic` anidadas dentro del cuerpo
    habilitado.

## 15. Semáforos

La sintaxis escalar actual es:

``` text
sem mutex = 1;
sem available = 3;

process P1 {
    P(mutex);
    V(mutex);
}
```

Los semáforos son generales/contadores. No existe un subtipo binario.

### Operación `P`

Semántica conceptual:

``` text
P(s): < await (s > 0) s = s - 1; >
```

Cuando `s > 0`, comprobación y decremento forman una única operación
atómica y el proceso avanza.

Cuando `s == 0`:

``` text
process.state = BLOCKED
blockingReason = SEMAPHORE_P(s)
programCounter permanece en P(s)
```

### Operación `V`

Semántica conceptual:

``` text
V(s): < s = s + 1; >
```

`V` incrementa atómicamente y nunca bloquea.

Los semáforos generales no modelan ownership. Por ello el engine no
exige que el proceso que ejecuta `V` sea el mismo que previamente
ejecutó `P`.

### Reactivación sin reserva

Si `s > 0`, los procesos bloqueados esperando `P(s)` pueden pasar a
`READY`.

La reactivación no decrementa `s` ni reserva un permiso.

Por ejemplo, si dos procesos esperan un semáforo cuyo valor pasa de `0`
a `1`, ambos pueden quedar habilitados. El scheduler elige uno; el
proceso seleccionado reejecuta `P`, consume el recurso y el otro podrá
volver a bloquearse.

Se separan así tres conceptos:

``` text
habilitación
    ↓
selección por scheduler
    ↓
adquisición efectiva mediante P
```

### Relación con `atomicDepth`

`P` y `V` son operaciones atómicas, pero **no utilizan `atomicDepth`**.

Una sección:

``` text
P(mutex);
x = x + 1;
V(mutex);
```

no debe convertirse en una única región no intercalable. Otros procesos
pueden seguir ejecutando; simplemente no pueden atravesar correctamente
el mismo protocolo de exclusión mientras el recurso no esté disponible.

Utilizar `atomicDepth` desde `P` hasta `V` alteraría la semántica del
scheduler y sería incorrecto.

### Fairness y waiters

No se asume:

-   FIFO;
-   fairness débil o fuerte;
-   ownership;
-   reserva de permisos.

La UI muestra qué procesos esperan cada semáforo derivando esa
información de `blockingReason` y aclara que la colección es informativa,
sin orden FIFO.

### Eventos de semáforos

Los intentos de `P` y las ejecuciones de `V` producen metadata
estructurada dentro de `ExecutionEvent`:

-   operación `P` o `V`;
-   nombre del semáforo;
-   resultado `BLOCKED` o `SUCCEEDED`;
-   valor anterior y posterior.

Esta metadata permite visualizar `P` bloqueado, `P` exitoso y `V` sin
interpretar textos descriptivos ni convertir semáforos en accesos a
`MemoryLocation`.

## 16. Eventos y análisis de memoria

Los accesos compartidos relevantes producen `MicroOperationEvent` con
datos como step, proceso, tipo, descripción, `MemoryLocation` y
profundidad atómica.

Dos accesos son conflictivos cuando pertenecen a procesos diferentes,
afectan la misma ubicación y al menos uno es escritura.

La clasificación actual es:

``` text
POTENTIAL_RACE
SYNCHRONIZED
UNKNOWN
```

El criterio reconoce atomicidad explícita:

``` text
P1 normal + P2 normal -> POTENTIAL_RACE
P1 atomic + P2 normal -> POTENTIAL_RACE
P1 atomic + P2 atomic -> SYNCHRONIZED
```

Esta clasificación no constituye un detector formal de data races basado
en happens-before.

### Integración con semáforos

M7.6 agrega un análisis separado de la ejecución. A partir del historial
estructurado de `P` / `V`, reconstruye para cada microoperación las
secciones delimitadas por adquisiciones `P` exitosas y liberaciones `V`
del mismo proceso.

Un semáforo general se reconoce como mutex únicamente en la ejecución
observada cuando:

-   su valor inicial es `1`;
-   las adquisiciones observadas respetan `1 -> 0`;
-   las liberaciones observadas respetan `0 -> 1`;
-   el proceso que ejecuta `V` es el que abrió la sección candidata con
    `P`;
-   no se observan operaciones incompatibles, como un `V` extra.

Este último criterio es metadata del analizador, no ownership agregado a
la semántica del semáforo.

Dos accesos conflictivos protegidos por el mismo candidato válido se
clasifican como `SYNCHRONIZED` con razón `SEMAPHORE_MUTEX`. La protección
unilateral sigue siendo `POTENTIAL_RACE`. Si ambos accesos están dentro
de secciones delimitadas por el mismo semáforo pero el protocolo puede
ser contador, señalización o uso inválido, la clasificación es
`UNKNOWN`.

La UI presenta la razón y aclara que se analiza una traza observada. No
se incrementa `atomicDepth` entre `P` y `V` y no se modifica la elección
del scheduler.

## 17. Modelos de comunicación

No se crearán simuladores independientes por paradigma.

El núcleo común mantiene procesos, scheduler, estados, historial y
análisis:

``` text
Simulation Engine
├── Process / Scheduler
├── Shared Memory Subsystem
│   ├── ordinary shared memory
│   └── synchronization resources
└── Message Passing Subsystem (futuro)
```

Memoria compartida soporta actualmente:

-   variables y arrays compartidos;
-   microoperaciones;
-   análisis básico de accesos;
-   `atomic`;
-   `await`;
-   semáforos escalares `P` / `V`.

Quedan previstos monitores y variables condición.

Pasaje de mensajes permanece futuro: canales, `send`, `receive`,
comunicación asincrónica/sincrónica, RPC y Rendezvous.

El modo híbrido podrá existir, aunque la UI educativa podrá restringir
mecanismos según el paradigma estudiado.

## 18. Tiempo simulado

El tiempo real de JavaScript no será fundamento de la semántica
concurrente.

Cuando exista:

``` text
sleep(3)
```

representará ticks simulados, no segundos reales.

Esto preserva reproducibilidad, independencia de la máquina y análisis
programático de estados.

## 19. Lenguaje y parser actuales

La capa secuencial soporta variables, arrays, asignaciones, expresiones,
funciones, llamadas suspendibles, estructuras de control y `return`.

La capa concurrente soporta actualmente:

-   `process`;
-   memoria compartida;
-   microoperaciones compartidas;
-   `atomic`;
-   `await`;
-   declaraciones escalares `sem`;
-   `P`;
-   `V`.

Pipeline vigente:

``` text
Texto
    ↓
Tokenizer
    ↓
Parser descendente recursivo
    ↓
AST / Program
    ↓
SimulationEngine
```

Cada nueva primitiva debe integrarse en este pipeline y en el motor
general, no crear una ruta paralela.

La validación de declaraciones de semáforos ocurre durante parsing, pero
la resolución de una referencia utilizada por `P` / `V` ocurre
actualmente en runtime. Un nombre inexistente produce un error de
ejecución.

Próximas extensiones relevantes incluyen arrays de semáforos cuando sean
necesarios, monitores, pasaje de mensajes y tiempo simulado.

## 20. Análisis de errores

La base actual detecta conflictos observados sobre memoria compartida.

El objetivo posterior incluye:

-   análisis más preciso de sincronización/data races;
-   deadlock;
-   violaciones de exclusión mutua;
-   busy waiting;
-   starvation cuando sea razonablemente detectable;
-   bloqueos por comunicación;
-   estados inválidos.

Con semáforos ya existen recursos y procesos bloqueados suficientes para
comenzar a diseñar análisis de dependencias, pero el detector formal de
deadlock permanece en M8.

## 21. Exploración de interleavings

Una ejecución correcta no demuestra que un programa concurrente sea
correcto.

El sistema deberá explorar eventualmente elecciones alternativas del
scheduler, detectar estados repetidos y producir contraejemplos
reproducibles.

Las seeds y los historiales detallados existentes son fundamentos para
esa funcionalidad.

## 22. Problemas clásicos

Los problemas clásicos no se codifican como animaciones especiales.

Ejemplos:

-   Productor/Consumidor;
-   Lectores/Escritores;
-   Filósofos Comensales;
-   sección crítica;
-   barreras/señalización.

Deben expresarse como programas válidos y ejecutarse mediante el mismo
motor.

Los casos que necesiten características todavía ausentes ---por ejemplo
arrays de semáforos--- deben esperar a que el lenguaje pueda
representarlos fielmente en lugar de introducir excepciones específicas.

## 23. Fuente académica

La semántica de primitivas concurrentes sigue prioritariamente el
material de Programación Concurrente de la Facultad de Informática de la
UNLP utilizado en la cursada.

El material histórico puede orientar extensibilidad, pero las decisiones
semánticas concretas deben contrastarse con el enfoque vigente de la
cátedra.

Actualmente `await` está completado y semáforos se encuentra en
desarrollo.

El próximo trabajo de M7 es validar la implementación mediante casos
académicos expresados como programas normales del lenguaje.

Estos cambios deben reutilizar el núcleo existente de procesos,
scheduling, bloqueo, historial, snapshots y análisis, sin crear un
segundo motor de sincronización.
