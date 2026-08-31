# Concurrent Visualizer --- Backlog

> Fuente de verdad del trabajo pendiente y completado.
>
> Regla: un ticket se marca como terminado cuando el código funciona,
> tiene las pruebas que correspondan y se actualiza la documentación
> relevante.

## Objetivo del proyecto

Construir un intérprete/simulador educativo de pseudocódigo concurrente
que permita ejecutar y visualizar programas, explorar distintos
interleavings y detectar problemas comunes de concurrencia.

El proyecto tendrá un único motor extensible para soportar distintos
modelos:

-   Memoria compartida.
-   Pasaje de mensajes.
-   Modelos híbridos en modo avanzado.

La interfaz educativa podrá restringir los mecanismos disponibles según
el paradigma que se esté estudiando.

------------------------------------------------------------------------

## M0 --- Base del proyecto

-   [x] Crear proyecto con Vite.
-   [x] Configurar React.
-   [x] Configurar TypeScript.
-   [x] Configurar ESLint.
-   [x] Inicializar Git.
-   [x] Crear primer commit.
-   [x] Levantar la aplicación localmente.
-   [x] Renombrar rama `master` a `main`.
-   [x] Configurar `main` como rama predeterminada para futuros
    repositorios.
-   [x] Limpiar contenido demo de Vite.
-   [x] Definir estructura inicial de `src/`.
-   [x] Agregar documentación base al repositorio.
-   [x] Crear commit de estructura inicial.

**Resultado:** proyecto limpio, documentado y listo para desarrollar el
motor.

------------------------------------------------------------------------

## M1 --- Primer motor concurrente

Inicialmente los programas se definirán mediante objetos TypeScript.
Todavía no habrá parser.

-   [x] Definir `ProcessId`.
-   [x] Definir estados `READY`, `RUNNING`, `BLOCKED`, `FINISHED`.
-   [x] Crear modelo `Process`.
-   [x] Crear modelo `Instruction`.
-   [x] Crear modelo `Program`.
-   [x] Crear `ExecutionState`.
-   [x] Crear `SimulationEngine`.
-   [x] Implementar `step()`.
-   [x] Mantener program counter por proceso.
-   [x] Detectar proceso terminado.
-   [x] Detectar programa terminado.
-   [x] Agregar tests básicos del motor.

**Objetivo mínimo:** ejecutar instrucciones pertenecientes a varios
procesos paso a paso.

------------------------------------------------------------------------

## M2 --- Scheduler e interleavings

-   [x] Crear interfaz `Scheduler`.
-   [x] Scheduler determinista.
-   [x] Scheduler round-robin.
-   [x] Scheduler aleatorio.
-   [x] Seleccionar procesos en estado `READY`.
-   [x] Permitir cambios de proceso entre steps.
-   [x] Registrar historial de ejecución.
-   [x] Permitir seed para ejecuciones aleatorias reproducibles.
-   [x] Resetear simulación.
-   [x] Configurar límite máximo de steps.

------------------------------------------------------------------------

## M3 --- Variables y memoria

-   [x] Variables locales por proceso.
-   [x] Memoria compartida.
-   [x] Tipo `int`.
-   [x] Tipo `bool`.
-   [x] Tipo `string`.
-   [x] Declaración de variables locales y compartidas.
-   [x] Asignaciones.
-   [x] Lectura de variables.
-   [x] Expresiones aritméticas.
-   [x] Expresiones booleanas.
-   [x] Comparaciones.
-   [x] Arrays básicos.
-   [x] Exponer estado de memoria para visualización.

------------------------------------------------------------------------

## M3.5 --- Visualizer MVP ejecutable

-   [x] Definir y documentar sintaxis V0 del pseudocódigo.

-   [x] Crear tokenizer mínimo.

-   [x] Crear parser mínimo.

-   [x] Parsear variables compartidas.

-   [x] Parsear procesos.

-   [x] Parsear variables locales.

-   [x] Parsear asignaciones.

-   [x] Parsear expresiones.

-   [x] Parsear arrays básicos.

-   [x] Convertir código en `Program`.

-   [x] Mostrar errores de sintaxis.

-   [x] Crear editor de código.

-   [x] Permitir agregar procesos desde la UI.

-   [x] Ejecutar el código escrito por el usuario.

-   [x] Selector de scheduler.

-   [x] First Ready.

-   [x] Round Robin.

-   [x] Random.

-   [x] Seed configurable para Random.

-   [x] Botón `Step`.

-   [x] Botón `Reset`.

-   [x] Botón `Run`.

-   [x] Mostrar `stepCount`.

-   [x] Mostrar procesos.

-   [x] Mostrar estado de cada proceso.

-   [x] Mostrar `programCounter`.

-   [x] Mostrar memoria local.

-   [x] Mostrar memoria compartida.

-   ## \[x\] Mostrar historial de ejecución.

## M4 --- Lenguaje secuencial

Cada proceso concurrente debe poder comportarse como un programa
secuencial normal antes de introducir primitivas específicamente
concurrentes.

### Control de flujo

-   [x] Bloques de instrucciones.
-   [x] `if`.
-   [x] `if / else`.
-   [x] `while`.
-   [x] `repeat / until`.
-   [x] `for`.
-   [x] `foreach`.
-   [x] `break`.
-   [x] `continue`.

