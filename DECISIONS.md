# Concurrent Visualizer --- Registro de decisiones

> Este archivo registra decisiones que sería costoso olvidar. No es un
> diario de cambios.

------------------------------------------------------------------------

## ADR-001 --- Aplicación web

**Estado:** Aceptada

**Decisión:** desarrollar Concurrent Visualizer como aplicación web.

**Stack inicial:** React + TypeScript + Vite.

**Motivo:** el proyecto requiere una interfaz altamente interactiva,
visualizaciones, animaciones y ejecución paso a paso. Una aplicación web
facilita además su publicación y uso por otros alumnos.

------------------------------------------------------------------------

## ADR-002 --- TypeScript para el motor

**Estado:** Aceptada

**Decisión:** implementar el motor de simulación en TypeScript puro.

**Motivo:** el dominio tendrá múltiples tipos de instrucciones, estados,
recursos y eventos. El sistema de tipos ayudará a mantener el motor
modular y seguro a medida que crezca.

------------------------------------------------------------------------

## ADR-003 --- Motor independiente de React

**Estado:** Aceptada

**Decisión:** React no contendrá la semántica de la simulación.

**Motivo:** separar dominio y presentación permitirá testear el motor,
explorar ejecuciones sin UI y evitar acoplamiento entre la lógica
concurrente y los componentes visuales.

------------------------------------------------------------------------

## ADR-004 --- Un único framework de simulación

**Estado:** Aceptada

**Decisión:** memoria compartida y pasaje de mensajes utilizarán un
motor común en lugar de dos simuladores independientes.

**Motivo:** ambos paradigmas comparten procesos, estados, scheduling,
historial, bloqueo, deadlock y visualización temporal. Los mecanismos de
interacción serán subsistemas diferentes.

La interfaz podrá ofrecer:

-   modo Memoria Compartida;
-   modo Pasaje de Mensajes;
-   modo Híbrido/Avanzado.

------------------------------------------------------------------------

## ADR-005 --- Restricciones educativas por paradigma

**Estado:** Aceptada

**Decisión:** aunque el motor pueda ser extensible a programas híbridos,
los modos educativos podrán impedir mecanismos que no correspondan al
paradigma seleccionado.

**Ejemplo:** un ejercicio de pasaje de mensajes podrá impedir el acceso
a variables compartidas.

**Motivo:** evitar soluciones que funcionen técnicamente en el motor
pero violen el modelo que la materia intenta enseñar.

------------------------------------------------------------------------

## ADR-006 --- Tiempo simulado

**Estado:** Aceptada

**Decisión:** operaciones como `sleep` no dependerán de timers reales
del navegador.

**Motivo:** las ejecuciones deben ser reproducibles y no depender del
rendimiento de la VM, navegador o computadora.

Se utilizarán ticks/unidades de tiempo simuladas.

------------------------------------------------------------------------

## ADR-007 --- Parser posterior al motor

**Estado:** Aceptada

**Decisión:** no comenzar desarrollando el parser.

**Motivo:** primero era necesario comprender y estabilizar la semántica
de procesos, instrucciones y scheduling. Inicialmente los programas se
representaron mediante objetos TypeScript.

El parser ya fue incorporado posteriormente y actualmente forma parte
del flujo normal de ejecución:

``` text
Texto → Tokens → Parser → AST/Program → Simulation Engine
```

Esta ADR se conserva porque explica el orden en que se construyó el
proyecto y por qué el parser no condicionó el diseño inicial del motor.

------------------------------------------------------------------------

## ADR-008 --- Lenguaje secuencial suficientemente expresivo

**Estado:** Aceptada

**Decisión:** el lenguaje deberá soportar estructuras secuenciales
convencionales además de primitivas concurrentes.

Incluye actualmente:

-   `if / else`;
-   `while`;
-   `repeat / until`;
-   `for`;
-   `foreach`;
-   `break`;
-   `continue`;
-   funciones;
-   parámetros;
-   variables locales de función;
-   llamadas a funciones;
-   llamadas a funciones dentro de expresiones;
-   `return`;
-   funciones vacías.

Previstas posteriormente:

-   `sleep`;
-   `yield`.

**Motivo:** los procesos concurrentes contienen programas secuenciales y
los ejercicios deben poder expresarse naturalmente.

------------------------------------------------------------------------

## ADR-009 --- Problemas clásicos como programas

**Estado:** Aceptada

**Decisión:** evitar implementar Productor/Consumidor, Filósofos,
Lectores/Escritores, etc. como animaciones especiales.

**Motivo:** el valor del simulador está en que los comportamientos
correctos e incorrectos emerjan de un motor general.

------------------------------------------------------------------------

## ADR-010 --- Errores como feature central

**Estado:** Aceptada

**Decisión:** el simulador no se limitará a mostrar una ejecución. Debe
evolucionar hacia análisis de errores y exploración de interleavings.

Problemas objetivo:

-   deadlock;
-   race conditions;
-   exclusión mutua;
-   busy waiting;
-   starvation cuando sea viable;
-   errores de comunicación.

**Motivo:** ejecutar una vez un programa concurrente sin errores no
demuestra su corrección.

------------------------------------------------------------------------

## ADR-011 --- Reproducibilidad

**Estado:** Aceptada

**Decisión:** las ejecuciones aleatorias deberán poder reproducirse.

**Mecanismo actual:** scheduler pseudoaleatorio con seed e historial de
ejecución.

**Motivo:** un error encontrado debe poder estudiarse y mostrarse
nuevamente.

------------------------------------------------------------------------

## ADR-012 --- Material de la cátedra como referencia semántica

**Estado:** Aceptada

**Decisión:** para primitivas y conceptos de concurrencia se priorizará
la terminología y semántica del material oficial de la cursada actual.

El material histórico de la UNLP se utilizará para anticipar temas y
planificar extensibilidad, pero no para asumir sin verificación que la
semántica de años anteriores es idéntica a la utilizada actualmente.

