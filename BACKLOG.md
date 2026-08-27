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

## M3.5 — Visualizer MVP ejecutable

- [x] Definir y documentar sintaxis V0 del pseudocódigo.
- [x] Crear tokenizer mínimo.
- [x] Crear parser mínimo.
- [x] Parsear variables compartidas.
- [x] Parsear procesos.
- [x] Parsear variables locales.
- [x] Parsear asignaciones.
- [x] Parsear expresiones.
- [x] Parsear arrays básicos.
- [x] Convertir código en `Program`.
- [x] Mostrar errores de sintaxis.
- [x] Crear editor de código.
- [x] Permitir agregar procesos desde la UI.
- [x] Ejecutar el código escrito por el usuario.
- [x] Selector de scheduler.
- [x] First Ready.
- [x] Round Robin.
- [x] Random.
- [x] Seed configurable para Random.
- [x] Botón `Step`.
- [x] Botón `Reset`.
- [x] Botón `Run`.
- [x] Mostrar `stepCount`.
- [x] Mostrar procesos.
- [x] Mostrar estado de cada proceso.
- [x] Mostrar `programCounter`.
- [x] Mostrar memoria local.
- [x] Mostrar memoria compartida.
- [x] Mostrar historial de ejecución.
------------------------------------------------------------------------

## M4 --- Lenguaje secuencial

Cada proceso concurrente debe poder comportarse como un programa
secuencial normal antes de introducir primitivas específicamente
concurrentes.

### Control de flujo

- [x] Bloques de instrucciones.
- [x] `if`.
- [x] `if / else`.
- [x] `while`.
- [x] `repeat / until`.
- [x] `for`.
- [x] `foreach`.
- [x] `break`.
- [x] `continue`.

### Funciones

- [x] Definiciones de funciones.
- [x] Llamadas a funciones.
- [x] Parámetros.
- [x] Variables locales de función.
- [x] Call stack independiente por proceso.
- [x] Llamadas anidadas.
- [x] `return;`.
- [x] `return expression;`.
- [x] `return` desde bloques de control anidados.
- [x] Funciones utilizadas como expresiones.
- [x] Llamadas a funciones anidadas dentro de expresiones.
- [x] Funciones vacías.

### Runtime de expresiones suspendibles

- [x] `FunctionCallExpression` en el AST.
- [x] Suspensión y reanudación de expresiones.
- [x] Pila `pendingEvaluations` independiente por proceso.
- [x] Continuaciones anidadas.
- [x] Evaluación suspendible en `DECLARE`.
- [x] Evaluación suspendible en `ASSIGN`.
- [x] Evaluación suspendible en condiciones de `if`.
- [x] Evaluación suspendible en condiciones de `while`.
- [x] Evaluación suspendible en condiciones de `repeat / until`.
- [x] Evaluación suspendible en condiciones de `for`.
- [x] Evaluación suspendible en colecciones de `foreach`.
- [x] Evaluación suspendible en `return`.
- [x] Evaluación suspendible en argumentos de llamadas.
- [x] Evaluación suspendible en índices de arrays.
- [x] Evaluación suspendible en targets de asignación a arrays.
- [x] Múltiples llamadas dentro de una misma expresión.
- [x] Aislamiento del runtime suspendible entre procesos.

### Robustez del runtime

- [x] `step()` informa si hubo progreso.
- [x] Restaurar proceso a `READY` ante errores de runtime.
- [x] Evitar loops infinitos de `Run` cuando no hay progreso.
- [x] Registrar en historial únicamente instrucciones completadas.
- [x] Mostrar errores de runtime en la interfaz.
- [x] Auditar usos directos de `evaluateExpression()`.

### Tests

- [x] Tests unitarios del engine.
- [x] Tests de integración parser + engine.
- [x] Test de llamadas anidadas.
- [x] Test de llamadas en múltiples argumentos.
- [x] Test de llamadas en `foreach`.
- [x] Test de llamadas en índices de arrays.
- [x] Test de llamadas en `repeat / until`.
- [x] Test de llamadas en condición de `for`.
- [x] Test de aislamiento entre procesos.