### Funciones

-   [x] Definiciones de funciones.
-   [x] Llamadas a funciones.
-   [x] Parámetros.
-   [x] Variables locales de función.
-   [x] Call stack independiente por proceso.
-   [x] Llamadas anidadas.
-   [x] `return;`.
-   [x] `return expression;`.
-   [x] `return` desde bloques de control anidados.
-   [x] Funciones utilizadas como expresiones.
-   [x] Llamadas a funciones anidadas dentro de expresiones.
-   [x] Funciones vacías.

### Runtime de expresiones suspendibles

-   [x] `FunctionCallExpression` en el AST.
-   [x] Suspensión y reanudación de expresiones.
-   [x] Pila `pendingEvaluations` independiente por proceso.
-   [x] Continuaciones anidadas.
-   [x] Evaluación suspendible en `DECLARE`.
-   [x] Evaluación suspendible en `ASSIGN`.
-   [x] Evaluación suspendible en condiciones de `if`.
-   [x] Evaluación suspendible en condiciones de `while`.
-   [x] Evaluación suspendible en condiciones de `repeat / until`.
-   [x] Evaluación suspendible en condiciones de `for`.
-   [x] Evaluación suspendible en colecciones de `foreach`.
-   [x] Evaluación suspendible en `return`.
-   [x] Evaluación suspendible en argumentos de llamadas.
-   [x] Evaluación suspendible en índices de arrays.
-   [x] Evaluación suspendible en targets de asignación a arrays.
-   [x] Múltiples llamadas dentro de una misma expresión.
-   [x] Aislamiento del runtime suspendible entre procesos.

### Robustez del runtime

-   [x] `step()` informa si hubo progreso.
-   [x] Restaurar proceso a `READY` ante errores de runtime.
-   [x] Evitar loops infinitos de `Run` cuando no hay progreso.
-   [x] Registrar en historial únicamente instrucciones completadas.
-   [x] Mostrar errores de runtime en la interfaz.
-   [x] Auditar usos directos de `evaluateExpression()`.

### Tests

-   [x] Tests unitarios del engine.
-   [x] Tests de integración parser + engine.
-   [x] Test de llamadas anidadas.
-   [x] Test de llamadas en múltiples argumentos.
-   [x] Test de llamadas en `foreach`.
-   [x] Test de llamadas en índices de arrays.
-   [x] Test de llamadas en `repeat / until`.
-   [x] Test de llamadas en condición de `for`.
-   [x] Test de aislamiento entre procesos.

**Estado:** M4 COMPLETADO.

------------------------------------------------------------------------

## M5 --- Atomicidad e interferencia

Este milestone introduce la primera semántica específicamente
concurrente

del simulador. Antes de implementar primitivas de sincronización debe
quedar

definida la unidad mínima de ejecución que puede intercalarse con otro
proceso.

### Modelo de ejecución

-   [x] Definir formalmente qué constituye una acción atómica en el
    simulador.
-   [x] Distinguir instrucciones del pseudocódigo de microoperaciones
    internas.
-   [x] Definir qué microoperaciones pueden intercalarse entre procesos.
-   [x] Definir cómo interactúan las microoperaciones con `step()` y los
    schedulers.
-   [ ] Permitir seleccionar desde la UI el nivel de detalle por
    instrucción o por microoperación (mejora futura; no bloquea M5).

### Microoperaciones y memoria

-   [x] Diseñar representación interna de microoperaciones.
-   [x] Descomponer operaciones cuando sea necesario para visualizar
    interferencia.
-   [x] Representar explícitamente lecturas de memoria compartida.
-   [x] Representar explícitamente escrituras de memoria compartida.
-   [x] Representar operaciones intermedias necesarias para expresiones
    como `x = x + 1`.
-   [x] Mantener historial de lecturas y escrituras.
-   [x] Registrar qué proceso realizó cada acceso y en qué step.
-   [x] Representar ubicaciones concretas de memoria compartida mediante
    `MemoryLocation`.
-   [x] Soportar accesos a elementos de arrays compartidos a nivel de
    microoperación.

### Interferencia e interleavings

-   [x] Registrar accesos concurrentes a memoria.
-   [x] Visualizar interleavings a nivel de microoperación.
-   [x] Crear ejemplo real y reproducible de race condition.
-   [x] Mantener compatibilidad con seeds reproducibles del scheduler
    Random.
-   [x] Detectar accesos potencialmente conflictivos sobre la misma
    ubicación de memoria.
-   [x] Resumir conflictos por ubicación de memoria.
-   [x] Visualizar conflictos de acceso en la UI.
-   [x] Distinguir formalmente conflicto de acceso de data race.

### Atomicidad explícita

-   [x] Definir sintaxis/representación de secciones atómicas.
-   [x] Implementar secciones atómicas.
-   [x] Impedir interleavings dentro de una sección atómica.
-   [x] Visualizar cuándo un acceso está sincronizado por atomicidad.
-   [x] Agregar tests que comparen ejecución protegida y no protegida.
-   [x] Soportar regiones atómicas anidadas.
-   [x] Mantener atomicidad correctamente ante return, break y continue.
-   [x] Soportar regiones atómicas vacías.
-   [x] Capturar valores leídos de memoria compartida para preservar la
    semántica del interleaving.
