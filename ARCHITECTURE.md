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

Las declaraciones parametrizadas `process Name[i:start..end]` se
expanden en el parser. Los extremos son inclusivos y pueden formar rangos
ascendentes o descendentes. Cada instancia recibe un identificador como
`Name[2]`, una copia estructural independiente del cuerpo y el índice
inicial en su memoria local.

El engine no necesita una clase especial para estas familias: después del
parseo son procesos ordinarios. Por eso schedulers, snapshots, forks,
claves canónicas y exploración los tratan automáticamente como unidades
independientes.

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
historial de microoperaciones, snapshots de semáforos, estado global,
deadlock, diagnósticos de liveness y análisis/resúmenes de conflictos de
memoria.

El snapshot de UI no debe convertirse en el estado de búsqueda de M9.
Omite deliberadamente detalles internos del runtime y contiene datos
derivados para presentación.

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

En la ejecución interactiva el scheduler seguirá siendo una política
externa que elige entre transiciones habilitadas. M9 deberá permitir que
el explorador fuerce una elección concreta sin incorporar el cursor de
Round Robin o el generador aleatorio al estado semántico del programa.

## 12. SimulationEngine

`SimulationEngine` aplica transiciones válidas sobre `ExecutionState`.

API principal:

``` ts
engine.step()
engine.getEnabledTransitions()
engine.stepTransition(transition)
engine.fork()
engine.reset()
engine.getState()
engine.getSnapshot()
```

`step()` devuelve si hubo progreso real.

M9.1 separa selección y ejecución sin cambiar el comportamiento de
`step()`. `getEnabledTransitions()` enumera de forma no mutante una
transición `PROCESS_STEP` por cada proceso que podría ejecutar. Una
transición registra el proceso, si reanudaría un bloqueo ya habilitado y
si la elección está forzada por atomicidad.

`stepTransition(transition)` valida que la elección siga habilitada,
reactiva las esperas derivadas y ejecuta exactamente ese proceso sin
consultar al scheduler. Esto permite construir ramas reproducibles; la
ejecución interactiva continúa usando la política seleccionada por el
usuario.

Un proceso bloqueado en `await` o `P` puede aparecer como transición
lógicamente habilitada sin que la enumeración cambie su estado. Si
existe una región `atomic` activa y habilitada, sólo se expone su
transición.

`fork()` crea un nuevo engine desde el estado intermedio actual mediante
`cloneExecutionState()`. Memoria, recursos, pilas, evaluaciones
suspendidas, microoperaciones e historiales no comparten estructuras
mutables con la rama original. El estado copiado se convierte en el
punto de `reset()` de la nueva rama.

El fork también clona el cursor o generador del scheduler para conservar
el comportamiento de `step()` fuera del explorador. Ese estado de
política es operativo y no formará parte de la futura clave semántica:
la exploración usará transiciones explícitas.

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
información de `blockingReason` y aclara que la colección es
informativa, sin orden FIFO.

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
clasifican como `SYNCHRONIZED` con razón `SEMAPHORE_MUTEX`. La
protección unilateral sigue siendo `POTENTIAL_RACE`. Si ambos accesos
están dentro de secciones delimitadas por el mismo semáforo pero el
protocolo puede ser contador, señalización o uso inválido, la
clasificación es `UNKNOWN`.

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

M8 detecta conflictos observados sobre memoria compartida, deadlock,
violaciones observadas de exclusión mutua y síntomas conservadores de
liveness sobre el estado y la traza alcanzados.

El progreso global se clasifica como:

``` text
RUNNING
TEMPORARILY_BLOCKED
FINISHED
DEADLOCK
STEP_LIMIT_REACHED
```

Existe deadlock cuando quedan procesos sin finalizar, no existe ningún
proceso `READY`/`RUNNING` y ninguna espera bloqueada está actualmente
habilitada. La reevaluación incluye condiciones de `await` y permisos de
semáforos, por lo que un bloqueo visible pero habilitable sigue siendo
temporal.

`src/core/deadlock/` permanece separado del runtime. Consume procesos,
razones de bloqueo, recursos e historial, pero no modifica scheduling ni
valores del programa.

Para semáforos reconstruye adquisiciones pendientes desde los eventos
`P` / `V`, genera dependencias `WAITS_FOR` y `HOLDS`, deriva un wait-for
graph entre procesos y detecta componentes fuertemente conexas. Un
autociclo también es válido cuando un proceso retiene una unidad y
espera otra del mismo recurso agotado.

