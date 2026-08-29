# Concurrent Visualizer --- Progreso

> Diario breve para poder retomar el proyecto después de una pausa o
> desde otro contexto.

## Estado actual

**Fase:** M9 --- Exploración de ejecuciones.

**Último milestone completado:** M8 --- Detector de errores y
diagnósticos.

**Estado M6:** completado. El lenguaje y el engine soportan acciones
atómicas condicionales mediante `await (B);` y `await (B) { S }`,
procesos `BLOCKED`, reactivación sin reserva, reevaluación de guardas,
historial/visualización de esperas y casos académicos representativos.

**Estado M7:** completado. Están verificadas la semántica de
semáforos generales/contadores, su modelo y AST, el tokenizer/parser,
el runtime base de `P` / `V`, su historial/visualización y la integración
con el análisis de interferencia, además de nueve casos académicos
reproducibles.

**Estado M8:** completado. Incluye deadlock y wait-for graph,
diagnósticos de memoria/exclusión mutua y análisis conservador de busy
waiting, riesgo de starvation y no terminación al alcanzar el límite de
pasos.

**Próximo objetivo:** comenzar M9.1 separando selección y transición:
enumerar procesos habilitados, ejecutar una elección explícita y clonar
estados intermedios independientes.

**Requerimiento futuro registrado:** incorporar en M11 un catálogo
educativo cargable desde la interfaz. Comenzará con los nueve casos de
semáforos de M7 y reutilizará una única fuente de pseudocódigo entre los
tests y el selector visual. Cargar un ejemplo podrá elegir su scheduler
recomendado, pero no ejecutará `Build` ni reemplazará trabajo del usuario
sin advertencia.

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
3.  Revisar `DECISIONS.md`.
4.  Consultar `ARCHITECTURE.md` para conocer la arquitectura
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
-   Se documentó en `SYNTAX.md`.
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
5.  Actualizar `ARCHITECTURE.md`, `DECISIONS.md` y `SYNTAX.md` si todavía
    describen la arquitectura previa.
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
-   Un traspaso directo sobre un semáforo inicializado en `0`, con
    alternancia observada `V: 0 -> 1` / `P: 1 -> 0`, puede ordenar un
    acceso anterior al `V` respecto de otro posterior al `P`. Se informa
    como `SYNCHRONIZED` con razón `SEMAPHORE_SIGNALING`.
-   La regla de señalización es deliberadamente acotada: no reconoce un
    `V` anterior al acceso productor, contadores mayores que uno ni
    protocolos que no alternen limpiamente entre `0` y `1`.
-   Los semáforos contadores y los protocolos incompatibles que delimitan
    ambos accesos quedan `UNKNOWN`.
-   Cada conflicto incorpora una razón estructurada y la UI explica la
    clasificación.
-   La interfaz aclara que el resultado corresponde a la ejecución
    observada y no prueba todos los interleavings.
-   Se agregaron tests para mutex, protección unilateral, contador y
    `V` extra.
-   Se verificaron visualmente los tres resultados en Round Robin.

### M7.7 --- Primer caso académico: exclusión mutua

Se adaptó el Ejercicio 1 de la explicación práctica de semáforos a una
ejecución finita compatible con el visualizador. Dos procesos representan
chicos que toman un caramelo, incrementan el contador compartido `cant`
bajo `P(mutex)` / `V(mutex)` y realizan el trabajo local de comer fuera de
la sección crítica.

El test académico verifica:

-   `cant == 2` al terminar;
-   valor final `mutex == 1`;
-   ambos procesos finalizados;
-   existencia de un intento de `P` bloqueado bajo Round Robin;
-   a lo sumo un proceso entre su `P` exitoso y su `V`;
-   liberación completa de la sección al finalizar;
-   clasificación de los conflictos compartidos como `SYNCHRONIZED` con
    razón `SEMAPHORE_MUTEX`.