-   [x] Soportar índices compartidos en targets de arrays.
-   [x] Soportar expresiones de índice con múltiples lecturas
    compartidas.
-   [x] Capturar la ubicación de destino antes del `WRITE`.
-   [x] Clasificar conflictos como `POTENTIAL_RACE` o `SYNCHRONIZED`.

**Caso de prueba principal:** dos procesos ejecutan:

``` text
shared int x = 0;

process P1 {
    x = x + 1;
}

process P2 {
    x = x + 1;
}
```

Debe existir una ejecución válida donde ambos procesos lean `x = 0`
antes de escribir y el resultado final sea `x = 1`.

Al proteger correctamente la operación mediante atomicidad explícita, el
resultado deberá ser `x = 2`.

**Estado:** M5 COMPLETADO.

------------------------------------------------------------------------

## M6 --- `await`

Este milestone incorpora acciones atómicas condicionales mediante
`await`, siguiendo la semántica utilizada por la cátedra.

La construcción:

``` text
<await (B) S>
```

se representa en el lenguaje del visualizador como:

``` text
await (B) {
    S
}
```

y, cuando `S` es `skip`, como:

``` text
await (B);
```

Si `B` es falsa, el proceso queda bloqueado y no avanza. Cuando la
condición puede volver a cumplirse, el proceso es reactivado y, al ser
seleccionado nuevamente, reevalúa la guarda. Si `B` es verdadera, la
comprobación exitosa de la guarda y la ejecución de `S` forman una
acción atómica, sin interleavings de otros procesos durante `S`.

### M6.1 --- Sintaxis y AST

-   [x] Incorporar `await` como palabra reservada en el tokenizer.
-   [x] Incorporar la instrucción `AWAIT` al AST.
-   [x] Parsear `await (B);`.
-   [x] Parsear `await (B) { S }`.
-   [x] Soportar expresiones compuestas como guarda.
-   [x] Validar errores sintácticos de `await`.
-   [x] Incorporar tests de tokenizer y parser.

### M6.2 --- Estado de espera

-   [x] Utilizar el estado `BLOCKED` para representar procesos esperando
    un `await`.
-   [x] Incorporar `blockingReason` al proceso.
-   [x] Representar el motivo de bloqueo como `AWAIT` junto con su
    condición.
-   [x] Exponer el motivo de bloqueo en los snapshots.
-   [x] Mantener el program counter en el `await` mientras la guarda sea
    falsa.

### M6.3 --- Evaluación de la guarda

-   [x] Evaluar la condición `B` utilizando el contexto de memoria local
    y compartida.
-   [x] Exigir que la guarda produzca un valor booleano.
-   [x] Bloquear el proceso cuando `B` sea falsa.
-   [x] Permitir continuar cuando `B` sea verdadera.
-   [x] Reevaluar la guarda cuando un proceso previamente bloqueado
    vuelva a intentar el `await`.
-   [x] Rechazar explícitamente, por ahora, llamadas a funciones dentro
    de la guarda.

### M6.4 --- Reactivación

-   [x] Reevaluar procesos bloqueados por `await`.
-   [x] Pasar de `BLOCKED` a `READY` cuando la guarda pueda cumplirse.
-   [x] Reactivar todos los procesos bloqueados cuya guarda sea
    verdadera.
-   [x] Dejar que el scheduler seleccione cuál proceso `READY` ejecuta.
-   [x] Reevaluar nuevamente la guarda cuando el proceso sea
    efectivamente seleccionado.
-   [x] Evitar que la reactivación reserve la condición o el recurso
    para un proceso.

### M6.5 --- Acción atómica condicional

-   [x] Ejecutar el cuerpo de un `await` habilitado de forma atómica.
-   [x] Garantizar que no exista un cambio de proceso entre la
    comprobación exitosa de `B` y la entrada a `S`.
-   [x] Reutilizar `atomicDepth` y la infraestructura de `atomic`.
-   [x] Mantener visibles las micro-operaciones internas de `S` sin
    permitir interleavings.
-   [x] Liberar correctamente la atomicidad al terminar el cuerpo.
-   [x] Soportar bloques `atomic` anidados dentro de un `await`.
-   [x] Permitir adquisición secuencial de un mismo lock por varios
    procesos.
-   [x] Verificar que un proceso reactivado pueda volver a bloquearse si
    la guarda vuelve a ser falsa.
-   [x] Rechazar explícitamente, por ahora, `await` dentro de una región
    `atomic`.

### M6.6 --- Control de flujo y unwind

-   [x] Liberar correctamente la atomicidad ante `return` dentro del
    cuerpo de un `await`.
-   [x] Liberar correctamente la atomicidad ante `break`.
-   [x] Liberar correctamente la atomicidad ante `continue`.
-   [x] Reingresar correctamente a la atomicidad en nuevas iteraciones
    después de `continue`.
-   [x] Liberar regiones `atomic` anidadas al hacer unwind desde un
    `await`.
-   [x] Verificar que el scheduler pueda continuar después del unwind.
-   [x] Evitar fugas de `atomicDepth`.

### M6.7 --- Historial y visualización

-   [x] Exponer la condición que mantiene bloqueado a un proceso.
-   [x] Formatear expresiones del AST para mostrarlas de forma legible.
-   [x] Mostrar en la tarjeta del proceso la condición esperada por un
    `await`.