La inferencia describe permisos observados; no agrega ownership al
semáforo. Cuando faltan poseedores inferibles o interviene `await`, el
estado puede diagnosticarse como bloqueo terminal con grafo parcial sin
afirmar una espera circular.

Los recursos usan una clase extensible:

``` text
SEMAPHORE | MONITOR | CHANNEL
```

Semáforos están integrados. Monitores y canales incorporarán sus propias
dependencias al introducirse esas primitivas, reutilizando el mismo
algoritmo de ciclos y la misma representación visual.

El objetivo posterior incluye:

-   bloqueos por comunicación;
-   estados inválidos.

La detección corresponde a la ejecución actual. Buscar un interleaving
alternativo que produzca deadlock permanece en M9.

### Diagnóstico de memoria compartida

El análisis conserva tres clasificaciones:

``` text
POTENTIAL_RACE | SYNCHRONIZED | UNKNOWN
```

Cada par incorpora además un diagnóstico educativo estructurado. La
protección de cada acceso describe `atomic`, mutex observados y
protocolos de semáforo ambiguos. Así se distinguen accesos sin
protección, protección unilateral, mecanismos incompatibles y un mutex
común válido.

El analizador toma snapshots de las secciones de semáforos activas para
todos los procesos en cada microoperación. Si un proceso accede a una
ubicación mientras otro conserva un mutex diferente, se registra
`MUTUAL_EXCLUSION_VIOLATION`. Sin ese solapamiento, la protección
inconsistente permanece como `POTENTIAL_DATA_RACE`.

### Límite de happens-before

La traza del simulador posee un orden total por número de paso, pero ese
orden es una elección del scheduler y no una relación causal entre
procesos. Usarlo como happens-before haría que todos los accesos
parecieran ordenados y eliminaría incorrectamente las races.

Un detector formal futuro necesita, como mínimo:

-   orden de programa por proceso;
-   aristas causales de cada primitiva de sincronización;
-   correspondencia de permisos en semáforos generales;
-   semántica para `await`, monitores y comunicación;
-   una representación como relojes vectoriales u otra relación parcial.

Hasta entonces, `POTENTIAL_RACE` significa conflicto observado sin
protección común reconocida. No es una prueba formal y permanece
separado de la exploración de estados de M9.

### Diagnósticos conservadores de liveness

`src/core/diagnostics/` analiza el estado y el historial sin modificar
la ejecución. Sus resultados estructurados incluyen código, severidad,
procesos, evidencia de la traza y una nota explícita de alcance.

El detector de busy waiting reconoce únicamente un patrón de alta
confianza: cuatro o más evaluaciones consecutivas que mantienen activo
un `while` o `repeat/until` vacío cuya condición lee memoria compartida.
No intenta clasificar bucles con cuerpo ni condiciones suspendibles.

El riesgo de starvation se informa cuando un proceso permanece `READY`
sin eventos propios durante al menos doce pasos, mientras otros procesos
sí continúan ejecutando. Es evidencia de postergación en la traza
finita, no una prueba de que el proceso nunca será elegido.

Al alcanzar el límite de seguridad con procesos ejecutables se usa
`STEP_LIMIT_REACHED`, separado de `DEADLOCK`. El simulador puede afirmar
que la ejecución no terminó dentro del límite, pero no decidir si el
bucle infinito es intencional o erróneo.

## 21. Exploración de interleavings

Una ejecución correcta no demuestra que un programa concurrente sea
correcto.

M9 implementa exploración acotada, no verificación exhaustiva. La
ejecución interactiva seguirá usando schedulers; el explorador enumerará
las elecciones habilitadas y ejecutará una transición explícita por
rama.

### Separación de representaciones

La exploración necesita distinguir:

-   estado semántico: memoria, recursos y control de cada proceso;
-   estado de análisis: metadata que pueda afectar diagnósticos futuros;
-   traza: elecciones y eventos utilizados para explicar/reproducir el
    camino;
-   snapshot: proyección segura y derivada para la interfaz.

El historial completo y `stepCount` no pueden formar parte de la clave
canónica: crecen en cada transición e impedirían reconocer un ciclo. Al
mismo tiempo, la metadata reconstruida desde `P` / `V` no puede
descartarse si modifica la clasificación de accesos futuros. Antes de
buscar propiedades de memoria deberá extraerse el contexto de análisis
relevante o incluirlo explícitamente en la equivalencia.