La adaptación conserva la enseñanza de la práctica: solamente el acceso
al recurso compartido pertenece a la sección crítica; el trabajo local se
mantiene fuera para no reducir innecesariamente la concurrencia.

### M7.7 --- Segundo caso académico: señalización de eventos

Se incorporó una señal unidireccional con `sem inicio = 0`. El proceso
`Trabajador` intenta primero `P(inicio)` y queda bloqueado; el
`Coordinador` anuncia el evento mediante `V(inicio)` y el trabajador
consume posteriormente esa señal con un `P` exitoso.

El test verifica la secuencia estructurada:

``` text
Trabajador:  P(inicio)  0 -> 0  BLOCKED
Coordinador: V(inicio)  0 -> 1  SUCCEEDED
Trabajador:  P(inicio)  1 -> 0  SUCCEEDED
```

También comprueba que:

-   el trabajador conserva su program counter y motivo de bloqueo;
-   inmediatamente después de `V`, continúa `BLOCKED` hasta la próxima
    reevaluación del engine;
-   la reactivación no reserva el permiso: el `P` seleccionado vuelve a
    comprobar y decrementar el semáforo;
-   después del `P` exitoso, el trabajador ejecuta su trabajo local;
-   el semáforo termina nuevamente en `0`;
-   el caso no introduce accesos a memoria compartida ni conflictos de
    interferencia.

Durante el diseño se comprobó además que una operación ejecutada antes
de `P` puede dar tiempo al coordinador para señalizar primero. En ese
orden la señal queda almacenada como valor `1` y el `P` posterior no se
bloquea, comportamiento correcto para un semáforo general.

### M7.7 --- Tercer caso académico: varios waiters

Se agregaron dos trabajadores esperando sobre `sem inicio = 0` y un
coordinador que ejecuta dos operaciones `V(inicio)`, una por cada proceso
demorado.

Con Round Robin se verifica la secuencia:

``` text
Trabajador1: P  0 -> 0  BLOCKED
Trabajador2: P  0 -> 0  BLOCKED
Coordinador: V  0 -> 1  SUCCEEDED
Trabajador1: P  1 -> 0  SUCCEEDED
Trabajador2: P  0 -> 0  BLOCKED nuevamente
Coordinador: V  0 -> 1  SUCCEEDED
Trabajador2: P  1 -> 0  SUCCEEDED
```

El caso demuestra que:

-   un `V` crea un permiso, no uno por cada waiter;
-   todos los procesos cuya guarda `s > 0` sea verdadera pueden pasar a
    `READY` durante la reevaluación;
-   la reactivación no reserva el permiso;
-   quien pierde la competencia puede volver a bloquearse;
-   se necesita un `V` por cada proceso que deba continuar;
-   el orden observado proviene de Round Robin y no de una cola FIFO del
    semáforo;
-   `waitingProcessIds` representa procesos actualmente `BLOCKED`, no una
    cola ni una lista de permisos pendientes.

### M7.7 --- Cuarto caso académico: contador de recursos

Se incorporó `sem recursos = 2` para representar dos unidades libres de
un mismo recurso. Tres trabajadores intentan adquirir una unidad con
`P(recursos)`, realizan trabajo local y la devuelven con `V(recursos)`.

Con Round Robin se verifica la secuencia:

``` text
Trabajador1: P  2 -> 1  SUCCEEDED
Trabajador2: P  1 -> 0  SUCCEEDED
Trabajador3: P  0 -> 0  BLOCKED
Trabajador1: V  0 -> 1  SUCCEEDED
Trabajador2: V  1 -> 2  SUCCEEDED
Trabajador3: P  2 -> 1  SUCCEEDED
Trabajador3: V  1 -> 2  SUCCEEDED
```

El test comprueba que:

-   dos procesos pueden conservar simultáneamente una unidad adquirida;
-   nunca hay más de dos usuarios activos, que es la capacidad inicial;
-   el tercer proceso se bloquea cuando el contador llega a `0`;
-   una operación `V` devuelve una unidad y habilita una reevaluación;
-   las tres unidades adquiridas se devuelven y el valor final vuelve a
    `2`;
-   no se introduce memoria compartida: el caso aísla la semántica del
    contador de recursos.

Este uso no representa exclusión mutua. Un semáforo inicializado en `2`
permite dos usuarios concurrentes y, por lo tanto, no protege por sí solo
una sección crítica que requiera un único ejecutor.

### M7.7 --- Quinto caso académico: Productor/Consumidor unitario

Se adaptó el buffer limitado de la Clase 4 a una ejecución finita con un
único productor, un único consumidor y capacidad `1`:

-   `vacio = 1` cuenta el único lugar inicialmente libre;
-   `lleno = 0` indica que todavía no existe un dato para retirar;
-   el consumidor ejecuta primero `P(lleno)` y queda bloqueado;
-   el productor consume el lugar con `P(vacio)`, deposita `42` y anuncia
    el dato mediante `V(lleno)`;
-   el consumidor completa `P(lleno)`, copia el dato y devuelve el lugar
    con `V(vacio)`.

El resultado final conserva `buffer == 42`, obtiene `consumido == 42` y
restaura el estado vacío mediante `vacio == 1` y `lleno == 0`.

Este caso también extendió el análisis de interferencia con un traspaso
directo de señalización. La escritura del productor ocurre antes de
`V(lleno)` y la lectura del consumidor después del `P(lleno)` que consume
esa señal; el conflicto observado se explica como `SYNCHRONIZED` con
razón `SEMAPHORE_SIGNALING`. Un test negativo comprueba que hacer `V`
antes de escribir no establece ese orden.

La mejora no intenta resolver happens-before general: sólo reconoce
señalización inicializada en `0`, alternante entre `0` y `1` y con un
emparejamiento directo no ambiguo en la traza observada.

### M7.7 --- Sexto caso académico: buffer con recursos contados

Se amplió Productor/Consumidor a un buffer de capacidad `2`, representado
por `shared int[] buffer = [0, 0]`, con tres mensajes finitos para hacer
visible el bloqueo por falta de espacio.

El caso usa **First Ready** y coloca primero al productor. La ejecución
observada permite que deposite `10` y `20`, dejando:

``` text
vacio = 0
lleno = 2
buffer = [10, 20]
```

El tercer `P(vacio)` obtiene `0 -> 0 BLOCKED`. El consumidor retira el
primer mensaje y ejecuta `V(vacio)`, tras lo cual el productor reevalúa
su `P`, deposita `30` en la posición liberada y termina. El consumidor
retira luego los dos mensajes restantes.

El test comprueba:

-   existencia del bloqueo del productor con el buffer lleno;
-   valores de ambos semáforos siempre comprendidos entre `0` y `2`;
-   secuencia consumida `[10, 20, 30]`;
-   estado final `vacio == 2` y `lleno == 0`;
-   finalización de productor y consumidor;
-   accesos al buffer clasificados como sincronizados.

Los accesos de depositar y retirar se expresaron como bloques `atomic`
porque, para un productor y un consumidor, la cátedra permite asumir
atómicas esas operaciones. Los semáforos continúan cumpliendo otra
función: controlar cuántas posiciones están libres u ocupadas.

No se generalizó todavía a múltiples productores o consumidores. En ese
caso los índices compartidos y las operaciones de depósito/retiro pasan
a ser secciones críticas que requieren exclusión mutua adicional.

### M7.7 --- Séptimo caso académico: barrera de tres procesos

Se adaptó la barrera del Ejercicio 3 de la explicación práctica a tres
procesos finitos. Cada chico incrementa `contador` dentro de una sección
protegida por `mutex`. El último en observar `contador == 3` ejecuta tres
operaciones `V(barrera)`, una por cada proceso que debe atravesarla.