------------------------------------------------------------------------

## ADR-013 --- Microoperaciones como unidad atómica de ejecución

**Estado:** Aceptada

**Contexto:** una instrucción del pseudocódigo puede contener múltiples
acciones relevantes para la concurrencia. Por ejemplo:

``` text
x = x + 1;
```

puede implicar leer `x`, calcular el nuevo valor y escribir nuevamente
sobre `x`.

Si toda la instrucción se ejecutara como una única transición
indivisible, el scheduler no podría producir interleavings entre esas
acciones y ciertos problemas de concurrencia, como el lost update, no
podrían emerger de la simulación.

**Decisión:** distinguir entre instrucciones visibles del pseudocódigo y
microoperaciones internas del runtime.

Una instrucción del pseudocódigo puede producir una o más
microoperaciones.

Una microoperación constituye la unidad mínima de ejecución atómica del
simulador.

Por defecto, `SimulationEngine.step()` ejecuta una microoperación del
proceso seleccionado cuando la instrucción actual requiere
descomposición concurrente. Al finalizarla, el scheduler puede
seleccionar otro proceso para el siguiente step, salvo que exista una
región atómica activa.

Los accesos relevantes a memoria compartida deben poder representarse
explícitamente. Una operación como:

``` text
x = x + 1;
```

puede conceptualmente descomponerse como:

``` text
SHARED_READ x
COMPUTE + 1
SHARED_WRITE x
```

Una lectura captura el valor observado en ese instante. El cálculo
posterior utiliza ese valor capturado aunque otro proceso modifique la
variable compartida antes de la escritura.

La misma regla se aplica cuando una lectura compartida participa en la
resolución de un target. Por ejemplo:

``` text
values[i + offset] = 50;
```

puede requerir lecturas independientes de `i` y `offset`. Los valores
observados se capturan y la ubicación concreta de destino queda resuelta
a partir de esos valores, sin consultar nuevamente la memoria durante el
`WRITE`.

Las operaciones exclusivamente locales no necesitan inicialmente el
mismo nivel de descomposición, ya que no producen interferencia entre
procesos. Esta granularidad podrá ampliarse posteriormente con fines
educativos.

Las secciones `atomic` pueden contener múltiples microoperaciones. Las
microoperaciones siguen existiendo y registrándose, pero el scheduler no
puede seleccionar otro proceso mientras la región atómica permanezca
activa.

El historial de instrucciones fuente y el historial de microoperaciones
se mantienen conceptualmente separados para conservar tanto una vista
cercana al pseudocódigo como una vista detallada de la ejecución
concurrente.

**Consecuencia:** el estado de cada proceso debe poder conservar una
instrucción parcialmente ejecutada y los valores temporales necesarios
para reanudarla en steps posteriores.

**Motivo:** permitir que race conditions e interleavings problemáticos
emerjan de la ejecución real del programa sin introducir comportamientos
especiales codificados específicamente para cada ejemplo.

------------------------------------------------------------------------

## ADR-014 --- Ubicaciones concretas de memoria compartida

**Estado:** Aceptada

**Contexto:** para analizar interferencias no alcanza con conocer el
nombre general de una variable o estructura. Dos accesos a elementos
diferentes de un mismo array no afectan necesariamente la misma
ubicación.

Por ejemplo:

``` text
values[0]
values[1]
```

deben poder tratarse como ubicaciones distintas.

**Decisión:** representar los accesos relevantes a memoria compartida
mediante la abstracción `MemoryLocation`.

Actualmente se distinguen:

``` text
VARIABLE(name)
ARRAY_ELEMENT(arrayName, index)
```

Los eventos de microoperación pueden asociarse a una `MemoryLocation`
concreta.

Dos ubicaciones se consideran iguales solamente cuando representan la
misma variable o el mismo elemento exacto de un array.

Esta abstracción se utiliza como base para:

-   historial de accesos compartidos;
-   visualización de lecturas y escrituras;
-   detección de accesos conflictivos;
-   agrupación y resumen de conflictos;
-   futuras extensiones del análisis concurrente.

**Consecuencia:** un acceso a `values[0]` no entra automáticamente en
conflicto con un acceso a `values[1]`.

**Motivo:** el análisis debe reflejar la ubicación real afectada y no
generar conflictos falsos por tratar un array completo como una única
celda de memoria.

------------------------------------------------------------------------

## ADR-015 --- `atomic` como región no intercalable

**Estado:** Aceptada

**Contexto:** una sección atómica debe impedir que otros procesos
interfieran durante su ejecución, pero convertir todo su cuerpo en una
única operación interna eliminaría la visibilidad educativa de las
microoperaciones que la componen.

Además, las regiones atómicas pueden aparecer anidadas y pueden ser
abandonadas mediante mecanismos de control como `return`, `break` o
`continue`.

**Decisión:** `atomic { ... }` representa una región de ejecución no
intercalable, no una única microoperación.

Ejemplo:

``` text
atomic {
    x = x + 1;
}
```

continúa pudiendo generar:

``` text
SHARED_READ x
COMPUTE
SHARED_WRITE x
```

pero ningún otro proceso puede ser seleccionado entre esas
microoperaciones mientras la región permanezca activa.

Cada proceso mantiene un contador `atomicDepth`.

Conceptualmente:

``` text
fuera de atomic       -> atomicDepth = 0
primer atomic         -> atomicDepth = 1
atomic anidado        -> atomicDepth = 2
salida del anidado    -> atomicDepth = 1
salida del exterior   -> atomicDepth = 0
```

Mientras exista un proceso `READY` con `atomicDepth > 0`, el scheduler
mantiene seleccionado ese proceso antes de consultar su política normal
de scheduling.

Las regiones atómicas vacías no deben dejar profundidad atómica activa.

