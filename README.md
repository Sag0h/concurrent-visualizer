# Concurrent Visualizer

> Simulador educativo de programación concurrente para **escribir,
> ejecutar, visualizar y analizar pseudocódigo concurrente paso a
> paso**.

Concurrent Visualizer nace como herramienta de estudio para
**Programación Concurrente de la Facultad de Informática de la UNLP**,
pero está diseñado como un motor general de pseudocódigo concurrente.

La idea central es que los problemas de concurrencia no sean animaciones
prefabricadas: deben **emerger de la ejecución real del programa**, del
scheduler y de los interleavings producidos por el motor.

------------------------------------------------------------------------

## Estado del proyecto

**Milestone actual:** M9 --- **Exploración de ejecuciones**.

**Último milestone completado:** M8 --- **Detector de errores y
diagnósticos**.

M7 está completado en sus siete fases:

-   **M7.1:** semántica de semáforos generales/contadores;
-   **M7.2:** modelo y AST;
-   **M7.3:** tokenizer, sintaxis y parser;
-   **M7.4:** runtime base de `P` / `V`;
-   **M7.5:** historial y visualización de semáforos;
-   **M7.6:** integración con el análisis de interferencia;
-   **M7.7:** nueve casos académicos reproducibles.

El simulador ya dispone de lenguaje ejecutable, parser, procesos,
estructuras de control, funciones, scheduling reproducible, memoria
compartida, microoperaciones intercalables, análisis básico de
interferencias, regiones `atomic`, acciones atómicas condicionales
mediante `await` y semáforos escalares.

M8 incorporó diagnóstico de deadlock, protección inconsistente,
violaciones observadas de exclusión mutua, busy waiting conservador,
riesgo de starvation y un estado separado para ejecuciones que alcanzan
el límite de pasos sin estar en deadlock.

------------------------------------------------------------------------

## ¿Qué permite hacer actualmente?

### Observar interferencia real

El usuario puede escribir:

``` text
shared int x = 0;

process P1 {
    x = x + 1;
}

process P2 {
    x = x + 1;
}
```

y observar cómo una operación aparentemente simple puede descomponerse
en acciones intercalables:

``` text
P1 SHARED_READ  x = 0
P2 SHARED_READ  x = 0
P1 COMPUTE      result = 1
P2 COMPUTE      result = 1
P1 SHARED_WRITE x = 1
P2 SHARED_WRITE x = 1
```

El resultado puede ser:

``` text
x = 1
```

reproduciendo un **lost update** a partir del interleaving real de los
procesos.

### Proteger una región con `atomic`

``` text
atomic {
    x = x + 1;
}
```

Las microoperaciones siguen siendo visibles, pero otro proceso no puede
intercalarse mientras la región atómica permanezca activa.

### Esperar una condición con `await`

``` text
shared bool ready = false;

process Consumer {
    await (ready);
}

process Producer {
    ready = true;
}
```

Si la guarda es falsa, el proceso queda `BLOCKED`. Cuando puede volver a
progresar queda habilitado para competir por CPU y la condición se
reevalúa al ejecutar nuevamente.

También se soporta una acción atómica condicional con cuerpo:

``` text
await (x > 0) {
    x = x - 1;
}
```

### Sincronizar mediante semáforos

``` text
sem mutex = 1;
shared int x = 0;

process P1 {
    P(mutex);
    x = x + 1;
    V(mutex);
}

process P2 {
    P(mutex);
    x = x + 1;
    V(mutex);
}
```

`P` bloquea cuando el semáforo vale `0`; `V` incrementa y nunca bloquea.

La implementación no impone FIFO, fairness ni ownership. La reactivación
de un proceso no reserva el recurso: la adquisición efectiva ocurre
cuando `P` vuelve a ejecutarse.

### Diagnosticar un deadlock

