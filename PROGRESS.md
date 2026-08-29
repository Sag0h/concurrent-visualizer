# Concurrent Visualizer --- Progreso

> Diario breve para poder retomar el proyecto después de una pausa o
> desde otro contexto.

## Estado actual

**Fase:** M7 --- Semáforos.

**Último milestone completado:** M6 --- `await`.

**Estado M6:** completado. El lenguaje y el engine soportan acciones
atómicas condicionales mediante `await (B);` y `await (B) { S }`,
procesos `BLOCKED`, reactivación sin reserva, reevaluación de guardas,
historial/visualización de esperas y casos académicos representativos.

**Estado M7:** en progreso. Ya están completadas la semántica de
semáforos generales/contadores, su modelo y AST, el tokenizer/parser,
el runtime base de `P` / `V`, su historial/visualización y la integración
con el análisis de interferencia.

**Próximo objetivo:** continuar M7.7 con casos académicos reproducibles
de exclusión mutua, señalización y recursos contados.

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

### M1 --- Program y ExecutionState

-   Se creó `Program` como contenedor de procesos.
-   Se creó `ExecutionState` como estado global de la simulación.
-   Se agregó `createExecutionState()` para inicializar simulaciones con
    `stepCount = 0`.

### M2 --- Random Scheduler

-   Se implementó `RandomScheduler`.
-   Solo selecciona procesos en estado `READY`.
-   Se agregó `SeededRandom` para evitar depender de `Math.random()`.
-   Una misma seed genera la misma secuencia de scheduling.
-   Se agregaron tests de reproducibilidad y selección válida.
-   Se agregó `ExecutionEvent`.
-   `ExecutionState` mantiene el historial de instrucciones ejecutadas.
-   Cada evento registra número de step, proceso e instrucción.
-   El historial queda disponible para futuras visualizaciones,
    debugging y reproducción de ejecuciones.
-   `SimulationEngine` guarda un estado inicial clonable.
-   Se agregó `reset()`.
-   Se agregó un límite máximo configurable de steps.
-   Se agregó `hasReachedStepLimit()`.
-   El límite evita ejecuciones infinitas sin control.

### M3 --- Declaraciones y expresiones

-   Se agregaron expresiones literales, variables, binarias y unarias.
-   Se implementó evaluación de expresiones aritméticas, booleanas y
    comparaciones.
-   Se agregaron factories para construir expresiones.
-   Se agregó la instrucción `ASSIGN`.
-   Se agregó la instrucción `DECLARE`.
-   El engine puede declarar y modificar variables locales y
    compartidas.
-   Se agregaron tests de scopes, shadowing, declaraciones y
    asignaciones.
-   Se agregó soporte para `string` como `RuntimeValue`.
-   El operador `+` soporta suma numérica y concatenación entre strings.
-   Se agregó soporte para arrays básicos de `int`, `bool` y `string`.
-   Se implementó lectura de arrays mediante índices y expresiones.
-   Se implementó asignación a posiciones de arrays.
-   Los arrays anidados quedan explícitamente fuera del alcance actual.
-   Se agregó `AssignmentTarget` para diferenciar variables simples de
    accesos a arrays.
-   Se agregó `SimulationSnapshot`.
-   `SimulationEngine.getSnapshot()` expone el estado necesario para
    visualización.
-   Los snapshots clonan las memorias para impedir que la UI modifique
    accidentalmente el estado interno del engine.
-   M3 queda completado. \### M3.5 --- Lenguaje y Visualizer MVP

#### Sintaxis V0

-   Se definió la primera versión de la sintaxis del lenguaje del
    simulador.
-   Se documentó en `docs/SYNTAX.md`.
-   La sintaxis V0 soporta variables compartidas con `shared`, procesos
    mediante `process`, variables locales, tipos `int`, `bool` y
    `string`, arrays básicos, asignaciones, expresiones aritméticas,
    comparaciones, expresiones booleanas y acceso/escritura en arrays.
-   El scheduler se mantiene fuera del código fuente y será seleccionado
    desde la interfaz.
-   Se decidió utilizar un único editor para el programa completo.
-   Los procesos finalizan automáticamente al consumir todas sus
    instrucciones.

