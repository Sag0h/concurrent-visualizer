# Concurrent Visualizer --- Progreso

> Diario breve para poder retomar el proyecto después de una pausa o
> desde otro contexto.

## Estado actual

**Fase:** M4 — Control de ejecución, funciones y runtime de expresiones suspendibles.

**Último milestone completado:** M4 — Control de ejecución, funciones y runtime de expresiones suspendibles.

**Estado M4:** completado. El lenguaje y el engine soportan estructuras de control, loops, funciones, parámetros, call stack por proceso, `return` y llamadas a funciones dentro de expresiones sin introducir atomicidad artificial. El runtime suspendible utiliza una pila de evaluaciones pendientes por proceso y soporta continuaciones anidadas.

**Próximo objetivo:** actualizar la documentación técnica que todavía describa la arquitectura anterior (`docs/ARCHITECTURE.md`, `docs/DECISIONS.md` y `docs/SYNTAX.md`), verificar el backlog y comenzar el siguiente milestone orientado a primitivas específicamente concurrentes.

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

#### Visualizer MVP

- Se conectó el lenguaje con la interfaz React.
- Se agregó editor de código para el programa completo y acción `Build`.
- Los errores de tokenizer/parser se muestran con línea y columna.
- Se puede seleccionar scheduler desde la interfaz.
- El scheduler Random soporta seed reproducible y modo de seed aleatoria.
- Se agregaron controles `Step`, `Run` y `Reset`.
- Se visualizan procesos, memoria local, memoria compartida, historial y call stack.
- Se pueden agregar procesos desde la interfaz sin introducir indentación incorrecta en el código fuente.

#### Decisiones de arquitectura para funciones

- Las definiciones de funciones son globales y el código no se duplica por proceso.
- Cada proceso mantiene su propio `callStack`.
- Cada llamada crea un frame independiente con parámetros y variables locales.
- Las llamadas anidadas generan frames independientes y pueden visualizarse en la UI.
- Se agregó `return;` y `return expresión;`.
- `return` realiza unwind de los bloques internos hasta la frontera de la función, por lo que funciona dentro de `if` y loops anidados.
- Se agregó soporte para `-` unario para expresiones como `-5`, `-x` y `-(x + 1)`.

### M4 — Loops y control de ejecución

- Se agregó soporte para `for`.
- Se agregó soporte para `foreach`.
- Se agregó `break`.
- Se agregó `continue`.
- `break` afecta al loop más cercano.
- `continue` respeta la semántica del tipo de loop:
  - `while`: vuelve a evaluar la condición.
  - `repeat / until`: evalúa `until`.
  - `for`: ejecuta el incremento antes de volver a evaluar.
  - `foreach`: avanza al siguiente elemento.
- El `executionStack` fue extendido para representar distintos modos de finalización de bloques.
- Los loops pueden contener `if`, otros loops, `break` y `continue` anidados.

## 2026-08-27 --- M4: funciones y expresiones suspendibles

### Funciones y call stack

- Se implementaron definiciones y llamadas de funciones con parámetros.
- Cada proceso posee un `callStack` independiente.
- Los frames de llamada mantienen la memoria local de cada invocación.
- Una misma función puede ser llamada por distintos procesos sin compartir variables temporales.
- Las llamadas anidadas crean frames independientes.
- El call stack y las variables temporales de las funciones se exponen en `SimulationSnapshot` y se visualizan en la interfaz.
- Se implementó `return;` y `return expresión;`.
- Un `return` dentro de estructuras anidadas realiza unwind hasta el frame de retorno de la función.
- El valor retornado se preserva al completar la llamada.
- Las funciones usadas como expresión deben retornar un valor.

### Problema arquitectónico: llamadas a funciones dentro de expresiones

El evaluador original (`evaluateExpression`) era síncrono. Esto era correcto para `x + 1`, `a < b`, `!active` o `array[i]`, pero no para `int result = double(5)`, `if (isReady())` o `x = foo() + bar()`.

Una función puede contener múltiples instrucciones y debe ejecutarse durante varios steps. Ejecutarla completamente dentro de `evaluateExpression()` la convertiría artificialmente en una operación atómica y eliminaría posibles interleavings con otros procesos.

Por ese motivo se decidió no volver async el engine y no ejecutar funciones de forma atómica dentro del evaluador.

### Runtime de expresiones suspendibles

- Se agregó `FunctionCallExpression` al AST.
- El parser reconoce llamadas a funciones como expresiones, incluyendo llamadas anidadas.
- Cada proceso puede mantener una expresión y una instrucción pendientes.
- Cuando una expresión necesita ejecutar una función, la instrucción actual se suspende, la función se ejecuta mediante el call stack normal y consume steps normales del simulador.
- Al retornar, la llamada dentro del AST pendiente se reemplaza por un literal con el valor retornado.
- Si quedan más llamadas, se ejecuta la siguiente; cuando ya no quedan, la expresión restante se evalúa normalmente y se completa la instrucción original.