-   [x] Registrar intentos de `await` bloqueados en el historial.
-   [x] Registrar intentos de `await` habilitados en el historial.
-   [x] Mostrar el estado `BLOCKED` y el detalle de los eventos de
    `await`.
-   [x] Distinguir visualmente un programa bloqueado de uno finalizado.
-   [x] Incorporar tests para el historial de `await`.

### M6.8 --- Casos académicos de la cátedra

-   [x] Incorporar como pruebas casos reales de `await` utilizados por
    la cátedra.
-   [x] Probar espera simple `await (B);` habilitada por otro proceso.
-   [x] Probar varios procesos esperando la misma condición.
-   [x] Probar adquisición y liberación de un lock mediante
    `await (!lock) { lock = true; }`.
-   [x] Verificar exclusión mutua mediante el lock.
-   [x] Probar el caso donde varios procesos son reactivados y uno
    vuelve a bloquearse al reevaluar la guarda.
-   [x] Incorporar un caso basado en Tie-Breaker.
-   [x] Incorporar un caso basado en Ticket si la sintaxis y el modelo
    actual permiten representarlo correctamente.

### Decisiones diferidas

-   No implementar todavía garantías formales de fairness débil o
    fuerte.
-   No modelar `await` mediante busy waiting interno; el visualizador
    representa la espera mediante `BLOCKED`.
-   No optimizar todavía la reactivación mediante dependencias entre
    guardas y variables compartidas.
-   No soportar todavía llamadas a funciones dentro de guardas de
    `await`.
-   No soportar todavía `await` dentro de regiones `atomic`.
-   No incorporar todavía primitivas de hardware como Test & Set, Fetch
    & Add o Compare & Swap.

------------------------------------------------------------------------

## M7 --- Semáforos

Este milestone incorpora semáforos generales/contadores siguiendo la
semántica utilizada por la cátedra. Los semáforos son recursos de
sincronización separados de la memoria compartida ordinaria.

En V1 no existe un tipo especial de semáforo binario: un semáforo
general inicializado en `1` puede utilizarse para exclusión mutua si el
programa respeta correctamente el protocolo `P` / `V`.

### M7.1 --- Semántica de semáforos

-   [x] Tomar la definición de semáforo utilizada por la cátedra.
-   [x] Implementar únicamente semáforos generales/contadores en V1.
-   [x] Definir el valor interno como entero no negativo.
-   [x] Definir `P(s)` como una acción atómica condicional.
-   [x] Definir `V(s)` como incremento atómico no bloqueante.
-   [x] Bloquear el proceso cuando `P(s)` no pueda completarse.
-   [x] Mantener el program counter sobre la operación `P` bloqueante.
-   [x] Reactivar procesos cuando la condición de `P` pueda cumplirse.
-   [x] Reevaluar nuevamente `P` cuando el proceso sea seleccionado.
-   [x] No reservar el recurso al reactivar un proceso.
-   [x] No asumir cola FIFO ni fairness en las operaciones `P`.
-   [x] Delegar al scheduler la elección entre procesos `READY`.
-   [x] Exigir inicialización de todos los semáforos.
-   [x] Mantener separadas exclusión mutua y sincronización por
    condición.
-   [x] Representar la espera mediante `BLOCKED`, sin busy waiting
    interno.

### M7.2 --- Modelo y AST

-   [x] Crear representación explícita de `Semaphore`.
-   [x] Mantener semáforos separados de la memoria compartida ordinaria.
-   [x] Incorporar colección de semáforos al `Program`.
-   [x] Representar `P` y `V` como instrucciones propias del AST.
-   [x] Referenciar semáforos por nombre desde el AST.
-   [x] Extender `BlockingReason` para bloqueos por `P`.
-   [x] No almacenar una cola FIFO/fair dentro del semáforo.
-   [x] Mantener el diseño extensible para arrays de semáforos sin
    implementarlos todavía.

### M7.3 --- Lenguaje, tokenizer y parser

Sintaxis escalar actual:

``` text
sem mutex = 1;
sem available = 3;

process P1 {
    P(mutex);
    V(mutex);
}
```

-   [x] Incorporar `sem`, `P` y `V` al tokenizer.
-   [x] Parsear declaraciones escalares `sem nombre = valor;`.
-   [x] Exigir inicialización explícita.
-   [x] Validar que el valor inicial sea un literal entero no negativo.
-   [x] Parsear `P(nombre);` y `V(nombre);`.
-   [x] Generar `SEMAPHORE_P` y `SEMAPHORE_V`.
-   [x] Incorporar semáforos parseados al `Program`.
-   [x] Detectar declaraciones duplicadas.
-   [x] Mantener errores sintácticos precisos.
-   [x] Incorporar tests de tokenizer y parser.
-   [x] Mantener la resolución de referencias fuera del parser; un
    nombre inexistente se valida al ejecutar.

### M7.4 --- Runtime de `P` y `V`

-   [x] Resolver semáforos por nombre durante la ejecución.
-   [x] Producir error de runtime explícito para un semáforo
    inexistente.
-   [x] Ejecutar `P(s)` atómicamente cuando `s > 0`, decrementar y
    avanzar.