#### Tokenizer

-   Se creó el tokenizer inicial del lenguaje.
-   Reconoce keywords, identificadores, números, strings y booleanos.
-   Reconoce delimitadores, arrays y operadores.
-   Se soportan comentarios de una línea mediante `//`.
-   Cada token conserva línea y columna para permitir errores de
    sintaxis precisos.
-   Se agregó `TokenizerError`.
-   Se agregaron tests del tokenizer.

#### Parser

-   Se implementó un parser descendente recursivo
    (`recursive descent parser`).
-   `parseProgram(source)` convierte código fuente directamente en un
    `Program` ejecutable por el motor.
-   Se implementó parsing de variables compartidas, procesos,
    declaraciones locales, asignaciones, lectura/escritura de arrays y
    expresiones.
-   El parser respeta precedencia de operadores: `||`, `&&`, igualdad,
    comparaciones, suma/resta, multiplicación/división, `!` y
    expresiones primarias.
-   Se soportan paréntesis para modificar la precedencia.
-   Se agregó `ParserError` con información de línea y columna.
-   Se agregaron tests del parser.
-   El lenguaje escrito por el usuario ya puede transformarse en las
    mismas estructuras internas utilizadas por `SimulationEngine`.

#### Visualizer MVP

-   Se conectó el lenguaje con la interfaz React.
-   Se agregó editor de código para el programa completo y acción
    `Build`.
-   Los errores de tokenizer/parser se muestran con línea y columna.
-   Se puede seleccionar scheduler desde la interfaz.
-   El scheduler Random soporta seed reproducible y modo de seed
    aleatoria.
-   Se agregaron controles `Step`, `Run` y `Reset`.
-   Se visualizan procesos, memoria local, memoria compartida, historial
    y call stack.
-   Se pueden agregar procesos desde la interfaz sin introducir
    indentación incorrecta en el código fuente.

#### Decisiones de arquitectura para funciones

-   Las definiciones de funciones son globales y el código no se duplica
    por proceso.
-   Cada proceso mantiene su propio `callStack`.
-   Cada llamada crea un frame independiente con parámetros y variables
    locales.
-   Las llamadas anidadas generan frames independientes y pueden
    visualizarse en la UI.
-   Se agregó `return;` y `return expresión;`.
-   `return` realiza unwind de los bloques internos hasta la frontera de
    la función, por lo que funciona dentro de `if` y loops anidados.
-   Se agregó soporte para `-` unario para expresiones como `-5`, `-x` y
    `-(x + 1)`.

### M4 --- Loops y control de ejecución

-   Se agregó soporte para `for`.
-   Se agregó soporte para `foreach`.
-   Se agregó `break`.
-   Se agregó `continue`.
-   `break` afecta al loop más cercano.
-   `continue` respeta la semántica del tipo de loop:
    -   `while`: vuelve a evaluar la condición.
    -   `repeat / until`: evalúa `until`.
    -   `for`: ejecuta el incremento antes de volver a evaluar.
    -   `foreach`: avanza al siguiente elemento.
-   El `executionStack` fue extendido para representar distintos modos
    de finalización de bloques.
-   Los loops pueden contener `if`, otros loops, `break` y `continue`
    anidados.

## 2026-08-27 --- M4: funciones y expresiones suspendibles

### Funciones y call stack

-   Se implementaron definiciones y llamadas de funciones con
    parámetros.
-   Cada proceso posee un `callStack` independiente.
-   Los frames de llamada mantienen la memoria local de cada invocación.
-   Una misma función puede ser llamada por distintos procesos sin
    compartir variables temporales.
-   Las llamadas anidadas crean frames independientes.
-   El call stack y las variables temporales de las funciones se exponen
    en `SimulationSnapshot` y se visualizan en la interfaz.
-   Se implementó `return;` y `return expresión;`.
-   Un `return` dentro de estructuras anidadas realiza unwind hasta el
    frame de retorno de la función.
-   El valor retornado se preserva al completar la llamada.
-   Las funciones usadas como expresión deben retornar un valor.

### Problema arquitectónico: llamadas a funciones dentro de expresiones