Cuando `return`, `break` o `continue` descartan frames de ejecución que
incluyen una frontera `EXIT_ATOMIC`, la profundidad debe reducirse
correctamente. Abandonar una región mediante control de flujo no puede
dejar al proceso permanentemente dentro de una sección atómica.

La protección es cooperativa: que solamente uno de dos procesos utilice
`atomic` no garantiza exclusión mutua frente al proceso que accede a la
misma memoria sin respetar esa protección.

Por lo tanto, bajo el modelo actual:

``` text
P1 atomic + P2 normal -> POTENTIAL_RACE
P1 atomic + P2 atomic -> SYNCHRONIZED
```

La clasificación `SYNCHRONIZED` describe conflictos cuyos dos accesos
fueron realizados dentro del mecanismo de atomicidad explícita conocido
actualmente por el engine.

`POTENTIAL_RACE` se utiliza cuando esa protección no está presente en
ambos accesos.

Esta clasificación no pretende todavía implementar una definición formal
completa de data race basada en happens-before. El análisis podrá
refinarse cuando existan semáforos, monitores y otros mecanismos de
sincronización.

**Consecuencia:** la UI puede seguir mostrando las microoperaciones
individuales de una región atómica y, al mismo tiempo, indicar que sus
accesos se encuentran sincronizados.

**Motivo:** preservar tanto la semántica correcta de exclusión como el
valor educativo de observar qué acciones internas componen una operación
aparentemente indivisible.

------------------------------------------------------------------------

------------------------------------------------------------------------

## ADR-016 --- `await` como acción atómica condicional con bloqueo real

**Estado:** Aceptada

**Contexto:** la primitiva `await` debe representar la semántica de la
cátedra sin convertir la espera en busy waiting ni introducir una cola
de espera con una política de scheduling propia.

**Decisión:** soportar:

``` text
await (B);
```

y:

``` text
await (B) {
    S
}
```

Si `B` es falsa, el proceso pasa a `BLOCKED`, conserva el program
counter sobre el `await` y almacena la condición en `blockingReason`.

Los procesos bloqueados pueden ser reevaluados antes de una nueva
selección del scheduler. Si la guarda pasa a ser verdadera, el proceso
queda `READY`, pero esa reactivación no reserva la condición ni
garantiza que vaya a ejecutarse a continuación.

Cuando el scheduler selecciona nuevamente al proceso, la guarda se
evalúa otra vez. Por ello un proceso reactivado puede volver a
bloquearse si el estado cambió antes de que lograra ejecutar.

Si `B` es verdadera, la comprobación y el cuerpo `S` constituyen una
acción atómica condicional. El cuerpo reutiliza la infraestructura de
`atomicDepth` para impedir interleavings sin ocultar sus
microoperaciones.

**Restricciones actuales:**

-   la guarda debe producir un booleano;
-   no se permiten llamadas a funciones dentro de la guarda;
-   se rechaza `await` dentro de una región `atomic`;
-   pueden existir regiones `atomic` dentro del cuerpo de un `await`
    habilitado.

**Consecuencia:** `READY` significa solamente que el proceso puede
competir por CPU; no que la guarda siga necesariamente habilitada cuando
finalmente sea seleccionado.

**Motivo:** conservar la separación entre habilitación y scheduling y
representar fielmente una acción atómica condicional sin busy waiting.

------------------------------------------------------------------------

## ADR-017 --- Bloqueos representados en el proceso mediante `BlockingReason`

**Estado:** Aceptada

**Contexto:** distintas primitivas concurrentes pueden impedir
temporalmente el progreso de un proceso. La información necesaria para
reactivarlo y explicarlo en la UI no debe quedar dispersa en mecanismos
especiales para cada primitiva.

**Decisión:** mantener el estado general `BLOCKED` y asociar al proceso
un `blockingReason` discriminado.

Actualmente se utilizan conceptualmente:

``` text
AWAIT(condition)
SEMAPHORE_P(semaphoreName)
```

El motivo de bloqueo conserva únicamente la información necesaria para
reevaluar o explicar la espera.

**Consecuencia:** el engine puede centralizar la reevaluación de
procesos bloqueados y la UI puede mostrar por qué espera cada proceso
sin inferirlo desde el program counter.

**Motivo:** ofrecer un modelo extensible para futuras primitivas
bloqueantes sin crear estados de proceso específicos como
`WAITING_AWAIT`, `WAITING_SEMAPHORE`, etc.

------------------------------------------------------------------------

## ADR-018 --- Semáforos como recursos de sincronización separados de memoria compartida

**Estado:** Aceptada

**Contexto:** aunque un semáforo general mantiene internamente un
entero, su valor no representa una variable compartida ordinaria.
Permitir que el programa lo manipule mediante asignaciones comunes
rompería la semántica de `P` y `V`.

**Decisión:** representar explícitamente `Semaphore` y mantener la
colección de semáforos separada de la memoria compartida ordinaria
dentro de `Program`.

Un semáforo se modifica únicamente mediante sus operaciones de
sincronización.

Los accesos `P` / `V` no se modelan como `SHARED_READ` / `SHARED_WRITE`
ordinarios ni como `MemoryLocation`.

**Consecuencia:** la visualización y el análisis pueden distinguir
memoria de datos y recursos de sincronización.

**Motivo:** evitar que un detalle de implementación del TAD semáforo se
confunda con una variable compartida del programa.

------------------------------------------------------------------------

## ADR-019 --- V1 utiliza únicamente semáforos generales/contadores

**Estado:** Aceptada

**Contexto:** el material académico utiliza semáforos cuyo estado es un
entero no negativo y cuya semántica general puede representar tanto
conteo de recursos como protocolos de exclusión mutua.

**Decisión:** implementar en V1 únicamente semáforos
generales/contadores.

No se crea un tipo especial `BinarySemaphore`.

Un semáforo general inicializado en:

``` text
sem mutex = 1;
```