Las representaciones implementadas son:

-   `SemanticExecutionState` proyecta y clona `Program`, que contiene
    memoria, semáforos y todo el control mutable de los procesos;
-   `ExecutionAnalysisState` conserva por separado la evidencia mínima
    utilizada por el diagnóstico de memoria: valores iniciales de
    semáforo, transiciones exitosas `P` / `V` y accesos compartidos;
-   `ExplorationAnalysisState` proyecta esa metadata sin compartir
    estructuras mutables;
-   `ExecutionTrace` proyecta por separado step, eventos de instrucción
    y microoperaciones;
-   `createSemanticStateKey()` serializa `Program` ordenando las claves
    de objetos y preservando el orden significativo de arrays;
-   `VisitedStateRegistry` clasifica cada visita como `NEW` o
    `REPEATED`.

La clave semántica excluye únicamente datos de traza y análisis; incluye
instrucciones, funciones, memorias, recursos, program counters, frames,
llamadas, evaluaciones pendientes, microoperaciones activas, atomicidad
y razones de bloqueo. Deadlock utiliza esta equivalencia.

`createAnalyzedStateKey()` combina el mismo estado semántico con
`ExecutionAnalysisState`. Una propiedad cuyo resultado dependa de
evidencia anterior debe elegir esta clave mediante `createStateKey`; así
dos estados con el mismo runtime pero distinto contexto de protección no
se deduplican incorrectamente.

El engine actualiza la metadata al registrar cada transición exitosa de
semáforo y cada lectura/escritura compartida. `getSnapshot()` calcula
los conflictos desde esta representación, no desde `history` y
`microOperationHistory`. Estados legados sin el campo pueden
reconstruirlo una vez desde sus trazas para conservar compatibilidad.

### Modelo de transición

La primera API de M9 separa selección y ejecución:

``` ts
engine.getEnabledTransitions()
engine.stepTransition(transition)
```

Una transición identifica como mínimo el proceso seleccionado y respeta
la continuidad de regiones `atomic`. El scheduler normal podrá elegir
una de estas transiciones; el explorador podrá probarlas todas sin
depender de una seed.

### Estrategia y límites

`exploreExecution()` concentra la búsqueda en anchura. Recibe una
`ExplorationProperty<Kind, Diagnostic>` que declara un identificador y
una evaluación pura de estado. El BFS construye de forma genérica el
contraejemplo, sus límites, camino, estados extremos y diagnóstico.

Una propiedad puede suministrar `createStateKey()` cuando su evaluación
dependa de metadata de análisis adicional. Si no lo hace, se utiliza la
clave semántica de `Program`. Esto permite extender la equivalencia de
estados por propiedad sin contaminar el modelo general con el historial
completo.

`exploreForDeadlock()` permanece como API específica y delega en el BFS
genérico mediante `deadlockExplorationProperty`.
`exploreForMutualExclusionViolation()` hace lo mismo con
`mutualExclusionViolationProperty`, que opta por
`createAnalyzedStateKey()` porque su resultado depende de la evidencia
de protección acumulada. Cada arista bifurca el engine y fuerza una
transición; el engine suministrado permanece intacto. La búsqueda tiene
límites independientes de profundidad y cantidad de estados y distingue:

``` text
FOUND | EXHAUSTED | TRUNCATED
```

`EXHAUSTED` indica que no quedan estados semánticos nuevos alcanzables
dentro del modelo y los límites aplicables. `TRUNCATED` registra si se
agotó profundidad, cantidad de estados o el límite de seguridad del
engine, y nunca se presenta como prueba de ausencia de errores. El
resultado informa estados visitados, transiciones ensayadas y máxima
profundidad alcanzada.

La primera propiedad fue deadlock, porque su estado terminal ya poseía
una definición formal en M8. La segunda es una violación observada de
exclusión mutua. Sólo acepta el diagnóstico estructurado
`MUTUAL_EXCLUSION_VIOLATION` con razón `OBSERVED_MUTEX_OVERLAP`: no
eleva un `POTENTIAL_RACE` ordinario a violación demostrada.