El evaluador original (`evaluateExpression`) era síncrono. Esto era
correcto para `x + 1`, `a < b`, `!active` o `array[i]`, pero no para
`int result = double(5)`, `if (isReady())` o `x = foo() + bar()`.

Una función puede contener múltiples instrucciones y debe ejecutarse
durante varios steps. Ejecutarla completamente dentro de
`evaluateExpression()` la convertiría artificialmente en una operación
atómica y eliminaría posibles interleavings con otros procesos.

Por ese motivo se decidió no volver async el engine y no ejecutar
funciones de forma atómica dentro del evaluador.

### Runtime de expresiones suspendibles

-   Se agregó `FunctionCallExpression` al AST.
-   El parser reconoce llamadas a funciones como expresiones, incluyendo
    llamadas anidadas.
-   Cada proceso puede mantener una expresión y una instrucción
    pendientes.
-   Cuando una expresión necesita ejecutar una función, la instrucción
    actual se suspende, la función se ejecuta mediante el call stack
    normal y consume steps normales del simulador.
-   Al retornar, la llamada dentro del AST pendiente se reemplaza por un
    literal con el valor retornado.
-   Si quedan más llamadas, se ejecuta la siguiente; cuando ya no
    quedan, la expresión restante se evalúa normalmente y se completa la
    instrucción original.

Ejemplo conceptual:

``` text
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

Este diseño conserva el comportamiento paso a paso y evita introducir
atomicidad falsa.

### Orden de evaluación de llamadas

Para `add(double(5), double(10))` se procesa conceptualmente:

``` text
double(5)  -> 10
double(10) -> 20
add(10,20) -> 30
```

Cada llamada continúa siendo una ejecución normal y puede ser
intercalada por el scheduler.

### Contextos ya integrados con expresiones suspendibles

Actualmente el mecanismo se integró en:

-   declaraciones (`DECLARE`);
-   asignaciones (`ASSIGN`);
-   condiciones de `if`;
-   condiciones de `while`;
-   condición `until` de `repeat / until`;
-   condición de `for`.

### `foreach`: aclaración importante

`foreach` itera sobre un array, pero `instruction.collection` sigue
siendo una expresión general.

`foreach (x in values)` no necesita suspensión si `values` ya es un
array disponible. Sin embargo, si se permite
`foreach (x in getValues())`, la colección también deberá pasar por el
runtime suspendible.

El cuerpo del `foreach` ya puede contener instrucciones con funciones
suspendibles normalmente.

### Contextos de expresión todavía a revisar

Antes de cerrar la integración hay que revisar sistemáticamente todos
los lugares donde el engine llama a `evaluateExpression()`:

-   `RETURN`: `return foo();` y `return foo() + 1;`.
-   Argumentos de llamadas usadas como instrucción: `foo(bar())`.
-   Colección de `foreach`: `foreach (x in getValues())`.
-   Índices de arrays: `array[getIndex()]`.
-   Targets de asignación a arrays: `array[getIndex()] = value`.
-   Cualquier nuevo contexto que evalúe una `Expression`.

Regla arquitectónica:

> No llamar directamente a `evaluateExpression()` sobre una expresión
> que pueda contener `FUNCTION_CALL` sin antes pasar por el mecanismo
> suspendible.

### Robustez de Step y Run

Durante la implementación se detectó que una excepción podía dejar un
proceso en `RUNNING`. Luego `Run` podía entrar en un loop infinito: el
scheduler solo seleccionaba `READY`, no había progreso, `isFinished()`
seguía falso y el contador de steps no avanzaba.

Se modificó `SimulationEngine.step()` para devolver:

-   `true`: hubo progreso real;
-   `false`: no se pudo ejecutar un step.

Además:

-   si una instrucción falla, el proceso vuelve a `READY` antes de
    propagar el error;
-   el historial registra instrucciones completadas correctamente;
-   `Run` corta si `step()` devuelve `false`;
-   los errores de runtime se capturan y muestran en la UI.

Esta decisión será importante cuando existan procesos `BLOCKED`,
deadlocks y primitivas de sincronización.

### Estado de M4

M4 incluye actualmente:

-   `if / else`;
-   `while`;
-   `repeat / until`;
-   `for`;
-   `foreach`;
-   `break`;
-   `continue`;
-   funciones y parámetros;
-   variables locales por llamada;
-   call stack por proceso;
-   `return`;
-   llamadas a funciones dentro de expresiones con suspensión.

La semántica de `continue` es:

-   `while`: vuelve a evaluar la condición;
-   `repeat / until`: evalúa `until`;
-   `for`: ejecuta el incremento antes de volver a evaluar;
-   `foreach`: avanza al siguiente elemento.

### Casos probados manualmente

El núcleo suspendible fue probado con:

``` text
int result = double(5);
int result = double(5) + 3;
int result = double(double(5));
int result = double(5) + double(10);
add(double(5), double(10));
```

También se probaron funciones con `return`, incluyendo retornos desde
estructuras de control anidadas.

### Próximo objetivo recomendado

1.  Completar los contextos pendientes (`RETURN`, argumentos de `CALL`,
    colección de `foreach` e índices de arrays).
2.  Agregar tests automáticos específicos del runtime suspendible.
3.  Ejecutar `npm test`, `npm run lint` y `npm run build`.
4.  Cerrar M4 con un commit estable.
5.  Actualizar `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` y
    `docs/SYNTAX.md` si todavía describen la arquitectura previa.
6.  Recién después avanzar a primitivas específicamente concurrentes.

## 2026-08-27 --- M4 completado: runtime suspendible

### Pila de evaluaciones pendientes

Durante las pruebas de llamadas anidadas se detectó una limitación
importante del diseño inicial del runtime suspendible.

Un único estado pendiente por proceso no era suficiente para representar
casos como:

``` text
result = calculate(5);