-   [x] Bloquear cuando `P(s)` encuentra `s == 0` sin avanzar el program
    counter.
-   [x] Ejecutar `V(s)` como incremento atómico no bloqueante.
-   [x] Reactivar procesos bloqueados sobre `P(s)` cuando `s > 0`.
-   [x] Reactivar sin decrementar ni reservar el semáforo.
-   [x] Reevaluar `P(s)` cuando el proceso reactivado sea seleccionado.
-   [x] Permitir que varios procesos sean reactivados y que quienes
    pierdan la competencia vuelvan a bloquearse.
-   [x] Mantener `P` y `V` atómicos sin utilizar `atomicDepth`.
-   [x] No fijar el scheduler durante toda la región entre `P` y `V`.
-   [x] No imponer ownership: otro proceso puede ejecutar `V`.
-   [x] Incorporar tests del runtime.
-   [x] Verificar regresión completa con tests, lint y build.

### M7.5 --- Historial y visualización de semáforos

-   [x] Exponer valores de semáforos en `SimulationSnapshot`.
-   [x] Mostrar semáforos y valores en la interfaz.
-   [x] Mostrar qué procesos esperan cada semáforo derivándolo de
    `blockingReason`.
-   [x] No representar esa espera como FIFO si el modelo no lo
    garantiza.
-   [x] Registrar estructuradamente `P` bloqueado, `P` exitoso y `V`.
-   [x] Mostrar transiciones de valor de forma educativa.
-   [x] Incorporar tests de snapshots e historial.

### M7.6 --- Integración con análisis de interferencia

El análisis de M5 reconoce sincronización por regiones `atomic`, pero
todavía no modela protección mediante semáforos. Esta fase debe extender
el análisis sin reutilizar incorrectamente `atomicDepth`: `P` / `V` no
convierten toda la sección crítica en una única acción atómica.

-   [x] Diseñar cómo representar el contexto de sincronización
    introducido por semáforos.
-   [x] Mantener separada la semántica del scheduler de la clasificación
    de accesos.
-   [x] Reconocer accesos protegidos por un protocolo correcto de
    exclusión mutua.
-   [x] Mantener como problemáticos los accesos con protección
    unilateral o incorrecta.
-   [x] Definir el alcance sin afirmar todavía un detector formal
    completo basado en happens-before.
-   [x] Incorporar tests comparando accesos sin protección, con `atomic`
    y con semáforos.

### M7.7 --- Casos académicos

Los problemas clásicos deben expresarse como programas normales y su
comportamiento debe emerger del motor general.

-   [x] Probar exclusión mutua mediante `sem mutex = 1`.
-   [x] Probar señalización de eventos mediante un semáforo inicializado
    en `0`.
-   [x] Probar varios procesos esperando el mismo evento/recurso.
-   [x] Probar un semáforo contador con más de una unidad disponible.
-   [x] Incorporar Productor/Consumidor con buffer unitario.
-   [x] Incorporar Productor/Consumidor con recursos contados cuando la
    sintaxis lo permita.
-   [x] Incorporar un caso de barrera/señalización basado en la cátedra.
-   [x] Incorporar Lectores/Escritores cuando el lenguaje lo permita
    correctamente.
-   [x] Incorporar Filósofos Comensales cuando exista soporte suficiente
    para arrays de semáforos o una representación fiel.
-   [x] Verificar casos académicos con tests reproducibles.

### Decisiones diferidas

-   No implementar un tipo especial de semáforo binario en V1.
-   No asumir fairness débil/fuerte ni imponer FIFO.
-   No reservar permisos al reactivar procesos.
-   No modelar ownership del semáforo.
-   No implementar todavía arrays de semáforos.
-   No mezclar semáforos con memoria compartida ordinaria.
-   No reutilizar `atomicDepth` para representar secciones críticas
    protegidas con `P` / `V`.
-   Posponer un análisis formal happens-before hasta diseñar una fase
    adecuada.

**Estado:** M7 COMPLETADO. Semántica, modelo/AST, parser, runtime base,
historial/visualización, integración con el análisis y casos académicos
completados y verificados.

------------------------------------------------------------------------

## M8 --- Detector de errores y diagnósticos

M5 ya incorporó detección básica de accesos conflictivos y M7.6 extendió
las clasificaciones a `POTENTIAL_RACE`, `SYNCHRONIZED` y `UNKNOWN`. M8
debe evolucionar esa base, no duplicarla.

### Base ya disponible

-   [x] Registrar accesos relevantes a memoria compartida.
-   [x] Comparar accesos sobre `MemoryLocation` concretas.
-   [x] Detectar pares de accesos conflictivos.
-   [x] Clasificar conflictos como `POTENTIAL_RACE`, `SYNCHRONIZED` o
    `UNKNOWN`, con una razón estructurada.
-   [x] Resumir y visualizar conflictos básicos.

### Deadlock

-   [x] Definir formalmente qué estados considera deadlock el simulador.
-   [x] Diferenciar finalización, bloqueo temporal y deadlock.
-   [x] Diseñar dependencias entre procesos y recursos.
-   [x] Construir wait-for graph cuando exista información suficiente.
-   [x] Detectar ciclos de espera cuando corresponda.
-   [x] Mostrar procesos y recursos involucrados.
-   [x] Reproducir la ejecución que produjo el deadlock.
-   [x] Contemplar semáforos, monitores y comunicación mediante un
    modelo extensible de recursos; los adaptadores de monitores y
    canales se implementarán junto con esas primitivas.