puede utilizarse para exclusión mutua si los procesos respetan
correctamente el protocolo `P(mutex)` / `V(mutex)`.

La inicialización es obligatoria y el valor inicial debe ser un entero
no negativo.

**Consecuencia:** el modelo no incorpora `kind`, reglas especiales de
saturación a `1` ni comportamientos diferentes para un supuesto subtipo
binario.

**Motivo:** mantener el modelo mínimo y alineado con la semántica
general necesaria para los ejercicios, evitando tipos redundantes.

------------------------------------------------------------------------

## ADR-020 --- Semáforos sin cola FIFO, fairness, ownership ni reserva de permisos

**Estado:** Aceptada

**Contexto:** una implementación concreta de semáforos podría utilizar
colas FIFO o imponer alguna política de fairness, pero esa
implementación no forma parte de la semántica general que el simulador
debe asumir.

Además, un semáforo general no implica ownership: un proceso puede
señalizar un evento mediante `V` sin haber ejecutado previamente el `P`
correspondiente.

**Decisión:** el modelo base de semáforos no mantiene:

-   cola FIFO de waiters;
-   garantía de fairness débil o fuerte;
-   owner;
-   permiso reservado durante la reactivación.

Los procesos esperando `P(s)` se representan mediante `BLOCKED` y
`blockingReason`.

Cuando `s > 0`, uno o varios waiters pueden pasar a `READY`. Esto no
decrementa el semáforo.

El scheduler selecciona posteriormente un proceso y ese proceso vuelve a
ejecutar `P(s)`. Solamente en ese momento, si `s > 0`, se consume una
unidad.

Por lo tanto:

``` text
reactivación
    ≠
reserva del recurso
```

y:

``` text
READY
    ≠
P garantizado
```

**Consecuencia:** si varios procesos son reactivados por una única
unidad disponible, el ganador consume el recurso y los demás pueden
volver a `BLOCKED`.

La UI puede mostrar qué procesos esperan un semáforo, pero no debe
presentar esa colección como una cola FIFO.

**Motivo:** no introducir garantías que pertenecen a una implementación
particular del semáforo ni mezclar la política del recurso con la del
scheduler.

------------------------------------------------------------------------

## ADR-021 --- `P` y `V` son operaciones atómicas, pero no regiones `atomic`

**Estado:** Aceptada

**Contexto:** la operación:

``` text
P(s)
```

debe comprobar disponibilidad y decrementar el semáforo de manera
indivisible. Del mismo modo, `V(s)` debe incrementar atómicamente.

Sin embargo, una sección crítica delimitada por:

``` text
P(mutex);
...
V(mutex);
```

no significa que el proceso deba monopolizar el scheduler durante toda
la región.

**Decisión:** `P` y `V` se ejecutan como operaciones atómicas
individuales sin utilizar `atomicDepth`.

`P(s)`:

``` text
si s > 0:
    s = s - 1
    avanzar
si s == 0:
    BLOCKED
    no avanzar
```

`V(s)`:

``` text
s = s + 1
avanzar
```

No se incrementa `atomicDepth` al ejecutar `P` ni se mantiene hasta `V`.

**Consecuencia:** otros procesos pueden seguir ejecutándose mientras uno
se encuentra dentro de una sección crítica protegida por semáforo. La
exclusión surge de que los demás procesos que respetan el mismo
protocolo no pueden completar `P`, no de que el scheduler quede fijado.

**Motivo:** reutilizar `atomicDepth` entre `P` y `V` alteraría
incorrectamente la semántica de scheduling y convertiría exclusión mutua
en ausencia total de interleaving.

------------------------------------------------------------------------

## ADR-022 --- Separar semántica de sincronización y análisis de interferencia

**Estado:** Aceptada

**Contexto:** M5 introdujo una primera clasificación de accesos
conflictivos basada en la información disponible en
`MicroOperationEvent`, especialmente `atomicDepth`.

Con semáforos ya es posible que dos accesos estén correctamente
protegidos por un protocolo `P` / `V` aunque las microoperaciones de la
sección crítica tengan `atomicDepth == 0`.

Modificar `atomicDepth` para hacer que el detector reconozca esa
protección cambiaría la ejecución real del programa.

**Decisión:** la semántica del engine y la información utilizada por el
análisis de interferencia deben permanecer separadas.

La integración de semáforos con `POTENTIAL_RACE` / `SYNCHRONIZED` deberá
incorporar una representación específica del contexto de sincronización
sin utilizar `atomicDepth` como sustituto.

Hasta diseñar esa integración, la clasificación existente continúa
siendo una aproximación educativa y no un detector formal de data races
basado en happens-before.

**Consecuencia:** una ejecución correcta mediante semáforos puede
requerir una fase posterior de análisis para ser clasificada
correctamente, pero no se modificará la semántica del scheduler con el
único objetivo de satisfacer al detector.

**Motivo:** evitar que una necesidad de visualización/análisis contamine
la semántica de ejecución del simulador.

------------------------------------------------------------------------

## ADR-023 --- El parser construye semáforos, pero las referencias `P` / `V` se resuelven en runtime

**Estado:** Aceptada

**Contexto:** el parser ya valida la forma de una declaración:

``` text
sem mutex = 1;
```

y genera instrucciones:

``` text
P(mutex);
V(mutex);
```

No existe todavía una fase general independiente de resolución de
símbolos para todos los recursos del lenguaje.

**Decisión:** el parser:

-   valida declaraciones de semáforos;
-   exige inicialización con literal entero no negativo;
-   detecta declaraciones duplicadas;
-   construye las instrucciones `SEMAPHORE_P` y `SEMAPHORE_V`.

La existencia del semáforo referenciado por `P` / `V` se comprueba
actualmente durante la ejecución.

Una referencia inexistente produce un error de runtime explícito.