function calculate(int value) {
  return double(value) + 1;
}
```

## 2026-08-28 --- M5 completado: atomicidad e interferencia

### Microoperaciones como unidad de ejecución concurrente

M5 introduce la primera semántica específicamente concurrente del
simulador.

Hasta M4, una instrucción del pseudocódigo podía ejecutarse
esencialmente como una única transición del engine. Esto no era
suficiente para representar interferencias reales sobre memoria
compartida.

Se consolidó la distinción entre:

-   instrucciones visibles del pseudocódigo;
-   microoperaciones internas del runtime.

Una instrucción como:

``` text
x = x + 1;
```

puede ejecutarse conceptualmente como:

``` text
SHARED_READ x
COMPUTE x + 1
SHARED_WRITE x
```

Cada microoperación constituye una unidad mínima de ejecución atómica.

Entre dos microoperaciones el scheduler puede seleccionar otro proceso,
permitiendo representar interleavings reales.

### Runtime de asignaciones compartidas

Se agregó un runtime específico para mantener el estado de una
asignación compartida parcialmente ejecutada.

Este runtime permite conservar:

-   la expresión pendiente;
-   los valores ya leídos;
-   el valor calculado;
-   el índice pendiente de un target de array;
-   la ubicación concreta de destino;
-   la fase actual de la operación.

Esto permite que una instrucción pueda comenzar en un step y finalizar
varios steps después sin perder su estado intermedio.

Las fases utilizadas actualmente para las asignaciones compartidas son
conceptualmente:

``` text
READ
COMPUTE
TARGET_READ
WRITE
```

`TARGET_READ` permite resolver explícitamente lecturas compartidas
utilizadas para determinar la ubicación de destino de una asignación a
un array.

### Captura de lecturas compartidas

Las lecturas de memoria compartida capturan el valor observado en el
momento del `SHARED_READ`.

Las microoperaciones posteriores utilizan ese valor capturado aunque
otro proceso modifique la memoria antes de que termine la instrucción.

Por ejemplo, dos procesos ejecutando:

``` text
x = x + 1;
```

pueden producir:

``` text
P1 SHARED_READ  x = 0
P2 SHARED_READ  x = 0
P1 COMPUTE      result = 1
P2 COMPUTE      result = 1
P1 SHARED_WRITE x = 1
P2 SHARED_WRITE x = 1
```

El resultado final válido es `x = 1`, reproduciendo un lost update real
sin introducir comportamiento especial para ese ejemplo.

### MemoryLocation

Se introdujo `MemoryLocation` para representar ubicaciones concretas de
memoria compartida.

Actualmente distingue:

``` text
VARIABLE
ARRAY_ELEMENT
```

Esto permite diferenciar correctamente accesos como:

``` text
x
values[0]
values[1]
```

Dos accesos a elementos diferentes del mismo array no son tratados
automáticamente como accesos a la misma ubicación.

### Arrays compartidos e índices

Los accesos a elementos de arrays compartidos fueron integrados al
modelo de microoperaciones.

También se resolvió el caso donde el índice utilizado como target
depende de memoria compartida.

Ejemplo:

``` text
shared int index = 0;
shared int[] values = [0, 0];

