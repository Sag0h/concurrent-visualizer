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
-   [ ] Exponer estado de memoria para visualización.

------------------------------------------------------------------------

## M4 --- Lenguaje secuencial

Cada proceso concurrente debe poder comportarse como un programa
secuencial normal.

-   [ ] Bloques de instrucciones.
-   [ ] `if`.
-   [ ] `if / else`.
-   [ ] `while`.
-   [ ] `repeat / until`.
-   [ ] `for`.
-   [ ] `foreach`.
-   [ ] `break`.
-   [ ] `continue`.
-   [ ] Funciones.
-   [ ] Parámetros.
-   [ ] Variables locales de función.
-   [ ] `return`.
-   [ ] Call stack.
-   [ ] Funciones vacías.
-   [ ] `yield`.
-   [ ] `sleep(ticks)`.
-   [ ] Tiempo simulado.

------------------------------------------------------------------------

## M5 --- Atomicidad e interferencia

-   [ ] Definir formalmente qué constituye una acción atómica en el
    simulador.
-   [ ] Distinguir instrucciones del pseudocódigo de microoperaciones
    internas.
-   [ ] Descomponer operaciones cuando sea necesario para visualizar
    interferencia.
-   [ ] Implementar secciones atómicas.
-   [ ] Registrar accesos concurrentes a memoria.
-   [ ] Visualizar interleavings.
-   [ ] Crear ejemplo real de race condition.
-   [ ] Mantener historial de lecturas y escrituras.
-   [ ] Permitir nivel de detalle por instrucción o por operación
    atómica.

**Caso de prueba:** dos procesos ejecutan `x = x + 1` y debe ser posible
observar una ejecución problemática cuando la semántica lo permita.

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

## M10 --- Parser del pseudocódigo

El parser se incorpora cuando el motor ya sea funcional.

-   [ ] Definir sintaxis inicial.
-   [ ] Tokenizer.
-   [ ] Parser.
-   [ ] AST.
-   [ ] Variables y declaraciones.
-   [ ] Expresiones.
-   [ ] Estructuras de control.
-   [ ] Funciones.
-   [ ] Procesos.
-   [ ] `await`.
-   [ ] Semáforos.
-   [ ] Mensajes de error.
-   [ ] Posiciones de línea y columna.
-   [ ] Transformar AST en representación ejecutable.

Flujo esperado:

`Pseudocódigo → Parser → AST → Simulation Engine`

------------------------------------------------------------------------

## M11 --- Interfaz visual

-   [ ] Editor de código.
-   [ ] Play.
-   [ ] Pause.
-   [ ] Step.
-   [ ] Reset.
-   [ ] Ejecución aleatoria.
-   [ ] Selector de scheduler.
-   [ ] Control de velocidad.
-   [ ] Panel de procesos.
-   [ ] Estado de cada proceso.
-   [ ] Instrucción actual.
-   [ ] Memoria compartida.
-   [ ] Memoria local.
-   [ ] Semáforos.
-   [ ] Colas de espera.
-   [ ] Timeline.
-   [ ] Event log.
-   [ ] Diagnósticos.
-   [ ] Reproducción de contraejemplos.

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

-   Pseudocódigo básico.
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
5.  Se actualizó `docs/PROGRESS.md`.
6.  Si introdujo una decisión arquitectónica relevante, se documentó en
    `docs/DECISIONS.md`.
7.  Si modificó la arquitectura actual, se actualizó
    `docs/ARCHITECTURE.md`.