**Consecuencia:** no se introduce todavía una fase semántica/symbol
resolver solamente para semáforos. Si el lenguaje acumula suficientes
recursos globales, esta decisión podrá revisarse y generalizarse.

**Motivo:** mantener el parser enfocado en sintaxis y evitar una nueva
capa arquitectónica prematura antes de que exista una necesidad
transversal.

------------------------------------------------------------------------

## ADR-024 --- Los waiters de semáforos se derivan para visualización

**Estado:** Aceptada

**Contexto:** M7.5 necesita mostrar el valor de cada semáforo y los
procesos que esperan completar `P`. El modelo de semáforo no contiene
cola, ownership, fairness ni permisos reservados.

Agregar una colección mutable de waiters al recurso duplicaría el estado
ya representado por los procesos y podría sugerir una política FIFO que
la semántica no garantiza.

**Decisión:** `SimulationSnapshot` expone cada semáforo con su nombre,
valor y `waitingProcessIds`. Esta colección se calcula a partir de los
procesos cuyo estado es `BLOCKED` y cuyo `blockingReason` es
`SEMAPHORE_P` para ese semáforo.

La colección es exclusivamente informativa. Su orden de presentación no
otorga prioridad ni modifica la selección del scheduler.

Los eventos de `P` / `V` registran además operación, resultado y valores
anterior/posterior como metadata estructurada independiente de la
descripción textual.

**Consecuencia:** la UI puede explicar esperas y transiciones sin
introducir estado duplicado ni semántica de cola. Un proceso reactivado
deja de figurar como bloqueado y deberá reevaluar `P` cuando sea
seleccionado, tal como exige el runtime.

**Motivo:** conservar una única fuente de verdad para el bloqueo y
mantener separadas visualización, scheduling y semántica del recurso.

------------------------------------------------------------------------

## ADR-025 --- Reconocer protocolos mutex observados sin crear semáforos binarios

**Estado:** Aceptada

**Contexto:** M5 clasifica accesos conflictivos dentro de regiones
`atomic`, pero una sección protegida correctamente por:

``` text
P(mutex);
...
V(mutex);
```

mantiene `atomicDepth == 0`. Al mismo tiempo, un semáforo general puede
usarse como contador o para señalización; compartir el mismo nombre de
semáforo no demuestra exclusión mutua.

**Decisión:** el analizador reconstruye secciones `P` / `V` desde el
historial estructurado sin modificar el estado ni el scheduler.

Un semáforo general es un candidato mutex válido para la traza observada
solo si comenzó en `1` y todas sus transiciones observadas respetan un
protocolo `1 -> 0 -> 1`, donde el mismo proceso que completó `P` ejecuta
el `V` que cierra la sección candidata. Un `V` extra, una transición por
encima de `1` o una liberación cruzada invalidan el candidato.

El proceso asociado es información inferida por el analizador; no se
agrega ownership a la semántica de los semáforos.

La clasificación guarda una razón estructurada:

-   `ATOMIC_REGION`;
-   `SEMAPHORE_MUTEX`;
-   `AMBIGUOUS_SEMAPHORE_PROTOCOL`;
-   `UNPROTECTED`.

Un mismo candidato mutex válido en ambos accesos produce `SYNCHRONIZED`.
La protección unilateral produce `POTENTIAL_RACE`. Un mismo semáforo
ambiguo en ambos accesos produce `UNKNOWN` en lugar de afirmar
protección o carrera.

**Consecuencia:** la UI puede explicar por qué clasificó cada conflicto
y distinguir mutex, contadores y usos problemáticos. La conclusión vale
para la ejecución observada y no constituye prueba de corrección para
todos los interleavings.

**Motivo:** reconocer el caso académico común de exclusión mutua sin
crear un tipo binario, imponer ownership al runtime ni confundir
sincronización con ausencia total de interleaving.

------------------------------------------------------------------------

## ADR-026 --- Separar progreso global, deadlock y espera circular

**Estado:** Aceptada

**Contexto:** un proceso `BLOCKED` no demuestra deadlock. Otro proceso
puede ejecutar la operación que lo habilita y, después de un `V`, el
waiter puede seguir marcado como bloqueado hasta la próxima
reevaluación. Además, un programa puede quedar sin progreso aunque la
información disponible no permita construir un ciclo de recursos.

**Decisión:** el análisis global distingue `RUNNING`,
`TEMPORARILY_BLOCKED`, `FINISHED` y `DEADLOCK`.

Se considera deadlock el estado alcanzado cuando:

-   queda al menos un proceso sin finalizar;
-   no existe un proceso listo o ejecutándose;
-   ninguna razón de bloqueo está habilitada en el estado actual.

La espera circular es evidencia estructural adicional, no la definición
única de deadlock. Para semáforos, el analizador infiere permisos
pendientes desde el historial, construye dependencias proceso-recurso y
un wait-for graph derivado. Las componentes fuertemente conexas revelan
ciclos; si la información es insuficiente, se informa bloqueo terminal
con grafo parcial.

Los poseedores inferidos son metadata de análisis y no ownership del
runtime. El modelo de recursos admite semáforos, monitores y canales,
aunque solamente los semáforos tienen adaptador en M8.

**Consecuencia:** la UI puede explicar procesos, recursos y ciclos,
diferenciar espera temporal y deadlock y reproducir la traza hasta el
paso detectado. No se afirma que una ejecución sin deadlock pruebe que
todos los interleavings son seguros.

**Motivo:** ofrecer un diagnóstico educativo útil sin contaminar la
semántica de las primitivas ni adelantar la exploración de estados de
M9.

------------------------------------------------------------------------

## ADR-027 --- Mantener `POTENTIAL_RACE` separado de happens-before formal

**Estado:** Aceptada

**Contexto:** el engine produce una traza totalmente ordenada por pasos,
pero ese orden solamente representa el interleaving seleccionado. Si se
interpretara cada paso anterior como happens-before, todos los accesos
quedarían ordenados y ninguna race sería visible.