process P1 {
    values[index] = 10;
}

process P2 {
    index = 1;
}
```

La ubicación de destino se resuelve utilizando el valor del índice
capturado durante la ejecución de la asignación, en lugar de volver a
consultar el valor actual de `index` al momento del `WRITE`.

Una ejecución válida puede producir:

``` text
P1 COMPUTE       result = 10
P2 COMPUTE       result = 1
P1 SHARED_READ   index = 0
P2 SHARED_WRITE  index = 1
P1 SHARED_WRITE  values[0] = 10
```

Aunque `index` vale `1` cuando ocurre el último `WRITE`, P1 escribe
correctamente sobre `values[0]`, porque esa fue la ubicación determinada
a partir del valor observado anteriormente.

También se soportan expresiones de índice que requieren múltiples
lecturas compartidas.

Por ejemplo:

``` text
shared int i = 0;
shared int offset = 1;
shared int[] values = [0, 0, 0, 0];

process P1 {
    values[i + offset] = 50;
}
```

Las lecturas de `i` y `offset` se realizan como microoperaciones
independientes y sus valores quedan capturados para calcular
posteriormente la ubicación de destino.

### Historial de microoperaciones

`ExecutionState` mantiene un historial específico de microoperaciones
separado conceptualmente del historial de instrucciones fuente.

Cada `MicroOperationEvent` puede registrar:

-   step;
-   proceso;
-   tipo de microoperación;
-   descripción;
-   ubicación de memoria asociada;
-   profundidad atómica.

La UI permite observar el interleaving a este nivel de detalle.

Esto permite mantener dos perspectivas diferentes de una misma
ejecución:

-   una cercana al pseudocódigo escrito por el usuario;
-   otra detallada, orientada a comprender la concurrencia y la
    interferencia.

### Detección de conflictos de memoria

Se agregó análisis de accesos sobre memoria compartida.

Dos accesos son considerados conflictivos cuando:

-   pertenecen a procesos diferentes;
-   afectan la misma `MemoryLocation`;
-   al menos uno de ellos es una escritura.

Las combinaciones relevantes son:

``` text
READ  + WRITE
WRITE + READ
WRITE + WRITE
```

Dos lecturas sobre la misma ubicación no constituyen un conflicto.

Se agregó además un resumen de conflictos agrupado por ubicación de
memoria para facilitar su visualización.

### Conflicto de acceso vs data race

Se decidió no tratar automáticamente todo conflicto de memoria como una
data race confirmada.

Los conflictos detectados actualmente se clasifican como:

``` text
POTENTIAL_RACE
SYNCHRONIZED
```

`POTENTIAL_RACE` indica que existe una combinación de accesos
conflictivos que no está completamente protegida por el mecanismo de
atomicidad conocido actualmente por el engine.

`SYNCHRONIZED` indica que ambos accesos conflictivos ocurrieron dentro
de regiones protegidas por la atomicidad explícita soportada
actualmente.

Esta clasificación deja abierta la evolución futura hacia un análisis
más formal cuando existan semáforos, monitores, relaciones
happens-before y otros mecanismos de sincronización.

### Visualización de interferencias

La interfaz fue extendida para mostrar:

-   historial de microoperaciones;
-   lecturas compartidas;
-   escrituras compartidas;
-   ubicaciones concretas de memoria;
-   conflictos potenciales;
-   accesos sincronizados;
-   cantidad de potenciales races;
-   información resumida de conflictos.

Los accesos clasificados como `POTENTIAL_RACE` y `SYNCHRONIZED` se
distinguen visualmente.

### Sintaxis `atomic`

Se agregó soporte al lenguaje para regiones:

``` text
atomic {
    // instrucciones
}
```

El tokenizer reconoce `atomic` como keyword.

El parser genera una instrucción `ATOMIC` cuyo cuerpo contiene las
instrucciones de la región.

El engine mantiene `atomicDepth` por proceso para representar si se
encuentra dentro de una o más regiones atómicas.

### Semántica de atomicidad

Una región `atomic` no elimina las microoperaciones internas.

Por ejemplo:

``` text
atomic {
    x = x + 1;
}
```

continúa generando conceptualmente:

``` text
SHARED_READ x
COMPUTE
SHARED_WRITE x
```

La diferencia es que, una vez ingresado al bloque `atomic`, el scheduler
no puede seleccionar otro proceso hasta abandonar completamente la
región.

Esto permite conservar la visualización detallada de la ejecución sin
permitir interleavings con otros procesos dentro de la sección atómica.

### Atomicidad anidada

Se soportan regiones `atomic` anidadas mediante `atomicDepth`.

Conceptualmente:

``` text
atomic {
    atomic {
        x = x + 1;
    }
}
```

produce una evolución de profundidad equivalente a:

``` text
0 -> 1 -> 2 -> 1 -> 0
```

El proceso conserva la exclusividad mientras `atomicDepth > 0`.

### Atomicidad y control de flujo

Durante la implementación se detectó que `return`, `break` y `continue`
podían abandonar frames de ejecución sin pasar por la finalización
normal de una región atómica.

Esto podía dejar `atomicDepth > 0` permanentemente y mantener
incorrectamente al proceso como propietario de la ejecución.

Se centralizó la eliminación de execution frames para detectar los
frames `EXIT_ATOMIC` descartados durante un unwind y reducir
correctamente `atomicDepth`.

Se verificaron casos anidados como:

``` text
while
    if
        atomic
            if
                continue