### Race conditions y exclusión mutua

-   [x] Evolucionar el análisis básico de M5 hacia un modelo de
    sincronización más preciso.
-   [x] Integrar mecanismos distintos de `atomic`.
-   [x] Diagnosticar violaciones de exclusión mutua cuando exista
    información suficiente.
-   [x] Investigar un análisis formal de data races/happens-before
    apropiado para el alcance educativo.
-   [x] Evitar presentar `POTENTIAL_RACE` como prueba formal de una data
    race.

### Otros diagnósticos

-   [x] Detectar busy waiting cuando sea razonablemente identificable.
-   [x] Investigar detección útil de starvation/inanición.
-   [x] Diferenciar no terminación legítima de deadlock.
-   [x] Generar diagnósticos educativos explicando el problema.

**Estado:** M8 COMPLETADO. Deadlock, conflictos de memoria/exclusión
mutua y diagnósticos conservadores de liveness implementados y
verificados sobre la traza observada.

------------------------------------------------------------------------

## M9 --- Exploración de ejecuciones

M9 agrega exploración acotada de interleavings. No reemplaza los
schedulers de ejecución normal: enumera las transiciones habilitadas y
elige explícitamente cuál ejecutar en cada rama.

### Base ya disponible

-   [x] `ExecutionState` representa el runtime mutable del programa.
-   [x] El estado inicial se clona estructuralmente para `reset()`.
-   [x] Los schedulers actuales permiten reproducir una única traza.
-   [x] M8 diagnostica deadlock y conflictos sobre la traza observada.
-   [x] El deadlock observado puede reproducirse hasta su step de
    detección.

M9.1 extendió esta base con bifurcaciones independientes, enumeración de
alternativas habilitadas y ejecución explícita sin consultar al
scheduler.

### M9.1 --- Modelo de transiciones y estados clonables

-   [x] Separar estado semántico, metadata de análisis y traza.
-   [x] Definir `EnabledTransition` con la elección ejecutable de un
    proceso.
-   [x] Enumerar las transiciones habilitadas sin modificar el estado.
-   [x] Ejecutar explícitamente una transición seleccionada, sin pedir
    una decisión al scheduler.
-   [x] Respetar exclusión durante `atomic` y cuerpos habilitados de
    `await`.
-   [x] Clonar un estado intermedio completo sin compartir estructuras
    mutables.
-   [x] Verificar clonación durante funciones, loops, evaluaciones
    suspendidas y microoperaciones.

### M9.2 --- Explorador acotado

-   [x] Definir una clave canónica de estado que no incluya step ni
    historiales crecientes.
-   [x] Incluir en la clave la metadata que afecte semántica o futuros
    diagnósticos.
-   [x] Detectar estados repetidos mediante la clave canónica.
-   [x] Explorar primero en anchura para priorizar contraejemplos
    cortos.
-   [x] Limitar por separado profundidad y cantidad de estados.
-   [x] Informar `FOUND`, `EXHAUSTED` o `TRUNCATED`.
-   [x] Reportar cantidad de estados y transiciones exploradas.

### M9.3 --- Deadlock y contraejemplos reproducibles

-   [x] Usar deadlock como primera propiedad buscable.
-   [x] Encontrar un programa donde una traza termine y otra produzca
    deadlock.
-   [x] Guardar la secuencia exacta de elecciones de proceso.
-   [x] Representar un contraejemplo con propiedad, profundidad, límites
    y estado terminal.
-   [x] Reproducir el contraejemplo forzando la secuencia guardada, sin
    depender de una seed.
-   [x] Mostrar en la UI el resultado, los límites y la reproducción
    paso a paso.

### M9.4 --- Propiedades adicionales

-   [x] Definir una interfaz extensible para propiedades de exploración.
-   [x] Integrar violaciones observadas de exclusión mutua cuando el
    estado de análisis pueda clonarse y compararse correctamente.
-   [x] Evaluar assertions explícitas sobre estados finales como
    extensión futura del lenguaje.
-   [x] Mantener `POTENTIAL_RACE` como observación educativa y no como
    violación formal.
-   [x] No presentar una búsqueda acotada como prueba de ausencia de
    errores cuando el resultado sea `TRUNCATED`.

### Fuera del alcance inicial

-   Grafo visual completo del espacio de estados.
-   Partial-order reduction.
-   Happens-before formal.
-   Prueba de starvation o terminación.
-   Verificación exhaustiva sin límites.

**Principio:** una ejecución correcta no implica que el programa sea
correcto.

------------------------------------------------------------------------

## M10 --- Evolución del parser y lenguaje concurrente

El parser base fue implementado en M3.5 y ahora se extiende
incrementalmente dentro del milestone de cada primitiva. M10 queda para
mejoras transversales y extensiones futuras.

### Base ya disponible

-   [x] Sintaxis inicial, tokenizer, parser descendente recursivo y AST.
-   [x] Variables, declaraciones, expresiones y estructuras de control.
-   [x] Funciones y llamadas como expresiones.
-   [x] Procesos y errores con línea/columna.
-   [x] Transformar código fuente en representación ejecutable.
-   [x] Parsear `atomic`.
-   [x] Parsear `await`.
-   [x] Parsear declaraciones escalares de semáforos y operaciones `P` /
    `V`.
