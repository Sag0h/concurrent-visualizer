# Concurrent Visualizer --- Progreso

> Diario breve para poder retomar el proyecto después de una pausa o
> desde otro contexto.

## Estado actual

**Fase:** M3.5 — Visualizer MVP ejecutable.

**Último milestone completado:** M3 — Memoria, variables, expresiones y arrays.

**Estado M3.5:** sintaxis V0 definida, tokenizer y parser mínimo implementados.

**Próximo objetivo:** conectar el parser con React mediante un editor de código real, permitir seleccionar el scheduler y construir/ejecutar el programa escrito por el usuario.

------------------------------------------------------------------------

## 2026-08-26 --- Inicio del proyecto

### Completado

-   Se eligió desarrollar Concurrent Visualizer.
-   Se decidió utilizar una aplicación web.
-   Stack seleccionado:
    -   React;
    -   TypeScript;
    -   Vite;
    -   ESLint.
-   Se creó el proyecto Vite.
-   Se instaló el proyecto en una VM Debian alojada en Google Cloud.
-   La aplicación fue levantada correctamente mediante `npm run dev`.
-   Se inicializó Git.
-   Se realizó el primer commit:
    -   `Initial React Typescript project`.
-   Se definió conceptualmente que el motor será independiente de React.
-   Se decidió utilizar un único framework para memoria compartida y
    pasaje de mensajes.
-   Se decidió permitir a futuro un modo híbrido, manteniendo
    restricciones educativas por paradigma.
-   Se decidió utilizar tiempo simulado.
-   Se decidió postergar el parser hasta tener un motor funcional.
-   Se definió que el simulador deberá permitir estructuras secuenciales
    convencionales.
-   Se definió como objetivo detectar y reproducir errores reales de
    concurrencia.
-   Se definió como objetivo futuro explorar múltiples interleavings.
-   Se creó el backlog inicial del proyecto.

### Material académico disponible

Se dispone de:

-   Teoría 1 de Programación Concurrente 2026.
-   Material histórico completo aproximado de la cursada 2015.
-   Versiones alternativas de varias clases históricas.

El material histórico incluye temas como:

-   fundamentos de concurrencia;
-   acciones atómicas;
-   interferencia;
-   sección crítica;
-   `await`;
-   semáforos;
-   monitores;
-   productor/consumidor;
-   lectores/escritores;
-   programación distribuida;
-   pasaje de mensajes asincrónico;
-   pasaje de mensajes sincrónico;
-   CSP;
-   RPC;
-   Rendezvous;
-   Passing the Baton;
-   programación paralela.

Debe verificarse la semántica concreta contra material actual antes de
implementar primitivas avanzadas.


### Nota para retomar

Antes de continuar después de una pausa:

1.  Leer `BACKLOG.md`.
2.  Leer este archivo desde la entrada más reciente.
3.  Revisar `docs/DECISIONS.md`.
4.  Consultar `docs/ARCHITECTURE.md` para conocer la arquitectura
    vigente.
5.  Ejecutar los tests existentes.
6.  Continuar únicamente desde el próximo ticket pendiente.

### M1 — Program y ExecutionState

- Se creó `Program` como contenedor de procesos.
- Se creó `ExecutionState` como estado global de la simulación.
- Se agregó `createExecutionState()` para inicializar simulaciones con `stepCount = 0`.

### M2 — Random Scheduler

- Se implementó `RandomScheduler`.
- Solo selecciona procesos en estado `READY`.
- Se agregó `SeededRandom` para evitar depender de `Math.random()`.
- Una misma seed genera la misma secuencia de scheduling.
- Se agregaron tests de reproducibilidad y selección válida.
- Se agregó `ExecutionEvent`.
- `ExecutionState` mantiene el historial de instrucciones ejecutadas.
- Cada evento registra número de step, proceso e instrucción.
- El historial queda disponible para futuras visualizaciones, debugging y reproducción de ejecuciones.
- `SimulationEngine` guarda un estado inicial clonable.
- Se agregó `reset()`.
- Se agregó un límite máximo configurable de steps.
- Se agregó `hasReachedStepLimit()`.
- El límite evita ejecuciones infinitas sin control.