Cuando ningún proceso puede avanzar, el simulador diferencia un
deadlock de un bloqueo temporal. Para semáforos reconstruye dependencias
observadas y muestra el wait-for graph, los procesos, los recursos y los
ciclos involucrados.

El diagnóstico conserva el paso de detección y puede reproducir la
misma ejecución reiniciando el scheduler. Si el estado es terminal pero
la información no permite demostrar un ciclo —por ejemplo un `await`
falso sin otro proceso ejecutable— se informa un grafo parcial en lugar
de inventar una dependencia.

### Explicar problemas de liveness

El panel de diagnósticos identifica bucles vacíos que consultan
repetidamente memoria compartida sin bloquearse. También advierte cuando
un proceso sigue `READY` pero el scheduler lo posterga mientras otros
continúan ejecutando.

Estas conclusiones se limitan a la traza observada. Starvation se
presenta como riesgo, no como certeza. Si la ejecución llega al límite
de seguridad, el estado `STEP_LIMIT_REACHED` la distingue de un
deadlock y aclara que un historial finito no permite decidir si la no
terminación era intencional.

------------------------------------------------------------------------

## Flujo de ejecución

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
Execution State
      ↓
┌───────────────┬─────────────────┐
│ Visualización │     Análisis    │
└───────────────┴─────────────────┘
```

La lógica del simulador vive en el motor y es independiente de React.

------------------------------------------------------------------------

## Funcionalidades implementadas

### Lenguaje

-   Variables locales y compartidas.
-   `int`, `bool` y `string`.
-   Arrays.
-   Expresiones aritméticas, booleanas y comparaciones.
-   Asignaciones.
-   `if / else`.
-   `while`.
-   `repeat / until`.
-   `for`.
-   `foreach`.
-   `break`.
-   `continue`.
-   Funciones y parámetros.
-   Call stack.
-   Llamadas a funciones dentro de expresiones.
-   `return`.
-   Evaluaciones suspendibles.
-   `atomic`.
-   `await (B);`.
-   `await (B) { S }`.
-   Declaraciones escalares `sem`.
-   Operaciones `P` / `V`.

### Motor concurrente

-   Procesos independientes.
-   Estados `READY`, `RUNNING`, `BLOCKED` y `FINISHED`.
-   Motivos explícitos de bloqueo mediante `blockingReason`.
-   Memoria local por proceso.
-   Memoria compartida.
-   Semáforos separados de la memoria compartida ordinaria.
-   Ejecución paso a paso.
-   Scheduling **First Ready**.
-   Scheduling **Round Robin**.
-   Scheduling **Random** reproducible mediante seed.
-   Microoperaciones intercalables.
-   Captura de valores observados durante lecturas compartidas.
-   Accesos a variables y elementos concretos de arrays mediante
    `MemoryLocation`.
-   Resolución de índices compartidos en targets de arrays.
-   Regiones atómicas anidables mediante `atomicDepth`.
-   Bloqueo y reactivación de `await`.
-   Acciones atómicas condicionales.
-   Bloqueo y reactivación de `P`.
-   `P` / `V` como operaciones atómicas individuales.
-   Reactivación de waiters sin reserva del recurso.
-   Reset reproducible del estado de ejecución.

### Visualización y análisis

-   Estado de los procesos.
-   Estado `BLOCKED`.
-   Condición esperada por `await`.
-   Distinción entre programa bloqueado y finalizado.
-   Distinción `RUNNING`, `TEMPORARILY_BLOCKED`, `FINISHED` y
    `DEADLOCK`.
-   Wait-for graph y detección de ciclos para semáforos.
-   Procesos y recursos involucrados en deadlock.
-   Reproducción determinista hasta el paso del deadlock.
-   Memoria local.
-   Memoria compartida.
-   Call stack.
-   Historial de ejecución.
-   Historial de microoperaciones.
-   Lecturas y escrituras compartidas.
-   Detección de accesos conflictivos.
-   Clasificación `POTENTIAL_RACE`.
-   Clasificación `SYNCHRONIZED`.
-   Protección unilateral e incompatible diferenciada.
-   Violaciones observadas de exclusión mutua con mutex distintos.
-   Motivos estructurados por acceso y por ubicación.
-   Resumen de conflictos por ubicación de memoria.
-   Valores actuales de semáforos.
-   Procesos bloqueados esperando cada semáforo, sin representar FIFO.
-   Transiciones estructuradas de `P` / `V` en el historial.

------------------------------------------------------------------------

## Semántica concurrente actual

### Microoperaciones

Una instrucción fuente no es necesariamente una única acción atómica.

Por ejemplo:

``` text
x = x + 1;
```

puede producir conceptualmente:

``` text
SHARED_READ x
COMPUTE
SHARED_WRITE x
```

Una lectura captura el valor observado en ese momento. El scheduler
puede intercalar otros procesos entre microoperaciones cuando no existe
una región atómica activa.

### `atomic`

`atomic { ... }` representa una región no intercalable, no una única
microoperación.

Las microoperaciones continúan existiendo y registrándose, pero el
scheduler no puede cambiar de proceso mientras la región permanezca
activa.

Se soportan regiones anidadas y unwind correcto ante `return`, `break` y
`continue`.

### `await`

`await` es una acción atómica condicional.

Si la guarda es falsa, el proceso queda `BLOCKED` sin avanzar.

Cuando la guarda vuelve a ser verdadera puede pasar a `READY`, pero esto
no reserva la condición. El proceso reevalúa la guarda cuando finalmente
sea seleccionado.

Si la guarda es verdadera y existe cuerpo, la comprobación exitosa y el
cuerpo forman una acción atómica condicional.

Actualmente las guardas de `await` no soportan llamadas a funciones y se
rechaza `await` dentro de una región `atomic`.

### Semáforos

V1 utiliza únicamente **semáforos generales/contadores**.

Conceptualmente:

``` text
P(s): < await (s > 0) s = s - 1; >
V(s): < s = s + 1; >
```

`P` y `V` son operaciones atómicas individuales, pero no utilizan
`atomicDepth`.

Por lo tanto:

``` text
P(mutex);
critical_section();
V(mutex);
```

no fija el scheduler durante toda la sección crítica. La exclusión surge
del protocolo de sincronización, no de convertir toda la región en
`atomic`.

No se asume:

-   FIFO;
-   fairness débil/fuerte;
-   ownership;
-   reserva de permisos durante la reactivación.

El análisis de memoria puede reconocer un semáforo general inicializado
en `1` cuando la ejecución observada respeta un protocolo mutex correcto.
La protección por el mismo mutex se muestra como `SYNCHRONIZED`; la
protección unilateral como `POTENTIAL_RACE`; y un contador o protocolo
ambiguo como `UNKNOWN`. También se reconoce como `SYNCHRONIZED` un
traspaso directo y no ambiguo `V(s) -> P(s)` sobre un semáforo de
señalización inicializado en `0`, siempre que el primer acceso ocurra
antes del `V` y el segundo después del `P`.

Esta clasificación no crea un tipo binario ni agrega ownership al
runtime. Tampoco demuestra el comportamiento para todos los
interleavings: explica únicamente la traza ejecutada.

Cuando dos accesos usan protecciones diferentes, el analizador distingue
una advertencia de protección inconsistente de una violación observada.
La violación exige que la traza muestre a un proceso accediendo mientras
el otro todavía conserva un mutex incompatible.

`POTENTIAL_RACE` no significa “data race demostrada”. Un análisis formal
basado en happens-before requeriría relaciones causales específicas para
cada primitiva; el orden numérico de los pasos no sirve porque es el
interleaving total elegido por el scheduler.

El primer caso académico de M7.7 adapta el ejercicio práctico de los
chicos y la bolsa de caramelos. El incremento compartido se protege con
`sem mutex = 1`, mientras el trabajo local queda fuera de la sección
crítica para maximizar la concurrencia. Un test reproducible comprueba el
contador final, los bloqueos observados y que nunca haya más de un
proceso dentro de la sección protegida.

El segundo caso utiliza `sem inicio = 0` para señalización. Un trabajador
se bloquea en `P(inicio)`, un coordinador anuncia el evento con
`V(inicio)` y el trabajador reevalúa y consume la señal antes de
continuar. Este uso sincroniza por condición y no representa exclusión
mutua.

El tercer caso coloca dos trabajadores sobre el mismo semáforo de
señalización. Un solo `V` crea un solo permiso: ambos pueden ser
reactivados, pero uno consume el recurso y el otro puede volver a
bloquearse. Un segundo `V` permite continuar al restante. El orden lo
decide el scheduler; no existe una cola FIFO dentro del semáforo.

El cuarto caso usa `sem recursos = 2` como contador de unidades libres.
Dos trabajadores pueden adquirir una unidad antes de que ocurra ningún
`V`; un tercero se bloquea al encontrar el valor `0` y continúa cuando se
devuelve una unidad. El test comprueba una concurrencia máxima de dos
usuarios y que el semáforo recupere su valor inicial al terminar. Este
protocolo modela capacidad y no exclusión mutua.

El quinto caso adapta Productor/Consumidor a un buffer unitario. `vacio`
empieza en `1` y cuenta el lugar libre; `lleno` empieza en `0` y obliga al
consumidor a esperar un dato. El productor deposita `42`, ejecuta
`V(lleno)` y el consumidor consume esa señal antes de leer el buffer. Al
terminar, el dato fue transferido, `vacio` vuelve a `1` y `lleno` a `0`.

Para explicar correctamente ese acceso, el análisis reconoce el orden
directo escritura - `V(lleno)` - `P(lleno)` - lectura como
`SEMAPHORE_SIGNALING`. La regla es intencionalmente estrecha: no reemplaza
un análisis formal completo de happens-before ni generaliza señales o
contadores ambiguos.

El sexto caso amplía el buffer a dos posiciones y produce tres mensajes.
Con **First Ready**, el productor deposita `10` y `20`, consume las dos
unidades de `vacio` y queda bloqueado al intentar un tercer `P(vacio)`.
El consumidor libera una posición, el productor deposita `30` y la
ejecución termina con `consumidos = [10, 20, 30]`, `vacio = 2` y
`lleno = 0`.

Los depósitos y retiros están dentro de bloques `atomic`, siguiendo la
suposición académica válida para un único productor y un único
consumidor. `atomic` hace indivisible cada acceso al buffer; `vacio` y
`lleno` administran la capacidad. El caso no incorpora todavía múltiples
productores o consumidores, que requerirían mutex adicionales para sus
índices compartidos.

El séptimo caso implementa una barrera de un solo uso para tres procesos.
Cada uno incrementa un contador protegido por `mutex`; el último genera
tres permisos mediante `V(barrera)` y todos consumen uno antes de
continuar. El test exige que nadie cruce antes de `contador == 3` y que
cada proceso libere el mutex antes de bloquearse en la barrera.

La barrera usa `sem barrera = 0` como señalización, no como exclusión
mutua. Se emite un permiso por proceso y no se infiere ningún orden FIFO.

El octavo caso adapta Lectores/Escritores con preferencia a lectores.
`mutexR` protege `nr`; el primer lector toma `rw` y el último lo libera.
Dos lectores pueden mantener `nr = 2` y leer concurrentemente, mientras
el escritor permanece bloqueado hasta que el grupo lector abandona la
base de datos.

La preparación local del escritor y el trabajo local de los lectores
sólo hacen visible ese interleaving con Round Robin. No modifican el
protocolo. Esta solución no es fair: una sucesión continua de lectores
puede causar starvation del escritor.

El noveno caso adapta Filósofos Comensales sin requerir arrays de
semáforos: cinco semáforos generales `tenedor0` a `tenedor4` representan
los tenedores. Los filósofos `0` a `3` los toman en orden ascendente y el
`Filosofo4` toma primero `tenedor0` y después `tenedor4`, rompiendo la
espera circular.

Con Round Robin, `Filosofo0` y `Filosofo2` pueden comer simultáneamente
porque no son vecinos, mientras los procesos que compiten por alguno de
sus tenedores quedan bloqueados. El test exige exclusividad por tenedor,
prohíbe que vecinos coman juntos y comprueba que los cinco filósofos
terminen devolviendo todos los semáforos a `1`.

------------------------------------------------------------------------

## Arquitectura

El proyecto separa deliberadamente el motor de simulación de la
interfaz:

``` text
src/
├── core/
│   ├── engine/
│   ├── scheduler/
│   ├── process/
│   ├── instructions/
│   ├── expressions/
│   ├── language/
│   ├── memory/
│   ├── semaphores/
│   ├── deadlock/
│   └── diagnostics/
└── App.tsx
```

El núcleo ya soporta memoria compartida, `atomic`, `await` y semáforos
sobre el mismo motor general. Monitores y pasaje de mensajes se
incorporarán posteriormente sin crear simuladores independientes.

Para más detalle:

**[Arquitectura completa](ARCHITECTURE.md)**

------------------------------------------------------------------------

## Principios del proyecto

### Un motor real, no animaciones prefabricadas

Productor/Consumidor, Lectores/Escritores, Filósofos, exclusión mutua y
otros problemas clásicos deben expresarse como programas normales y
ejecutarse mediante el mismo motor.

### Los errores deben emerger de la ejecución

Una race condition no debería aparecer porque la UI decidió mostrar una
animación de una race condition.

Debe aparecer porque el scheduler produjo un interleaving válido que
expuso el problema.

### Motor independiente de la UI

React visualiza el estado. La semántica vive en `core`.

### Ejecuciones reproducibles

Los escenarios aleatorios pueden utilizar una seed para volver a
ejecutar exactamente un comportamiento interesante o problemático.

M9 ampliará esta garantía: los contraejemplos encontrados por el
explorador guardarán la secuencia exacta de procesos elegidos y no
dependerán de reconstruirla mediante una seed.

### Fidelidad académica

Las primitivas concurrentes se incorporan siguiendo prioritariamente la
terminología y semántica utilizada por la cátedra de Programación
Concurrente.

### Separar ejecución y análisis

La semántica del motor no debe alterarse únicamente para facilitar un
detector o una visualización.

Por ejemplo, una sección protegida mediante `P` / `V` no se representa
artificialmente mediante `atomicDepth` para conseguir que el análisis de
interferencia la clasifique como sincronizada.

------------------------------------------------------------------------

## Stack

  Tecnología         Uso
  ------------------ -------------------------------------
  **React**          Interfaz y visualización
  **TypeScript**     Lenguaje y motor de simulación
  **Vite**           Desarrollo y build
  **Vitest**         Tests automatizados
  **ESLint**         Calidad y consistencia del código
  **Git / GitHub**   Versionado y evolución del proyecto

No se requiere backend para la versión actual.

------------------------------------------------------------------------

## Ejecutar localmente

### Requisitos

-   Node.js
-   npm
-   Git

### Instalación

``` bash
git clone <URL-DEL-REPOSITORIO>
cd concurrent-visualizer
npm install
```

### Desarrollo

``` bash
npm run dev
```

### Verificación

``` bash
npm test
npm run lint
npm run build
```

Los tres comandos deben finalizar correctamente antes de considerar
cerrada una fase que modifica código.

------------------------------------------------------------------------

## Documentación

La documentación forma parte del proyecto y se actualiza junto con el
código.

  ---------------------------------------------------------------------------------
  Documento                                     Contenido
  --------------------------------------------- -----------------------------------
  **[BACKLOG.md](BACKLOG.md)**                  Fuente de verdad del roadmap,
                                                milestones y tickets

  **[ARCHITECTURE.md](ARCHITECTURE.md)**        Arquitectura vigente y
                                                funcionamiento interno del motor

  **[DECISIONS.md](DECISIONS.md)**              Decisiones arquitectónicas costosas
                                                de olvidar

  **[PROGRESS.md](PROGRESS.md)**                Historial de implementación y
                                                estado actual

  **[SYNTAX.md](SYNTAX.md)**                    Sintaxis actualmente soportada por
                                                el lenguaje
  ---------------------------------------------------------------------------------

------------------------------------------------------------------------

## Roadmap

El desarrollo está organizado incrementalmente para que cada nueva
primitiva se apoye sobre semántica ya probada.

``` text
Lenguaje secuencial
        ↓