```

``` text
while
    if
        atomic
            if
                if
                    break
```

y:

``` text
function
    while
        if
            atomic
                if
                    return expression
```

Esto permite abandonar correctamente una región atómica incluso cuando
el flujo de control no llega naturalmente al final de su bloque.

### Regiones atómicas vacías

Se agregó soporte explícito para:

``` text
atomic {
}
```

Una región vacía no deja `atomicDepth` activo ni crea un frame de
ejecución que pueda bloquear incorrectamente la simulación.

### Protección unilateral

Se estableció que utilizar `atomic` solamente en uno de dos procesos que
acceden a la misma ubicación no es suficiente para considerar el acceso
sincronizado.

Por ejemplo:

``` text
shared int x = 0;

process P1 {
    atomic {
        x = x + 1;
    }
}

process P2 {
    x = x + 1;
}
```

continúa pudiendo producir interferencia.

P2 puede realizar un `SHARED_READ` antes de que P1 ingrese en su región
atómica y conservar ese valor para una escritura posterior.

Por lo tanto, bajo el modelo actual:

``` text
P1 atomic + P2 normal -> POTENTIAL_RACE
P1 atomic + P2 atomic -> SYNCHRONIZED
```

Esto refleja que ambos participantes deben respetar el protocolo de
protección para garantizar exclusión mutua.

### Caso principal de M5

El programa:

``` text
shared int x = 0;

process P1 {
    x = x + 1;
}

process P2 {
    x = x + 1;
}
```

puede producir correctamente una ejecución con resultado final:

``` text
x = 1
```

debido a un lost update.

Al proteger ambas operaciones:

``` text
shared int x = 0;

process P1 {
    atomic {
        x = x + 1;
    }
}