El protocolo mantiene el orden crítico:

``` text
P(mutex)
contador = contador + 1
si contador == 3: V(barrera) tres veces
V(mutex)
P(barrera)
trabajo posterior
```

El test verifica:

-   `contador == 3` al finalizar;
-   al menos dos procesos demorados simultáneamente en la barrera;
-   exactamente tres señales y tres esperas exitosas;
-   las tres señales emitidas por el proceso que llega último;
-   ningún proceso ejecuta trabajo posterior antes de que el contador
    llegue a `3`;
-   cada proceso libera `mutex` antes de intentar `P(barrera)`;
-   estado final `mutex == 1` y `barrera == 0`;
-   conflictos sobre `contador` sincronizados mediante el protocolo
    `SEMAPHORE_MUTEX`.

Es una barrera de un solo uso. No se supone orden FIFO: los tres permisos
son equivalentes y el scheduler decide qué proceso consume cada uno.

### M7.7 --- Octavo caso académico: Lectores/Escritores

Se implementó la solución de preferencia a lectores presentada en la
Clase 4. `mutexR` protege el contador `nr`; el primer lector toma `rw` y
el último lector lo libera. El escritor necesita adquirir `rw` para
modificar la base de datos.

La ejecución finita contiene dos lectores y un escritor. El escritor
realiza preparación local antes de solicitar la base para obtener una
traza Round Robin reproducible en la que:

-   `nr` alcanza `2`;
-   ambos lectores ejecutan trabajo de lectura concurrentemente;
-   el escritor queda bloqueado en `P(rw)`;
-   ambos lectores observan `baseDatos == 0`;
-   el último lector ejecuta `V(rw)`;
-   el escritor continúa con `nr == 0` y actualiza `baseDatos` a `42`.

El test también comprueba que solamente el primer lector ejecuta el
`P(rw)` exitoso de entrada al grupo y solamente el último ejecuta
`V(rw)`. El estado final restaura `nr == 0`, `rw == 1` y `mutexR == 1`.

Los accesos a `nr` se reconocen mediante `SEMAPHORE_MUTEX`. Las
operaciones finitas de lectura y escritura de la base se expresan como
regiones `atomic`, separando su indivisibilidad del protocolo de acceso
por clases controlado mediante `rw`.

Esta es la variante con preferencia a lectores y no es fair: una llegada
continua de nuevos lectores podría postergar indefinidamente a un
escritor. La simulación finita demuestra seguridad y concurrencia entre
lectores, no ausencia de starvation.

### M7.7 --- Noveno caso académico: Filósofos Comensales

Se adaptó la solución de exclusión mutua selectiva de la Clase 4 a cinco
procesos finitos y cinco semáforos generales inicializados en `1`. Como
el lenguaje todavía no soporta arrays de semáforos, `tenedor0` a
`tenedor4` representan fielmente las cinco posiciones del arreglo
académico.

Los filósofos `0` a `3` toman sus dos tenedores en orden ascendente. El
`Filosofo4` rompe la espera circular tomando primero `tenedor0` y luego
`tenedor4`. No se agrega un árbitro ni un tipo especial de semáforo: la
ausencia de deadlock surge únicamente del orden de adquisición.

La traza Round Robin reproducible demuestra que:

-   cada tenedor tiene como máximo un poseedor;
-   filósofos vecinos nunca comen simultáneamente;
-   `Filosofo0` y `Filosofo2`, que no comparten tenedores, sí comen a la
    vez;
-   aparecen esperas reales en operaciones `P`;
-   cada filósofo completa exactamente dos `P`, come cuatro bocados y
    ejecuta dos `V`;
-   los cinco procesos terminan y todos los tenedores vuelven a `1`.

Las variables locales `espera` y `bocados` extienden la duración visible
del escenario, pero no participan en el protocolo. No hay memoria
compartida ordinaria: toda la coordinación ocurre mediante los cinco
semáforos.

### Verificación