-   [x] Tests de tokenizer/parser para `atomic`, `await` y semáforos.

### Evolución pendiente

-   [ ] Mantener errores precisos al incorporar nuevas primitivas.
-   [ ] Agregar tests de tokenizer/parser por cada extensión.
-   [ ] Evaluar una fase explícita de validación semántica/símbolos
    cuando se justifique.
-   [ ] Parsear arrays de semáforos cuando se incorporen.
-   [ ] Parsear primitivas temporales.
-   [ ] Parsear monitores.
-   [ ] Parsear primitivas de pasaje de mensajes.

### M10.1 --- Estructuras de datos académicas

Las estructuras necesarias para expresar fielmente ejercicios de la
cátedra forman parte del lenguaje general y no deben reemplazarse por
excepciones específicas del ejemplo.

-   [x] Incorporar colas FIFO utilizables como variables locales o
    compartidas.
-   [x] Definir operaciones mínimas de cola: insertar, extraer,
    consultar frente, tamaño y consultar vacío.
-   [x] Incorporar pilas utilizables como variables locales o
    compartidas.
-   [x] Definir operaciones mínimas de pila: `push`, `pop`, `top`,
    tamaño y consultar vacío.
-   [x] Definir la granularidad atómica de operaciones sobre estructuras
    compartidas.
-   [x] Integrar colas FIFO y de prioridad con `RuntimeValue`,
    snapshots, clonación, claves canónicas y exploración de M9.
-   [x] Integrar pilas con `RuntimeValue`, snapshots, clonación, claves
    canónicas y exploración de M9.
-   [x] Agregar tests de colas FIFO y de prioridad para parser, runtime,
    snapshots, clonación e interleavings.
-   [x] Agregar tests equivalentes para pilas.
-   [x] Priorizar colas: ya son necesarias para representar ejercicios
    académicos sin deformar el pseudocódigo.
-   [x] Incorporar colas de prioridad como estructura separada.
-   [x] Definir que el mayor número representa mayor prioridad.
-   [x] Resolver empates de prioridad preservando orden FIFO.
-   [x] Incorporar procesos parametrizados o rangos de procesos para
    expresar declaraciones como `process controlador[i:0..3]`.

**Estado:** M10.1 COMPLETADO.

### M10.2 --- Registros, objetos y operaciones educativas simuladas

Siguiente evolución del lenguaje después de completar las estructuras de
datos primitivas y los procesos parametrizados de M10.1.

-   [x] Incorporar registros/estructuras con campos primitivos como representación
    mínima de datos compuestos.
-   [x] Incorporar acceso de lectura y escritura a campos como
    `fallo.nivel` y `fallo.id`, con granularidad independiente para
    memoria compartida.
-   [x] Incorporar getters automáticos como azúcar sintáctica, por
    ejemplo `fallo.getNivel()` y `fallo.getID()`, sin requerir
    orientación a objetos completa.
-   [x] Incorporar métodos simulados con comportamiento observable, por
    ejemplo `fallo.procesar()`.
-   [x] Incorporar `print(...)` como primera operación simulada para
    representar salida del pseudocódigo.
-   [x] Permitir que `print(...)` deje un evento observable en la traza
    sin realizar I/O real.
-   [x] Definir su granularidad: las lecturas compartidas de argumentos
    son microoperaciones y la emisión final consume una transición.
-   [x] Mantener `print(...)` determinista y compatible con clonación,
    reproducibilidad y exploración.
-   [x] Generalizar el mismo modelo a métodos como `fallo.procesar()`.

**Estado:** M10.2 COMPLETADO.

Flujo vigente:

`Pseudocódigo → Tokenizer → Parser → AST/Program → Simulation Engine`

------------------------------------------------------------------------

## M11 --- Visualización avanzada

La interfaz base fue implementada en M3.5 y crece junto con cada
primitiva. Las visualizaciones inseparables de una primitiva pueden
implementarse en su milestone; M11 concentra mejoras transversales.

### Base ya disponible

-   [x] Editor, Build, Step, Run y Reset.
-   [x] Schedulers seleccionables y Random reproducible.
-   [x] Panel de procesos, estados, program counter, memorias y call
    stack.
-   [x] Historial de ejecución y de microoperaciones.
-   [x] Visualización de conflictos básicos.
-   [x] Errores de tokenizer, parser y runtime.
-   [x] Visualización de `BLOCKED`.
-   [x] Visualización de la condición esperada por `await`.
-   [x] Distinción visual entre programa bloqueado y finalizado.

### Catálogo educativo de ejemplos

Este requerimiento queda separado de M8. Debe comenzar con los nueve
casos académicos de semáforos de M7 y quedar abierto a programas de
memoria compartida, `atomic`, `await`, monitores y futuros mecanismos.

-   [x] Definir un modelo `ProgramExample` con identificador, título,
    categoría, descripción, código fuente y scheduler recomendado.
-   [x] Extraer los programas académicos de M7 desde los tests hacia un
    catálogo compartido bajo `src/examples/`.