process P2 {
    atomic {
        x = x + 1;
    }
}
```

el resultado final es:

``` text
x = 2
```

y los accesos conflictivos correspondientes pueden clasificarse como
sincronizados.

### Robustez y tests

Se agregaron tests para cubrir los distintos componentes incorporados
durante M5, incluyendo:

-   interleavings de microoperaciones;
-   lost updates;
-   lecturas y escrituras compartidas;
-   elementos de arrays compartidos;
-   ubicaciones concretas de memoria;
-   conflictos entre procesos;
-   clasificación de conflictos;
-   atomicidad;
-   ausencia de interleavings dentro de `atomic`;
-   regiones atómicas anidadas;
-   regiones atómicas vacías;
-   `break` dentro de regiones atómicas;
-   `continue` dentro de regiones atómicas;
-   `return` dentro de regiones atómicas;
-   liberación correcta de `atomicDepth`;
-   captura de índices compartidos utilizados como targets de arrays;
-   múltiples lecturas compartidas dentro de expresiones de índice.

Las pruebas existentes del lenguaje secuencial y del runtime suspendible
continúan funcionando.

### Estado de M5

M5 queda completado.

El simulador ya puede representar una diferencia fundamental entre
ejecución secuencial y concurrente: una instrucción aparentemente simple
puede estar compuesta por varias acciones atómicas intercalables y
producir resultados diferentes según el scheduling.

También dispone de su primer mecanismo explícito para impedir esos
interleavings mediante regiones `atomic`.

El objetivo pendiente de permitir elegir entre granularidad por
instrucción y granularidad por microoperación no bloquea el cierre
semántico de M5 y se traslada a trabajo futuro de
visualización/experiencia de ejecución.

### Continuación histórica

Después de M5 se avanzó a M6 (`await`). Ese milestone ya fue completado
y se documenta en la entrada siguiente.

------------------------------------------------------------------------

## 2026-08-28 --- M6 completado: `await`

### Semántica adoptada

Se implementó `await` siguiendo la semántica utilizada por la cátedra.
El lenguaje soporta `await (B);` y `await (B) { S }`.

Si `B` es falsa, el proceso queda `BLOCKED` y el program counter
permanece en `await`. Cuando la condición vuelve a ser verdadera puede
pasar a `READY`, pero la reactivación no reserva la condición ni ningún
recurso. Cuando el scheduler lo selecciona, la guarda se reevalúa; por
eso puede volver a bloquearse.

Si `B` es verdadera, la comprobación exitosa y el cuerpo `S` constituyen
una acción atómica condicional.

### Modelo de bloqueo y reactivación

-   Se incorporó `blockingReason`.
-   Un bloqueo por `await` conserva la guarda.
-   Los bloqueados se reevalúan antes de seleccionar con el scheduler.
-   Todos los procesos cuya guarda sea verdadera pueden quedar `READY`.
-   El scheduler decide cuál ejecuta.
-   No existe cola especial ni garantía FIFO/fair.
-   La espera se representa con `BLOCKED`, no con busy waiting.

### Atomicidad, guardas y control de flujo

El cuerpo habilitado reutiliza la infraestructura de atomicidad de M5.
No existe interleaving entre la comprobación exitosa y la entrada al
cuerpo, aunque sus microoperaciones siguen siendo visibles.

Se verificó el unwind correcto ante `return`, `break`, `continue` y
regiones `atomic` anidadas. Por ahora se rechaza `await` dentro de una
región `atomic`.

Las guardas usan memoria local y compartida, deben producir booleano y
no soportan todavía llamadas a funciones.

### Historial, visualización y casos académicos

-   Se registran intentos bloqueados y habilitados.
-   La UI muestra `BLOCKED` y la condición esperada.
-   Se distingue programa bloqueado de finalizado.
-   Se probaron espera simple, varios waiters, exclusión mutua mediante
    `await (!lock) { lock = true; }`, competencia después de
    reactivación, Tie-Breaker y Ticket.

**Estado:** M6 COMPLETADO.

------------------------------------------------------------------------

## 2026-08-28 --- M7 en progreso: semáforos

### Alcance y semántica

V1 implementa únicamente **semáforos generales/contadores**. No existe
un tipo especial de semáforo binario.

Un semáforo mantiene un entero no negativo y debe inicializarse
explícitamente:

``` text
P(s): < await (s > 0) s = s - 1; >
V(s): < s = s + 1; >
```

`P` puede bloquear; `V` nunca bloquea. No se asume FIFO ni fairness y la
espera se representa mediante `BLOCKED` y `blockingReason`.

### Modelo, AST y lenguaje

Se agregó `Semaphore` como recurso separado de la memoria compartida y
una colección de semáforos al `Program`.

El AST incorpora `SEMAPHORE_P` y `SEMAPHORE_V`; `BlockingReason` soporta
`SEMAPHORE_P`.

Sintaxis escalar actual:

``` text
sem mutex = 1;
sem available = 3;