Un happens-before formal requeriría orden de programa y aristas causales
para `atomic`, transferencias de semáforos, `await`, monitores y
canales. Los semáforos generales agregan además permisos contados y
señalización sin ownership obligatorio.

**Decisión:** M8 mantiene un análisis de protocolos sobre la traza
observada y no lo presenta como detector formal de data races.

Cada acceso registra su protección observada. Los pares se distinguen
como sincronizados, ambiguos, potencialmente problemáticos o violaciones
de exclusión mutua observadas. Esta última categoría exige que la traza
muestre un acceso mientras otro proceso conserva un mutex incompatible.

La UI usa explícitamente "potential race observation" y declara que el
resultado no prueba una data race ni cubre todos los interleavings.

**Consecuencia:** el diagnóstico es más preciso y educativo sin atribuir
garantías que el modelo actual no demuestra. Un analizador futuro podrá
incorporar relojes vectoriales o una relación parcial equivalente como
fase separada, reutilizando eventos estructurados de sincronización.

**Motivo:** preservar la diferencia entre conflicto observado,
protección por protocolo, causalidad formal y exploración de estados.

------------------------------------------------------------------------

## ADR-028 --- Diagnosticar liveness desde evidencia finita sin prometer decidibilidad

**Estado:** Aceptada

**Contexto:** busy waiting, starvation y no terminación son propiedades
de liveness. Una traza finita puede mostrar síntomas fuertes, pero en
general no demuestra qué ocurrirá en todos los pasos futuros ni en otros
interleavings. El límite del engine tampoco debe confundirse con un
estado sin transiciones habilitadas.

**Decisión:** los diagnósticos de liveness permanecen en
`src/core/diagnostics/`, separados del runtime y del detector de
deadlock.

Busy waiting sólo se informa después de cuatro evaluaciones consecutivas
que mantienen activo un bucle vacío y leen memoria compartida. El riesgo
de starvation exige un proceso actualmente `READY`, al menos doce pasos
sin selección y actividad continuada de otros procesos.

Al alcanzar el límite con trabajo ejecutable, el estado global es
`STEP_LIMIT_REACHED`. `DEADLOCK` conserva prioridad si realmente no
existe progreso posible. Cada hallazgo incluye evidencia y una nota de
alcance; starvation se denomina riesgo y la no terminación no se
clasifica automáticamente como error.

**Consecuencia:** la UI puede enseñar diferencias entre espera activa,
postergación, no terminación y deadlock sin presentar heurísticas como
pruebas. Los umbrales y patrones podrán evolucionar sin alterar la
semántica de los procesos ni del scheduler.

**Motivo:** preferir pocos diagnósticos justificables y reproducibles a
una clasificación amplia con falsos positivos o garantías inexistentes.

------------------------------------------------------------------------

## ADR-029 --- Explorar transiciones explícitas con búsqueda acotada

**Estado:** Aceptada

**Contexto:** los schedulers actuales producen una única traza y
`reset()` puede repetirla, pero `SimulationEngine.step()` selecciona el
proceso internamente. No existe una operación para enumerar elecciones,
forzar una transición o bifurcar el engine desde un estado intermedio.

`ExecutionState` contiene además historiales crecientes, mientras el
scheduler conserva cursores o estado pseudoaleatorio fuera de él. Usar
todo ese conjunto como identidad impediría reconocer estados repetidos y
mezclaría semántica, política de scheduling, análisis y reproducción.

**Decisión:** M9 separará la enumeración de transiciones habilitadas de
su ejecución. Los schedulers seguirán eligiendo una transición durante
el uso normal; el explorador podrá ejecutar explícitamente cada elección
sin incorporar el estado privado del scheduler al estado semántico.

La exploración inicial será BFS acotada por profundidad y cantidad de
estados. Una clave canónica excluirá step e historiales, pero deberá
incluir toda metadata que afecte la semántica o diagnósticos futuros.
Los resultados serán `FOUND`, `EXHAUSTED` o `TRUNCATED`.

La primera clave implementada serializa canónicamente `Program` y se
limita a búsqueda de deadlock. El historial se proyecta como
`ExecutionTrace` independiente. Esta clave no se reutilizará para
diagnósticos de memoria hasta extraer la metadata de protección que hoy
se reconstruye desde eventos anteriores.

Deadlock será la primera propiedad buscable. El contraejemplo guardará
la secuencia exacta de procesos elegidos y se reproducirá forzando esa
secuencia, no intentando deducir una seed.

Las violaciones observadas de exclusión mutua se incorporarán sólo
después de representar correctamente su contexto de análisis.
`POTENTIAL_RACE` no se tratará como violación formal y una búsqueda
acotada no probará ausencia de starvation, no terminación ni errores en
interleavings no visitados.

**Consecuencia:** M9 requerirá refactorizar la frontera entre engine y
scheduler antes de implementar el algoritmo de búsqueda. La UI podrá
seguir usando los schedulers existentes y reproducir contraejemplos de
manera estable aunque cambie la implementación del scheduler.

Un `fork()` operativo puede clonar el estado privado del scheduler para
conservar `step()`, pero esa copia no integra el estado semántico ni su
clave canónica. El explorador continúa dependiendo de elecciones
explícitas.

El algoritmo BFS será independiente de la propiedad concreta.
`ExplorationProperty` identifica la violación, evalúa un estado y puede
extender la función de equivalencia con metadata de análisis propia. La
clave semántica de `Program` continúa siendo el valor por defecto;
deadlock se ofrece como una propiedad y un wrapper específicos. Una
propiedad no podrá reutilizar la clave por defecto si su resultado
futuro depende de información que esa clave omite.