Ejemplo conceptual:

```text
double(double(5)) + 3
        |
        v
double(10) + 3
        |
        v
20 + 3
        |
        v
23
```

Este diseño conserva el comportamiento paso a paso y evita introducir atomicidad falsa.

### Orden de evaluación de llamadas

Para `add(double(5), double(10))` se procesa conceptualmente:

```text
double(5)  -> 10
double(10) -> 20
add(10,20) -> 30
```

Cada llamada continúa siendo una ejecución normal y puede ser intercalada por el scheduler.

### Contextos ya integrados con expresiones suspendibles

Actualmente el mecanismo se integró en:

- declaraciones (`DECLARE`);
- asignaciones (`ASSIGN`);
- condiciones de `if`;
- condiciones de `while`;
- condición `until` de `repeat / until`;
- condición de `for`.

### `foreach`: aclaración importante

`foreach` itera sobre un array, pero `instruction.collection` sigue siendo una expresión general.

`foreach (x in values)` no necesita suspensión si `values` ya es un array disponible. Sin embargo, si se permite `foreach (x in getValues())`, la colección también deberá pasar por el runtime suspendible.

El cuerpo del `foreach` ya puede contener instrucciones con funciones suspendibles normalmente.

### Contextos de expresión todavía a revisar

Antes de cerrar la integración hay que revisar sistemáticamente todos los lugares donde el engine llama a `evaluateExpression()`:

- `RETURN`: `return foo();` y `return foo() + 1;`.
- Argumentos de llamadas usadas como instrucción: `foo(bar())`.
- Colección de `foreach`: `foreach (x in getValues())`.
- Índices de arrays: `array[getIndex()]`.
- Targets de asignación a arrays: `array[getIndex()] = value`.
- Cualquier nuevo contexto que evalúe una `Expression`.

Regla arquitectónica:

> No llamar directamente a `evaluateExpression()` sobre una expresión que pueda contener `FUNCTION_CALL` sin antes pasar por el mecanismo suspendible.

### Robustez de Step y Run

Durante la implementación se detectó que una excepción podía dejar un proceso en `RUNNING`. Luego `Run` podía entrar en un loop infinito: el scheduler solo seleccionaba `READY`, no había progreso, `isFinished()` seguía falso y el contador de steps no avanzaba.

Se modificó `SimulationEngine.step()` para devolver:

- `true`: hubo progreso real;
- `false`: no se pudo ejecutar un step.

Además:

- si una instrucción falla, el proceso vuelve a `READY` antes de propagar el error;
- el historial registra instrucciones completadas correctamente;
- `Run` corta si `step()` devuelve `false`;
- los errores de runtime se capturan y muestran en la UI.

Esta decisión será importante cuando existan procesos `BLOCKED`, deadlocks y primitivas de sincronización.

### Estado de M4

M4 incluye actualmente:

- `if / else`;
- `while`;
- `repeat / until`;
- `for`;
- `foreach`;
- `break`;
- `continue`;
- funciones y parámetros;
- variables locales por llamada;
- call stack por proceso;
- `return`;
- llamadas a funciones dentro de expresiones con suspensión.

La semántica de `continue` es:

- `while`: vuelve a evaluar la condición;
- `repeat / until`: evalúa `until`;
- `for`: ejecuta el incremento antes de volver a evaluar;
- `foreach`: avanza al siguiente elemento.

### Casos probados manualmente

El núcleo suspendible fue probado con:

```text
int result = double(5);
int result = double(5) + 3;
int result = double(double(5));
int result = double(5) + double(10);
add(double(5), double(10));
```

También se probaron funciones con `return`, incluyendo retornos desde estructuras de control anidadas.

### Próximo objetivo recomendado

1. Completar los contextos pendientes (`RETURN`, argumentos de `CALL`, colección de `foreach` e índices de arrays).
2. Agregar tests automáticos específicos del runtime suspendible.
3. Ejecutar `npm test`, `npm run lint` y `npm run build`.
4. Cerrar M4 con un commit estable.
5. Actualizar `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` y `docs/SYNTAX.md` si todavía describen la arquitectura previa.
6. Recién después avanzar a primitivas específicamente concurrentes.


## 2026-08-27 — M4 completado: runtime suspendible

### Pila de evaluaciones pendientes

Durante las pruebas de llamadas anidadas se detectó una limitación importante del diseño inicial del runtime suspendible.

Un único estado pendiente por proceso no era suficiente para representar casos como:

```text
result = calculate(5);

function calculate(int value) {
  return double(value) + 1;
}