Scheduling
        ↓
Memoria compartida
        ↓
Microoperaciones
        ↓
Atomicidad
        ↓
await
        ↓
Semáforos P / V
        ↓
Análisis y errores
        ↓
Exploración acotada  ← actual
        ↓
Monitores
        ↓
Pasaje de mensajes
        ↓
Visualización y análisis avanzado
```

### Último milestone completado --- M8: Detector de errores y diagnósticos

Completado:

``` text
M7.1  Semántica
M7.2  Modelo y AST
M7.3  Lenguaje, tokenizer y parser
M7.4  Runtime P / V
M7.5  Historial y visualización
M7.6  Integración con el análisis de interferencia
M7.7  Casos académicos reproducibles
M8    Detector de errores y diagnósticos
```

Próximo:

``` text
M9  Exploración de ejecuciones
```

M7.6 extendió el análisis de M5 para comprender protocolos mutex
observados sin alterar la semántica real de ejecución. M7.7 cerró el
milestone con nueve casos académicos ejecutados por el motor general.

El roadmap completo está en **[BACKLOG.md](BACKLOG.md)**.

------------------------------------------------------------------------

## Objetivo a largo plazo

Concurrent Visualizer busca evolucionar desde un simulador paso a paso
hacia una herramienta capaz de **explorar y explicar ejecuciones
concurrentes**.

Entre los objetivos futuros se encuentran:

-   monitores y variables condición;
-   pasaje de mensajes;
-   canales síncronos y asíncronos;
-   deadlock detection;
-   análisis más preciso de race conditions;
-   exploración de múltiples interleavings;
-   reproducción de contraejemplos;
-   problemas clásicos expresados directamente en el lenguaje;
-   visualizaciones educativas de procesos, recursos y comunicación.

Una ejecución que termina correctamente no demuestra que un programa
concurrente sea correcto. El objetivo final es que el simulador pueda
ayudar a encontrar **la ejecución que demuestra que no lo es**.

------------------------------------------------------------------------

## Regla de trabajo

Un ticket no se considera terminado solamente porque "parece funcionar".

Debe:

1.  estar implementado;
2.  estar verificado o testeado según corresponda;
3.  mantener funcionando los tests existentes;
4.  reflejarse en el backlog y el progreso;
5.  actualizar arquitectura, decisiones o sintaxis cuando el cambio lo
    requiera.

------------------------------------------------------------------------

## Contexto académico

Proyecto desarrollado como herramienta de aprendizaje para
**Programación Concurrente --- Facultad de Informática, UNLP**.

La arquitectura busca acompañar el avance de la materia: primero
construir una base general y verificable, y luego incorporar cada
mecanismo de concurrencia sobre ese mismo motor.

La semántica de las primitivas concurrentes prioriza el material oficial
de la cátedra y los problemas clásicos deben emerger del mismo engine
general, no de implementaciones especiales.