-   [x] Hacer que los tests y la interfaz consuman la misma fuente de
    ejemplos, evitando copias divergentes del pseudocódigo.
-   [x] Crear un componente `ExamplePicker` con botones o selector por
    categoría para cargar algoritmos comunes en el editor.
-   [x] Cargar también el scheduler recomendado, pero no ejecutar
    `Build` automáticamente.
-   [x] Advertir antes de reemplazar código que el usuario haya editado.
-   [x] Incorporar para los nueve temas de semáforos de M7 un par
    formado por el código con el problema y su solución correcta. Cada
    problema reproduce determinísticamente una race, un resultado
    incorrecto o un deadlock con el scheduler recomendado.
-   [ ] Incorporar progresivamente pares problema/solución de otros
    milestones, incluyendo memoria compartida, `atomic`, `await`,
    colas, pilas y registros.

### Visualización concurrente avanzada

-   [ ] Play / Pause continuo.
-   [ ] Control de velocidad.
-   [ ] Resaltar instrucción y microoperación actual.
-   [ ] Timeline visual de interleavings.
-   [ ] Mejorar historial visual de lecturas y escrituras.
-   [ ] Visualización explícita de regiones atómicas.
-   [ ] Visualización de semáforos y procesos esperando recursos.
-   [ ] Diagnósticos de concurrencia.
-   [ ] Visualización de deadlocks.
-   [ ] Reproducción de contraejemplos.
-   [ ] Visualización de canales y mensajes.
-   [ ] Visualización del tiempo simulado cuando se incorpore.

------------------------------------------------------------------------

## M12 --- Monitores

-   [ ] Declaración `monitor`.
-   [ ] Procedures.
-   [ ] Exclusión mutua implícita.
-   [ ] Variables condición.
-   [ ] `wait`.
-   [ ] `signal`.
-   [ ] `broadcast`.
-   [ ] Colas asociadas.
-   [ ] Visualización.
-   [ ] Buffer limitado con monitor.

------------------------------------------------------------------------

## M13 --- Pasaje de mensajes

Se reutiliza el mismo motor de simulación.

-   [ ] Variables locales aisladas.
-   [ ] Canales.
-   [ ] Mensajes.
-   [ ] `send`.
-   [ ] `receive`.
-   [ ] Pasaje de mensajes asincrónico.
-   [ ] Colas de mensajes.
-   [ ] Pasaje de mensajes sincrónico.
-   [ ] `sync_send`.
-   [ ] Bloqueo del emisor.
-   [ ] Deadlocks de comunicación.
-   [ ] Visualización de canales.
-   [ ] Animación de mensajes.
-   [ ] Restricciones educativas por paradigma.
-   [ ] Modo híbrido/avanzado.

------------------------------------------------------------------------

## M13.5 --- Scheduling avanzado y tiempo simulado

Estas funcionalidades se separan del lenguaje secuencial porque
modifican la relación entre procesos, scheduler y progreso temporal de
la simulación.

-   [ ] Definir modelo de tiempo simulado.
-   [ ] Definir tick global de simulación.
-   [ ] Definir semántica de `yield`.
-   [ ] Implementar `yield`.
-   [ ] Definir semántica de `sleep(ticks)`.
-   [ ] Implementar `sleep(ticks)`.
-   [ ] Representar procesos temporalmente no ejecutables.
-   [ ] Despertar procesos cuando corresponda.
-   [ ] Definir qué ocurre con el tiempo cuando ningún proceso está
    `READY`.
-   [ ] Integrar tiempo simulado con historial y snapshots.
-   [ ] Visualizar tick/tiempo actual.
-   [ ] Agregar tests deterministas de `yield` y `sleep`.

------------------------------------------------------------------------

## M14 --- Temas avanzados

No forman parte obligatoria de la primera versión.

-   [ ] CSP.
-   [ ] RPC.
-   [ ] Rendezvous.
-   [ ] Passing the Baton.
-   [ ] Barriers.
-   [ ] Otros mecanismos relevantes de la cursada.
-   [ ] Problemas clásicos adicionales.

------------------------------------------------------------------------

# Alcance propuesto de V1

La primera versión seria debería apuntar a:

-   Pseudocódigo básico y parser ejecutable.
-   Procesos.
-   Variables locales y compartidas.
-   Estructuras de control.
-   Funciones.
-   Scheduler e interleavings.
-   `await`.
-   Semáforos `P`/`V`.
-   Step / Run / Random / Reset.
-   Visualización de estados de procesos.
-   Memoria, recursos de sincronización y procesos bloqueados.
-   Detección de deadlock.
-   Detección básica de race conditions.
-   Exploración limitada de ejecuciones.
-   Problemas clásicos ejecutables.

Monitores y pasaje de mensajes pueden incorporarse posteriormente según
el avance de la materia.

------------------------------------------------------------------------

## Definition of Done

Un ticket se considera terminado cuando:

1.  La funcionalidad está implementada.
2.  Se verificó manualmente y/o mediante tests según corresponda.
3.  No rompe tests existentes.
4.  Se actualizó este backlog.
5.  Se actualizó `PROGRESS.md`.
6.  Si introdujo una decisión arquitectónica relevante, se documentó en
    `DECISIONS.md`.
7.  Si modificó la arquitectura actual, se actualizó `ARCHITECTURE.md`.