La metadata de memoria se almacenará explícitamente en
`ExecutionAnalysisState`, separada de la traza explicativa. Sólo
retendrá valores iniciales de semáforos, operaciones exitosas de
sincronización y accesos compartidos. El engine la actualizará junto con
los eventos y los forks la clonarán estructuralmente. Una clave
analizada combinará esta metadata con `Program`; deadlock conservará la
clave semántica más pequeña.

La segunda propiedad buscable será la violación observada de exclusión
mutua ya definida por M8. Usará la clave analizada y sólo aceptará el
diagnóstico estructurado `MUTUAL_EXCLUSION_VIOLATION` con razón
`OBSERVED_MUTEX_OVERLAP`. Un conflicto clasificado únicamente como
`POTENTIAL_RACE` seguirá siendo evidencia educativa y no un fallo
formal.

La reproducción se generalizará en una operación común que fuerce la
secuencia guardada y vuelva a evaluar la propiedad terminal; los
wrappers tipados conservarán APIs explícitas para cada diagnóstico.

**Motivo:** obtener contraejemplos cortos y educativos sin presentar una
búsqueda finita como model checking exhaustivo ni acoplar la semántica a
una política particular de scheduling.

------------------------------------------------------------------------

## ADR-030 --- Estructuras académicas y efectos externos simulados

**Estado:** Aceptada

**Contexto:** algunos ejercicios utilizan colas, pilas y datos
compuestos con operaciones conceptuales como `c.pop()`,
`fallo.getNivel()` o `print(...)`. Reemplazarlos siempre por arrays e
índices permite aproximaciones, pero deforma el pseudocódigo original.

**Decisión:** las colas serán una extensión prioritaria del lenguaje y
las pilas seguirán el mismo modelo. Podrán ser locales o compartidas y
deberán integrarse con snapshots, clonación, claves canónicas y
exploración de M9.

Los registros/estructuras u objetos educativos quedan como mejora
posterior. Servirán para agrupar campos y eventualmente ofrecer métodos
simples o azúcar sintáctica, sin asumir un sistema orientado a objetos
completo.

La primera vertical utiliza `QueueValue` etiquetado dentro de
`RuntimeValue` y sintaxis `queue<T>`. Cada `enqueue`, `dequeue`, `front`,
`size` e `isEmpty` es una operación atómica de un step y produce un evento
estructurado. No se garantiza atomicidad entre dos métodos consecutivos
ni entre una operación de cola y otra variable; esos invariantes siguen
requiriendo sincronización explícita. Una extracción o consulta de frente
sobre una cola vacía es error de runtime, no una espera implícita.

Los métodos que retornan valores se limitan inicialmente a una
declaración o asignación local directa. `enqueue` tampoco lee memoria
compartida dentro de su argumento: esa lectura debe capturarse primero en
una variable local. Esta frontera permite introducir el ADT sin ocultar
accesos al análisis de interferencia ni mezclar todavía efectos mutables
con el evaluador general de expresiones suspendibles.

La segunda vertical incorpora `PriorityQueueValue` y sintaxis
`priority_queue<T>`. El mayor entero representa mayor prioridad. Cada
inserción se coloca detrás de los elementos que ya tienen la misma
prioridad, preservando FIFO en empates. No se guarda un contador de
inserción: el propio orden de los pares `{ value, priority }` contiene
toda la información observable y evita inflar innecesariamente la clave
semántica de M9.

`front()` y `dequeue()` conservan la misma interfaz en ambos tipos de
cola: retornan el valor primitivo, no la prioridad. Esto permite cambiar
la política de orden sin obligar al consumidor a manipular metadata de
la estructura.

La tercera vertical incorpora `StackValue` y sintaxis `stack<T>`. El
literal se escribe desde el fondo hacia la cima; el último elemento es la
cima observable. `push`, `pop`, `top`, `size` e `isEmpty` reutilizan la
misma instrucción interna y el mismo evento estructurado que las colas,
pero el runtime valida que no se mezclen métodos propios de cada ADT.

Las acciones externas necesarias sólo para expresar el algoritmo podrán
ser operaciones simuladas. Por ejemplo, `print(valor)` podrá registrar
que la acción ocurrió sin producir I/O real. Deberán ser deterministas y
reproducibles.

**Consecuencia:** los programas podrán mantenerse cerca de los
enunciados de la cátedra. Toda estructura mutable compartida será parte
del estado semántico y toda operación observable tendrá una semántica de
step explícita.

**Motivo:** aumentar fidelidad académica sin convertir el simulador en
un runtime de propósito general.

------------------------------------------------------------------------

## ADR-031 --- Expansión temprana de procesos parametrizados

**Estado:** Aceptada

**Contexto:** los ejercicios académicos suelen declarar familias como
`process Controlador[i:0..3]`. Duplicar manualmente el cuerpo de cada
instancia deforma el pseudocódigo y facilita divergencias accidentales.

**Decisión:** el parser expande cada rango inclusivo en procesos
ordinarios identificados como `Controlador[0]`, `Controlador[1]`, etc. El
índice se inicializa en la memoria local de cada proceso. Se admiten
rangos ascendentes, descendentes y extremos negativos.

Una declaración puede expandirse como máximo a 1000 instancias, evitando
que un error de escritura bloquee el parser o la interfaz.

El cuerpo se parsea una sola vez y se clona estructuralmente para cada
instancia. El runtime, los schedulers y M9 no incorporan lógica especial
para grupos parametrizados.

**Consecuencia:** cada instancia tiene program counter, stacks, memoria,
bloqueo y transiciones independientes. La identidad expandida forma parte
natural del estado semántico y de los contraejemplos.

**Motivo:** mantener la sintaxis cercana a la cátedra reutilizando por
completo el modelo concurrente existente.

------------------------------------------------------------------------

## ADR-032 --- Play/Pause reutiliza `SimulationEngine.step()`

**Estado:** Aceptada

**Contexto:** M11 necesita observar una ejecución a velocidad humana sin
duplicar el comportamiento de `Step`, `Run` o los schedulers.