### M3 — Declaraciones y expresiones

- Se agregaron expresiones literales, variables, binarias y unarias.
- Se implementó evaluación de expresiones aritméticas, booleanas y comparaciones.
- Se agregaron factories para construir expresiones.
- Se agregó la instrucción `ASSIGN`.
- Se agregó la instrucción `DECLARE`.
- El engine puede declarar y modificar variables locales y compartidas.
- Se agregaron tests de scopes, shadowing, declaraciones y asignaciones.
- Se agregó soporte para `string` como `RuntimeValue`.
- El operador `+` soporta suma numérica y concatenación entre strings.
- Se agregó soporte para arrays básicos de `int`, `bool` y `string`.
- Se implementó lectura de arrays mediante índices y expresiones.
- Se implementó asignación a posiciones de arrays.
- Los arrays anidados quedan explícitamente fuera del alcance actual.
- Se agregó `AssignmentTarget` para diferenciar variables simples de accesos a arrays.
- Se agregó `SimulationSnapshot`.
- `SimulationEngine.getSnapshot()` expone el estado necesario para visualización.
- Los snapshots clonan las memorias para impedir que la UI modifique accidentalmente el estado interno del engine.
- M3 queda completado.
### M3.5 — Lenguaje y Visualizer MVP

#### Sintaxis V0

- Se definió la primera versión de la sintaxis del lenguaje del simulador.
- Se documentó en `docs/SYNTAX.md`.
- La sintaxis V0 soporta variables compartidas con `shared`, procesos mediante `process`, variables locales, tipos `int`, `bool` y `string`, arrays básicos, asignaciones, expresiones aritméticas, comparaciones, expresiones booleanas y acceso/escritura en arrays.
- El scheduler se mantiene fuera del código fuente y será seleccionado desde la interfaz.
- Se decidió utilizar un único editor para el programa completo.
- Los procesos finalizan automáticamente al consumir todas sus instrucciones.

#### Tokenizer

- Se creó el tokenizer inicial del lenguaje.
- Reconoce keywords, identificadores, números, strings y booleanos.
- Reconoce delimitadores, arrays y operadores.
- Se soportan comentarios de una línea mediante `//`.
- Cada token conserva línea y columna para permitir errores de sintaxis precisos.
- Se agregó `TokenizerError`.
- Se agregaron tests del tokenizer.

#### Parser

- Se implementó un parser descendente recursivo (`recursive descent parser`).
- `parseProgram(source)` convierte código fuente directamente en un `Program` ejecutable por el motor.
- Se implementó parsing de variables compartidas, procesos, declaraciones locales, asignaciones, lectura/escritura de arrays y expresiones.
- El parser respeta precedencia de operadores: `||`, `&&`, igualdad, comparaciones, suma/resta, multiplicación/división, `!` y expresiones primarias.
- Se soportan paréntesis para modificar la precedencia.
- Se agregó `ParserError` con información de línea y columna.
- Se agregaron tests del parser.
- El lenguaje escrito por el usuario ya puede transformarse en las mismas estructuras internas utilizadas por `SimulationEngine`.

#### Decisiones para funciones futuras

- Las funciones y módulos todavía no están implementados.
- Las definiciones de funciones serán globales e inmutables.
- Cada proceso tendrá su propio contexto de ejecución de una función.
- Se planea implementar un call stack por proceso.
- Cada llamada tendrá su propio stack frame con parámetros, variables locales y dirección de retorno.
- El código de una función no será duplicado por proceso.
- Esta arquitectura permitirá posteriormente visualizar llamadas, retornos y stacks de procesos independientemente.

#### Próximo paso

Conectar el lenguaje con la interfaz React: editor de código, `Build`, errores de tokenizer/parser, selector de scheduler, seed de Random, `Step`, `Run`, `Reset`, visualización de procesos/memoria e historial.