Al cierre de M7 se verificó correctamente:

``` text
npm test
npm run lint
npm run build
```

### Próxima fase

-   M8 --- detector de errores y diagnósticos.

**Estado:** M7 COMPLETADO; M7.1 a M7.7 y nueve casos académicos
reproducibles verificados.

------------------------------------------------------------------------

## 2026-08-29 --- M8: diagnóstico de deadlock

### Definición de progreso

El snapshot distingue cuatro estados globales:

-   `RUNNING`: no hay procesos bloqueados y queda trabajo ejecutable;
-   `TEMPORARILY_BLOCKED`: existe al menos un proceso bloqueado, pero
    otro proceso puede avanzar o una espera ya está habilitada;
-   `FINISHED`: todos los procesos finalizaron;
-   `DEADLOCK`: quedan procesos sin finalizar, ninguno está listo y
    ninguna espera bloqueada puede habilitarse con el estado actual.

Esta definición evita confundir un waiter con deadlock y también evita
un falso positivo inmediatamente después de un `V`: aunque el waiter
todavía figure `BLOCKED` hasta la próxima reevaluación, el permiso
disponible demuestra que puede progresar.

### Dependencias y wait-for graph

El analizador reconstruye permisos adquiridos a partir del historial
estructurado de `P` / `V`. Para un proceso bloqueado en `P(s)` crea:

``` text
proceso --WAITS_FOR--> semáforo --HOLDS--> proceso inferido
```

De esas dependencias deriva aristas proceso-a-proceso y busca
componentes fuertemente conexas. Una componente con más de un proceso,
o un proceso que depende de sí mismo, constituye espera circular.

Los poseedores son metadata inferida para la traza observada; no se
agrega ownership a la semántica de los semáforos. Si un `await` no puede
progresar o un semáforo no tiene poseedor inferible, se informa bloqueo
terminal con grafo parcial sin inventar un ciclo.

El modelo de recursos admite `SEMAPHORE`, `MONITOR` y `CHANNEL`. En esta
etapa solamente semáforos producen dependencias concretas; monitores y
comunicación podrán agregar adaptadores sin reemplazar el algoritmo de
ciclos.

### Visualización y reproducción

Cuando se alcanza un deadlock, la UI muestra:

-   paso de detección y tipo de diagnóstico;
-   procesos y recursos involucrados;
-   tabla del wait-for graph;
-   ciclos encontrados o la limitación del grafo parcial;
-   botón `Replay deadlock`.

La reproducción reinicia el mismo estado y scheduler y ejecuta hasta el
paso registrado. Round Robin, First Ready y Random con seed conservan
así la misma traza.

### Alcance

El detector diagnostica el estado alcanzado por la ejecución actual. No
busca todavía interleavings alternativos; esa exploración pertenece a
M9.

### M8 --- Race conditions y exclusión mutua

El análisis de memoria mantiene las clasificaciones públicas
`POTENTIAL_RACE`, `SYNCHRONIZED` y `UNKNOWN`, pero agrega un diagnóstico
estructurado independiente:

-   `POTENTIAL_DATA_RACE`;
-   `MUTUAL_EXCLUSION_VIOLATION`;
-   `AMBIGUOUS_SYNCHRONIZATION`;
-   `SYNCHRONIZED_ACCESS`.

Para cada acceso se describe si estaba dentro de `atomic`, dentro de un
protocolo mutex observado o dentro de un protocolo de semáforo ambiguo.
Esto permite diferenciar:

-   dos accesos completamente desprotegidos;
-   protección unilateral;
-   mecanismos incompatibles;
-   dos mutex distintos protegiendo la misma ubicación;
-   un mutex común válido;
-   señalización directa válida `V -> P`;
-   contadores y protocolos ambiguos.

Se informa `MUTUAL_EXCLUSION_VIOLATION` únicamente cuando la traza
muestra que un proceso accedió a la ubicación mientras otro todavía
mantenía un mutex incompatible. Una protección inconsistente sin
solapamiento demostrado continúa como `POTENTIAL_DATA_RACE`.