**Decisión:** la reproducción continua pertenece exclusivamente a la UI.
Un temporizador invoca el mismo `SimulationEngine.step()`, publica un
snapshot después de cada avance y se detiene ante finalización, deadlock,
límite de pasos, falta de progreso o error. Las velocidades disponibles
sólo modifican el intervalo entre avances.

Toda acción que pueda reemplazar o avanzar el engine cancela primero la
reproducción. `Run` conserva su significado de ejecución inmediata y no
se implementa acelerando el temporizador.

**Consecuencia:** la velocidad no modifica el estado semántico, las
trazas, los interleavings, los seeds ni las claves de exploración. Las
ejecuciones manual y continua producen los mismos pasos para el mismo
scheduler.

**Motivo:** ofrecer animación educativa sin crear un segundo motor ni
introducir concurrencia real dentro del simulador.

------------------------------------------------------------------------

## ADR-033 --- El foco visual deriva del snapshot y de la traza

**Estado:** Aceptada

**Contexto:** Step, Play y replay necesitan señalar el mismo proceso,
instrucción y microoperación sin hacer que la UI inspeccione program
counters, frames internos o runtimes parciales del engine.

**Decisión:** `SimulationSnapshot` expone un `executionFocus` derivado
del último evento ejecutado. Si la microoperación más reciente pertenece
al mismo step, se incluye como detalle del foco. La vista utiliza esa
metadata para el panel, la tarjeta de proceso y el historial.

El foco representa el último step efectivamente ejecutado. No se lo
presenta como ubicación exacta dentro del código fuente, porque el AST
todavía no conserva rangos del tokenizer.

**Consecuencia:** todas las formas de avance comparten el mismo foco y
Reset lo elimina junto con el historial. La metadata no modifica estado
semántico, schedulers, claves de exploración ni contraejemplos.

**Motivo:** mantener la explicación visual fiel a los eventos reales y
reservar el resaltado del editor para una implementación con posiciones
de origen correctas.

------------------------------------------------------------------------

## ADR-034 --- Step Back reconstruye en lugar de invertir

**Estado:** Aceptada

**Contexto:** retroceder una instrucción debería restaurar no sólo
memoria, sino semáforos, procesos bloqueados, frames, evaluaciones
pendientes, scheduler, historial, análisis y foco. Implementar una
operación inversa para cada efecto duplicaría la semántica del engine.

**Decisión:** el retroceso crea un engine candidato desde el estado
inicial y reproduce `step()` hasta el destino con un clon reseteado del
scheduler. La traza esperada valida proceso y tipo de instrucción. El
engine visible adopta candidato y scheduler sólo después de una
reproducción completa; una divergencia no modifica el estado original.

La UI deshabilita esta operación durante el replay de contraejemplos,
donde las elecciones se fuerzan mediante `stepTransition()`.

**Consecuencia:** los schedulers deterministas y Random con seed regresan
a una posición reproducible y el próximo Step repite la elección
original. El costo es lineal respecto del paso destino; checkpoints
podrán optimizarlo sin cambiar el contrato.

**Motivo:** reutilizar una única semántica forward y preservar todos los
componentes del estado sin mantener lógica de undo por instrucción.

------------------------------------------------------------------------

## ADR-035 --- La ubicación ejecutada viaja con la instrucción y la traza

**Estado:** Aceptada

**Contexto:** resaltar el editor desde el program counter sería
incorrecto para cuerpos anidados, funciones, procesos parametrizados,
microoperaciones y retrocesos. Además, un `textarea` no permite colorear
una línea individual.

**Decisión:** tokenizer y parser conservan `SourceRange` con offsets y
línea/columna; el extremo final es exclusivo. Las instrucciones parseadas
transportan el rango y el engine lo copia al `ExecutionEvent` y al foco
del snapshot. El rango es opcional para instrucciones creadas mediante
factories fuera del parser.

La UI mantiene el `textarea` como control editable y sincroniza detrás
una capa visual no interactiva. El número de línea mostrado y el
resaltado derivan exclusivamente de `executionFocus.sourceRange`.

**Consecuencia:** Step, Play, Run y Step Back señalan la misma fuente sin
consultar frames ni program counters. Los rangos pueden reutilizarse más
adelante para errores enriquecidos, selección de fragmentos o breakpoints.
La capa del editor exige mantener idénticas tipografía, espaciado y
scroll en ambos elementos.

**Motivo:** preservar la correspondencia semántica desde el código hasta
la ejecución sin reemplazar todavía el editor por una dependencia
externa de mayor tamaño.

------------------------------------------------------------------------

## ADR-036 --- Settings modifica presentación, no simulación

**Estado:** Aceptada

**Contexto:** temas y paneles opcionales deben personalizar una interfaz
extensa sin contaminar snapshots, forks, exploración, replay o claves de
estado concurrente. El almacenamiento del navegador puede faltar,
corromperse o contener una versión antigua.

**Decisión:** `InterfacePreferences` es un esquema visual versionado que
se carga y guarda detrás de funciones tolerantes a errores. El tema
System se resuelve con `prefers-color-scheme`; Light y Dark son explícitos.
Los switches condicionan únicamente el render y conservan en el padre las
selecciones y resultados de cada panel.

El modal implementa semántica `dialog`, foco inicial, ciclo de Tab,
Escape, bloqueo temporal del scroll y devolución del foco. Restore
defaults crea un objeto nuevo con System y todos los paneles visibles.

**Consecuencia:** recargar conserva preferencias, pero compartir o
retroceder una simulación nunca las transporta. Datos inválidos vuelven a
defaults y una falla de `localStorage` no impide usar el programa. Nuevas
opciones requieren incrementar o migrar la versión cuando dejen de ser
compatibles.

**Motivo:** separar estrictamente experiencia de usuario y semántica
concurrente, manteniendo personalización recuperable y predecible.