**Estado:** M4 COMPLETADO.

------------------------------------------------------------------------

## M5 --- Atomicidad e interferencia

Este milestone introduce la primera semántica específicamente concurrente
del simulador. Antes de implementar primitivas de sincronización debe quedar
definida la unidad mínima de ejecución que puede intercalarse con otro proceso.

### Modelo de ejecución

-   [ ] Definir formalmente qué constituye una acción atómica en el simulador.
-   [ ] Distinguir instrucciones del pseudocódigo de microoperaciones internas.
-   [ ] Definir qué microoperaciones pueden intercalarse entre procesos.
-   [ ] Definir cómo interactúan las microoperaciones con `step()` y los schedulers.
-   [ ] Permitir nivel de detalle por instrucción o por operación atómica.

### Microoperaciones y memoria

-   [ ] Diseñar representación interna de microoperaciones.
-   [ ] Descomponer operaciones cuando sea necesario para visualizar interferencia.
-   [ ] Representar explícitamente lecturas de memoria compartida.
-   [ ] Representar explícitamente escrituras de memoria compartida.
-   [ ] Representar operaciones intermedias necesarias para expresiones como `x = x + 1`.
-   [ ] Mantener historial de lecturas y escrituras.
-   [ ] Registrar qué proceso realizó cada acceso y en qué step.

### Interferencia e interleavings

-   [ ] Registrar accesos concurrentes a memoria.
-   [ ] Visualizar interleavings a nivel de microoperación.
-   [ ] Crear ejemplo real y reproducible de race condition.
-   [ ] Mantener compatibilidad con seeds reproducibles del scheduler Random.

### Atomicidad explícita

-   [ ] Definir sintaxis/representación de secciones atómicas.
-   [ ] Implementar secciones atómicas.
-   [ ] Impedir interleavings dentro de una sección atómica.
-   [ ] Visualizar cuándo un proceso está ejecutando una región atómica.
-   [ ] Agregar tests que comparen ejecución protegida y no protegida.

**Caso de prueba principal:** dos procesos ejecutan:

```text
shared int x = 0;

process P1 {
    x = x + 1;
}

process P2 {
    x = x + 1;
}
```

Debe existir una ejecución válida donde ambos procesos lean `x = 0` antes
de escribir y el resultado final sea `x = 1`.

Al proteger correctamente la operación mediante atomicidad explícita, el
resultado deberá ser `x = 2`.

------------------------------------------------------------------------

## M6 --- `await`

-   [ ] Representar `<await (B); S>`.
-   [ ] Evaluar la guarda `B`.
-   [ ] Bloquear el proceso cuando corresponda.
-   [ ] Reactivar procesos.
-   [ ] Ejecutar `S` con la atomicidad definida por la cátedra.
-   [ ] Visualizar la condición esperada.
-   [ ] Incorporar ejercicios reales de la materia como pruebas.

------------------------------------------------------------------------

## M7 --- Semáforos

-   [ ] Crear tipo `Semaphore`.
-   [ ] Mantener valor del semáforo.
-   [ ] Implementar `P`.
-   [ ] Implementar `V`.
-   [ ] Cola de procesos bloqueados.
-   [ ] Semáforos binarios.
-   [ ] Semáforos generales.
-   [ ] Exclusión mutua.
-   [ ] Sincronización por condición.
-   [ ] Visualización de semáforos y colas.
-   [ ] Productor/Consumidor.
-   [ ] Lectores/Escritores.
-   [ ] Mesa redonda / Filósofos comensales.

------------------------------------------------------------------------

## M8 --- Detector de errores

-   [ ] Detectar deadlock.
-   [ ] Construir wait-for graph.
-   [ ] Detectar ciclos de espera.
-   [ ] Mostrar procesos y recursos involucrados.
-   [ ] Reproducir ejecución que produjo un deadlock.
-   [ ] Detectar violaciones de exclusión mutua.
-   [ ] Detectar posibles race conditions.
-   [ ] Detectar busy waiting.
-   [ ] Investigar detección útil de starvation/inanición.
-   [ ] Diferenciar no terminación legítima de deadlock.
-   [ ] Generar diagnósticos educativos.

