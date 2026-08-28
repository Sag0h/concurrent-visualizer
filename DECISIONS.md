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

- modo Memoria Compartida;
- modo Pasaje de Mensajes;
- modo Híbrido/Avanzado.

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

```text
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

- `if / else`;
- `while`;
- `repeat / until`;
- `for`;
- `foreach`;
- `break`;
- `continue`;
- funciones;
- parámetros;
- variables locales de función;
- llamadas a funciones;
- llamadas a funciones dentro de expresiones;
- `return`;
- funciones vacías.

Previstas posteriormente:

- `sleep`;
- `yield`.

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

- deadlock;
- race conditions;
- exclusión mutua;
- busy waiting;
- starvation cuando sea viable;
- errores de comunicación.

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

```text
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

```text
x = x + 1;
```

puede conceptualmente descomponerse como:

```text
SHARED_READ x
COMPUTE + 1
SHARED_WRITE x
```

Una lectura captura el valor observado en ese instante. El cálculo
posterior utiliza ese valor capturado aunque otro proceso modifique la
variable compartida antes de la escritura.

La misma regla se aplica cuando una lectura compartida participa en la
resolución de un target. Por ejemplo:

```text
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

```text
values[0]
values[1]
```

deben poder tratarse como ubicaciones distintas.

**Decisión:** representar los accesos relevantes a memoria compartida
mediante la abstracción `MemoryLocation`.

Actualmente se distinguen:

```text
VARIABLE(name)
ARRAY_ELEMENT(arrayName, index)
```

Los eventos de microoperación pueden asociarse a una `MemoryLocation`
concreta.

Dos ubicaciones se consideran iguales solamente cuando representan la
misma variable o el mismo elemento exacto de un array.

Esta abstracción se utiliza como base para:

- historial de accesos compartidos;
- visualización de lecturas y escrituras;
- detección de accesos conflictivos;
- agrupación y resumen de conflictos;
- futuras extensiones del análisis concurrente.

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

```text
atomic {
    x = x + 1;
}
```

continúa pudiendo generar:

```text
SHARED_READ x
COMPUTE
SHARED_WRITE x
```

pero ningún otro proceso puede ser seleccionado entre esas
microoperaciones mientras la región permanezca activa.

Cada proceso mantiene un contador `atomicDepth`.

Conceptualmente:

```text
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

```text
P1 atomic + P2 normal -> POTENTIAL_RACE
P1 atomic + P2 atomic -> SYNCHRONIZED
```

La clasificación `SYNCHRONIZED` describe conflictos cuyos dos accesos
fueron realizados dentro del mecanismo de atomicidad explícita conocido
actualmente por el engine.

`POTENTIAL_RACE` se utiliza cuando esa protección no está presente en
ambos accesos.

Esta clasificación no pretende todavía implementar una definición
formal completa de data race basada en happens-before. El análisis podrá
refinarse cuando existan semáforos, monitores y otros mecanismos de
sincronización.

**Consecuencia:** la UI puede seguir mostrando las microoperaciones
individuales de una región atómica y, al mismo tiempo, indicar que sus
accesos se encuentran sincronizados.

**Motivo:** preservar tanto la semántica correcta de exclusión como el
valor educativo de observar qué acciones internas componen una
operación aparentemente indivisible.

------------------------------------------------------------------------