process P1 {
    P(mutex);
    V(mutex);
}
```

El tokenizer/parser reconoce `sem`, `P` y `V`, exige un literal entero
no negativo, detecta duplicados y construye el `Program`. La existencia
del semáforo usado por `P` / `V` se resuelve en runtime. Arrays de
semáforos quedan diferidos.

### Runtime de `P` / `V`

Si `P(s)` encuentra `s > 0`, comprobación y decremento ocurren
atómicamente y el proceso avanza. Si encuentra `s == 0`, pasa a
`BLOCKED`, conserva el program counter en `P(s)` y registra
`SEMAPHORE_P`.

`V(s)` incrementa atómicamente y nunca bloquea. Los semáforos generales
no modelan ownership.

Los procesos bloqueados pueden pasar a `READY` cuando `s > 0`, pero esa
reactivación **no reserva ni decrementa** el semáforo. Si varios quedan
habilitados, el scheduler selecciona uno y `P` se reevalúa al
ejecutarse; quienes pierdan la competencia pueden volver a bloquearse.

`P` y `V` son operaciones atómicas por sí mismas y no utilizan
`atomicDepth`. La región entre `P` y `V` no fija el scheduler.

### M7.5 --- Historial y visualización

-   `SimulationSnapshot` expone nombre, valor y procesos bloqueados para
    cada semáforo.
-   Los waiters se derivan de `Process.blockingReason`; no se almacenan
    en el semáforo ni forman una cola interna.
-   La UI muestra valores actuales, procesos esperando y una aclaración
    explícita de que no existe orden FIFO.
-   Las tarjetas de proceso muestran `P(semaphore)` como motivo de
    bloqueo.
-   `ExecutionEvent` registra metadata estructurada para `P` bloqueado,
    `P` exitoso y `V`, incluyendo valor anterior y posterior.
-   El historial presenta transiciones como `0 → 0`, `1 → 0` y
    `0 → 1` sin inferir ownership.
-   Se incorporaron tests de snapshot, aislamiento y eventos.
-   Se verificó manualmente la competencia entre dos waiters después de
    un `V`: ambos pueden habilitarse, uno completa `P` y el otro puede
    volver a bloquearse.

### M7.6 --- Integración con análisis de interferencia

-   El análisis reconstruye secciones delimitadas por `P` / `V` desde
    `ExecutionEvent`, sin modificar `atomicDepth`, el scheduler ni el
    modelo del semáforo.
-   Un semáforo general inicializado en `1` se reconoce como candidato a
    mutex solo si la traza observada respeta transiciones `1 -> 0 -> 1`
    y el mismo proceso abre y cierra cada sección candidata.
-   Esta asociación es metadata de análisis; el runtime continúa sin
    ownership y permite cualquier valor no negativo.
-   Los accesos protegidos por el mismo candidato válido quedan
    `SYNCHRONIZED` con razón `SEMAPHORE_MUTEX`.
-   La protección unilateral queda `POTENTIAL_RACE`.
-   Los semáforos contadores, la señalización y los protocolos
    incompatibles que delimitan ambos accesos quedan `UNKNOWN`.
-   Cada conflicto incorpora una razón estructurada y la UI explica la
    clasificación.
-   La interfaz aclara que el resultado corresponde a la ejecución
    observada y no prueba todos los interleavings.
-   Se agregaron tests para mutex, protección unilateral, contador y
    `V` extra.
-   Se verificaron visualmente los tres resultados en Round Robin.

### Verificación

Al cierre de M7.6 se verificó correctamente:

``` text
npm test
npm run lint
npm run build
```

### Próxima fase

-   M7.7 --- casos académicos.

**Estado:** M7 EN PROGRESO; M7.1 a M7.6 completados.