Cada contraejemplo conserva propiedad, profundidad, límites, secuencia
exacta de procesos, claves de los estados inicial y terminal, estado
terminal y diagnóstico. `replayCounterexample()` concentra la
reproducción común: parte de un fork, fuerza la secuencia, vuelve a
evaluar la propiedad y valida ambos extremos. Los wrappers tipados de
deadlock y exclusión mutua no dependen de una seed ni modifican el
engine original.

La UI conserva el engine origen junto al resultado. El panel permite
elegir la propiedad, configurar ambos límites, muestra estado, causas de
truncamiento y estadísticas, y representa la secuencia de procesos del
contraejemplo. Para exclusión mutua agrega ubicación, procesos y mutex
incompatibles como evidencia. La reproducción guiada avanza una elección
explícita por vez sobre un fork del origen; la ejecución normal queda
deshabilitada durante ese modo para evitar desviarse accidentalmente de
la secuencia guardada.

Las assertions explícitas sobre estados finales permanecen como posible
extensión del lenguaje. La prueba de starvation/terminación,
happens-before, partial-order reduction y el grafo visual completo
quedan fuera del alcance inicial.

## 21.1. Estructuras de datos académicas

El lenguaje representa las estructuras usadas en ejercicios académicos
sin convertirlas en casos especiales del visualizador. La primera
extensión implementada fue una cola FIFO de valores primitivos. Las colas
de prioridad estables y las pilas reutilizan el mismo modelo general.

Una cola local pertenece al estado privado del proceso. Si es compartida,
sus contenidos y orden forman parte del estado semántico global: se
clonan de forma independiente y participan en la identidad canónica de
M9. `enqueue`, `dequeue`, `front`, `size` e `isEmpty` son operaciones
atómicas de un step. Las operaciones de cola y pila generan un
`DataStructureExecutionEvent`, que indica si la estructura es FIFO, de
prioridad o una pila; en una inserción priorizada registra también la
prioridad. Esa atomicidad no se extiende a secuencias compuestas de
consultas, extracciones y otras variables; esas invariantes siguen
requiriendo `P` / `V` u otro protocolo.

`QueueValue` es un valor etiquetado de `RuntimeValue`, con tipo primitivo
de elemento y un array ordenado desde frente hacia fondo. Esto permite
que memoria, snapshots, `structuredClone` y la serialización canónica lo
traten como estado ordinario del programa. `dequeue` y `front` sobre una
cola vacía producen un error explícito; no introducen bloqueo implícito.

`PriorityQueueValue` almacena pares `{ value, priority }` ordenados por
prioridad numérica descendente. La inserción se ubica después de todos
los elementos con igual prioridad, de modo que el desempate es FIFO sin
necesitar un contador auxiliar. El orden y las prioridades forman parte
del estado canónico y se clonan en snapshots y forks. `front` y
`dequeue` retornan únicamente el valor; la prioridad gobierna el orden,
pero no se filtra al código consumidor.

`StackValue` mantiene un array ordenado desde el fondo hacia la cima.
`push` agrega al final, `top` consulta el último valor y `pop` lo elimina.
El contenido y su orden forman parte del estado semántico y se clonan de
forma independiente en snapshots y forks.

Los resultados se escriben inicialmente sólo en memoria local y los
argumentos de `enqueue` no leen memoria compartida directamente. Esta
restricción evita que una operación de alto nivel oculte accesos que hoy
deben descomponerse como microoperaciones para el análisis de
interferencia.

Como mejora posterior se evaluarán registros/estructuras u objetos
educativos con campos. El objetivo es representar datos como un `Fallo`
con `id` y `nivel`, no construir inicialmente un sistema orientado a
objetos completo. Métodos simples como `getNivel()` podrán ser azúcar
sintáctica.

También se prevén operaciones educativas simuladas como `print(...)` o
`procesar(...)`. No realizarán I/O real ni dependerán del navegador,
red, reloj o máquina anfitriona. Podrán producir eventos estructurados
en la traza. Antes de implementarlas deberá decidirse su granularidad de
step y qué información, si alguna, pertenece al estado semántico.

Toda extensión deberá preservar clonación, reproducibilidad y
compatibilidad con la exploración de interleavings de M9.

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

Actualmente `await`, semáforos y los diagnósticos de M8 están
completados. M9 continúa sobre el mismo núcleo con exploración acotada
de interleavings y contraejemplos reproducibles.

Las primitivas futuras deben reutilizar procesos, scheduling, bloqueo,
historial, snapshots, análisis y el modelo de transición de M9, sin
crear motores paralelos de sincronización o exploración.