------------------------------------------------------------------------

## M9 --- Exploración de ejecuciones

-   [ ] Representar completamente un estado de ejecución.
-   [ ] Clonar estados.
-   [ ] Explorar elecciones alternativas del scheduler.
-   [ ] Detectar estados repetidos.
-   [ ] Limitar profundidad y cantidad de estados.
-   [ ] Buscar deadlocks.
-   [ ] Buscar violaciones de propiedades.
-   [ ] Guardar contraejemplos.
-   [ ] Reproducir contraejemplos visualmente.

**Principio:** una ejecución correcta no implica que el programa sea
correcto.

------------------------------------------------------------------------

## M10 --- Extensiones del parser y lenguaje concurrente

El parser base ya fue implementado en M3.5 y extendido durante M4.
Este milestone queda reservado para integrar al lenguaje las primitivas
concurrentes desarrolladas en milestones posteriores.

### Base ya disponible

-   [x] Sintaxis inicial.
-   [x] Tokenizer.
-   [x] Parser descendente recursivo.
-   [x] AST.
-   [x] Variables y declaraciones.
-   [x] Expresiones.
-   [x] Estructuras de control.
-   [x] Funciones y llamadas como expresiones.
-   [x] Procesos.
-   [x] Mensajes de error.
-   [x] Posiciones de línea y columna.
-   [x] Transformar código fuente en representación ejecutable.

### Extensiones concurrentes

-   [ ] Parsear secciones atómicas.
-   [ ] Parsear `await`.
-   [ ] Parsear semáforos y operaciones `P` / `V`.
-   [ ] Parsear primitivas temporales cuando se incorporen.
-   [ ] Parsear monitores.
-   [ ] Parsear primitivas de pasaje de mensajes.
-   [ ] Mantener errores de sintaxis precisos para las nuevas primitivas.
-   [ ] Agregar tests de parser por cada extensión concurrente.

Flujo vigente:

`Pseudocódigo → Tokenizer → Parser → AST/Program → Simulation Engine`

------------------------------------------------------------------------

## M11 --- Visualización avanzada

La interfaz base ya fue implementada en M3.5. Este milestone amplía el
Visualizer a medida que aparecen conceptos específicamente concurrentes.

### Base ya disponible

-   [x] Editor de código.
-   [x] Build del programa.
-   [x] Step.
-   [x] Run.
-   [x] Reset.
-   [x] Ejecución aleatoria.
-   [x] Selector de scheduler.
-   [x] Seed reproducible para Random.
-   [x] Panel de procesos.
-   [x] Estado de cada proceso.
-   [x] Program counter.
-   [x] Memoria compartida.
-   [x] Memoria local.
-   [x] Call stack.
-   [x] Historial de ejecución.
-   [x] Errores de tokenizer, parser y runtime.

### Visualización concurrente avanzada

-   [ ] Play / Pause continuo.
-   [ ] Control de velocidad.
-   [ ] Instrucción y microoperación actual.
-   [ ] Timeline visual de interleavings.
-   [ ] Historial visual de lecturas y escrituras.
-   [ ] Visualización de regiones atómicas.
-   [ ] Semáforos.
-   [ ] Colas de procesos bloqueados.
-   [ ] Condiciones de `await`.
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

Estas funcionalidades se separan del lenguaje secuencial porque modifican
la relación entre procesos, scheduler y progreso temporal de la simulación.

-   [ ] Definir modelo de tiempo simulado.
-   [ ] Definir tick global de simulación.
-   [ ] Definir semántica de `yield`.
-   [ ] Implementar `yield`.
-   [ ] Definir semántica de `sleep(ticks)`.
-   [ ] Implementar `sleep(ticks)`.
-   [ ] Representar procesos temporalmente no ejecutables.
-   [ ] Despertar procesos cuando corresponda.
-   [ ] Definir qué ocurre con el tiempo cuando ningún proceso está `READY`.
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
-   Memoria y colas.
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
    `docs/DECISIONS.md`.
7.  Si modificó la arquitectura actual, se actualizó
    `docs/ARCHITECTURE.md`.