Los resúmenes por ubicación cuentan por separado observaciones
potenciales, violaciones de mutex, accesos sincronizados y casos
ambiguos. La UI explica el motivo estructurado y aclara que el análisis
corresponde a la traza observada.

Se evaluó incorporar happens-before formal. El número global de paso no
puede utilizarse como relación causal: convertiría el interleaving total
del simulador en un orden entre todos los procesos y ocultaría races.
Un detector formal futuro requerirá orden de programa, relaciones
específicas por primitiva y posiblemente relojes vectoriales. Debe
integrar semáforos generales, `await`, monitores y comunicación, y
permanecer separado de la exploración de interleavings de M9.

Por ese motivo, M8 conserva deliberadamente el nombre
`POTENTIAL_RACE`: es evidencia educativa de accesos conflictivos sin una
protección común reconocida, no prueba formal de una data race.

### M8 --- Otros diagnósticos y cierre

Se agregó un analizador de liveness separado del runtime. Cada
diagnóstico contiene un código estable, severidad, procesos afectados,
evidencia concreta de la traza y una nota que explica qué no puede
concluirse.

El busy waiting se detecta sólo ante un patrón conservador: al menos
cuatro evaluaciones consecutivas mantienen activo un bucle vacío cuya
condición consulta memoria compartida. Los bucles con cuerpo o
condiciones suspendibles quedan sin clasificar para evitar falsos
positivos.

El riesgo de starvation se informa cuando un proceso está `READY` pero
no fue seleccionado durante doce pasos o más, mientras otros procesos
sí acumulan ejecución. El diagnóstico habla de postergación observada,
no afirma starvation inevitable.

El límite máximo de pasos ahora produce el estado global
`STEP_LIMIT_REACHED` cuando todavía hay trabajo ejecutable. De esta
forma una ejecución potencialmente infinita queda separada de
`DEADLOCK`; el panel explica que una traza finita no distingue por sí
sola un servidor intencionalmente infinito de un error de terminación.

La UI muestra las observaciones en tarjetas educativas con evidencia y
alcance. El engine conserva el límite predeterminado de 10.000 pasos y
deshabilita `Step`/`Run` al alcanzarlo.

Se agregaron pruebas para busy waiting positivo, rechazo de un bucle que
no consulta memoria compartida, postergación por `First Ready` y la
separación formal entre límite y deadlock.

**Estado:** M8 COMPLETADO.

------------------------------------------------------------------------

## 2026-08-29 --- Auditoría y redefinición de M9

Se auditó el backlog de exploración contra el motor implementado. El
estado actual permite resetear y repetir una traza elegida por un
scheduler, pero no enumerar elecciones habilitadas, forzar un proceso ni
bifurcar una ejecución intermedia.

La clonación estructural usada por `reset()` constituye una base, no una
implementación completa de exploración: el scheduler conserva estado
privado y el historial creciente no sirve como identidad canónica.

M9 se reorganizó en cuatro fases:

1.  modelo de transiciones y estados clonables;
2.  exploración BFS acotada y detección de estados repetidos;
3.  búsqueda de deadlock y contraejemplos reproducibles;
4.  propiedades adicionales después de resolver el estado de análisis.

La primera propiedad será deadlock. Los resultados distinguirán
`FOUND`, `EXHAUSTED` y `TRUNCATED`; una búsqueda truncada nunca se
presentará como prueba de corrección.

Quedaron fuera del alcance inicial el grafo completo del espacio de
estados, partial-order reduction, happens-before formal, verificación
exhaustiva y pruebas de starvation o terminación.

También se corrigió deriva documental posterior a M7/M8: referencias a
semáforos todavía en desarrollo, la fase marcada como actual y enlaces
que apuntaban a un directorio `docs/` inexistente.
