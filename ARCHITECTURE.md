# Concurrent Visualizer --- Arquitectura

> Este documento describe la arquitectura vigente. Debe actualizarse
> cuando el diseño real cambie.

## 1. Visión

Concurrent Visualizer es una aplicación web educativa capaz de interpretar
y simular pseudocódigo concurrente.

El objetivo no es crear animaciones prefabricadas para problemas
específicos. Los problemas deben emerger de la ejecución real del programa
ingresado.

Flujo vigente:

```text
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
ExecutionState / SimulationSnapshot
    ↓
Visualización / Análisis
```

## 2. Stack

- React
- TypeScript
- Vite
- ESLint
- Git

Previstos cuando sean necesarios:

- Tailwind CSS;
- React Flow para visualizaciones de procesos, recursos y canales.

No se requiere backend para la primera versión.

## 3. Principio fundamental

El motor de simulación es independiente de React.

La UI consume el estado producido por el motor, pero no contiene la lógica
de concurrencia.

Esto permite:

- probar el motor mediante tests;
- ejecutar análisis sin renderizar la UI;
- cambiar la interfaz sin modificar la semántica;
- explorar múltiples ejecuciones programáticamente;
- reutilizar el mismo motor para distintos modelos de concurrencia.

## 4. Estructura general

La arquitectura se organiza alrededor de un núcleo de simulación separado
de la interfaz.

Estructura conceptual:

```text
src/
├── core/
│   ├── engine/
│   ├── scheduler/
│   ├── process/
│   ├── instructions/
│   ├── expressions/
│   ├── memory/
│   └── analysis/
├── components/
└── App.tsx
```

La estructura exacta puede evolucionar a medida que se incorporen nuevas
primitivas concurrentes.

## 5. Entidades fundamentales

### Program

Representa un programa concurrente completo.

Actualmente contiene principalmente:

- procesos;
- memoria compartida;
- definiciones de funciones.

A futuro podrá incorporar:

- semáforos;
- monitores;
- canales;
- configuración adicional del modelo de ejecución.

### Process

Representa una unidad de ejecución concurrente.

Cada proceso mantiene estado propio, incluyendo:

- identificador;
- estado;
- program counter;
- instrucciones;
- memoria local;
- execution stack;
- call stack;
- evaluaciones suspendidas;
- estado temporal de microoperaciones;
- profundidad atómica.

Estados soportados:

```text
READY
RUNNING
BLOCKED
FINISHED
```

`BLOCKED` ya forma parte del modelo de estados y será utilizado por
primitivas de sincronización como `await` y semáforos.

### Instruction

`Instruction` representa una instrucción visible del pseudocódigo.

Ejemplos:

```text
x = x + 1;
if (ready) { ... }
return value;
atomic { ... }
```

Una instrucción fuente no constituye necesariamente una única acción
atómica del simulador.

Cuando una instrucción contiene operaciones relevantes para la
interferencia concurrente puede descomponerse en microoperaciones internas.

### MicroOperation

Una microoperación constituye la unidad mínima de ejecución atómica del
motor cuando una instrucción requiere descomposición concurrente.

Ejemplo:

```text
x = x + 1;
```

puede ejecutarse conceptualmente como:

```text
SHARED_READ x
COMPUTE
SHARED_WRITE x
```

Entre dos microoperaciones el scheduler puede seleccionar otro proceso,
salvo que una región `atomic` activa lo impida.

Por esta razón una instrucción puede comenzar en un step y terminar varios
steps después.

Las operaciones puramente locales pueden continuar ejecutándose con una
granularidad mayor cuando no existe una razón semántica o educativa para
descomponerlas.

## 6. Runtime de expresiones suspendibles

El evaluador inmediato de expresiones es apropiado para expresiones puras
como:

```text
x + 1
a < b
!ready
```

pero no para llamadas a funciones que pueden requerir múltiples
instrucciones y múltiples steps.

Ejemplo:

```text
result = double(5) + other();
```

Ejecutar completamente una función dentro de un evaluador síncrono la
convertiría artificialmente en una operación atómica.

Por eso cada proceso mantiene una pila de evaluaciones pendientes.

Flujo conceptual:

```text
Expression
    ↓
se detecta FUNCTION_CALL
    ↓
se suspende la instrucción
    ↓
la función se ejecuta mediante el call stack normal
    ↓
return
    ↓
la llamada se reemplaza por el valor retornado
    ↓
la expresión continúa
```

La pila de evaluaciones pendientes permite continuaciones anidadas.

Este mecanismo se utiliza en contextos como:

- declaraciones;
- asignaciones;
- `if`;
- `while`;
- `repeat / until`;
- `for`;
- `foreach`;
- `return`;
- argumentos de funciones;
- índices de arrays;
- targets de asignación a arrays.

Regla arquitectónica:

> Una expresión que pueda contener una llamada a función no debe evaluarse
> directamente como una expresión inmediata sin pasar primero por el runtime
> suspendible.

## 7. Runtime de microoperaciones compartidas

Las asignaciones que afectan memoria compartida pueden mantener estado
temporal entre steps.

Actualmente el runtime de asignaciones compartidas conserva información
conceptualmente equivalente a:

```text
SharedAssignmentRuntime
├── instruction
├── phase
├── pendingExpression
├── pendingTargetIndex
├── computedValue
└── targetLocation
```

Las fases actuales son:

```text
READ
COMPUTE
TARGET_READ
WRITE
```

### READ

Busca una lectura pendiente de memoria compartida dentro de la expresión.

Cuando encuentra una lectura:

1. obtiene el valor actual;
2. registra una microoperación `SHARED_READ`;
3. sustituye esa lectura por el valor observado;
4. conserva la expresión parcialmente evaluada para el siguiente step.

### COMPUTE

Una vez resueltas las lecturas compartidas necesarias del lado derecho, se
evalúa la expresión restante.

El resultado queda almacenado en el runtime de la instrucción.

### TARGET_READ

Se utiliza cuando el target de la asignación es un elemento de array y su
índice depende de memoria compartida.

Ejemplo:

```text
values[i + offset] = 50;
```

Las lecturas de `i` y `offset` se ejecutan como microoperaciones
independientes.

Sus valores quedan capturados y se utilizan posteriormente para resolver la
ubicación exacta del target.

### WRITE

La escritura final utiliza el valor calculado y la ubicación de destino ya
resuelta.

Esto evita que modificaciones posteriores de las variables utilizadas para
calcular un índice alteren retroactivamente el destino de una asignación ya
iniciada.

## 8. Captura de valores observados

Una lectura de memoria compartida captura el valor observado en ese
instante.

Ejemplo:

```text
shared int x = 0;

process P1 {
    x = x + 1;
}

process P2 {
    x = x + 1;
}
```

Un interleaving válido es:

```text
P1 SHARED_READ  x = 0
P2 SHARED_READ  x = 0
P1 COMPUTE      1
P2 COMPUTE      1
P1 SHARED_WRITE x = 1
P2 SHARED_WRITE x = 1
```

El hecho de que `x` cambie después de una lectura no modifica el valor ya
capturado por el proceso.

La misma regla se aplica a lecturas utilizadas para resolver targets de
arrays.

## 9. MemoryLocation

Los accesos compartidos se representan mediante ubicaciones concretas de
memoria.

La abstracción `MemoryLocation` distingue actualmente:

```text
VARIABLE(name)
ARRAY_ELEMENT(arrayName, index)
```

Ejemplos:

```text
x
values[0]
values[1]
```

`values[0]` y `values[1]` representan ubicaciones diferentes.

Esta abstracción es utilizada por:

- eventos de microoperación;
- historial de accesos compartidos;
- detección de conflictos;
- agrupación de conflictos;
- visualización de interferencias;
- futuros análisis de sincronización.

La comparación de accesos se realiza sobre la ubicación concreta, no solo
sobre el nombre general de la estructura.

## 10. ExecutionState

`ExecutionState` representa el estado global mutable de una simulación.

Incluye conceptualmente:

- `Program`;
- contador global de steps;
- historial de instrucciones;
- historial de microoperaciones.

El historial de instrucciones fuente y el historial de microoperaciones se
mantienen separados.

Esto permite ofrecer dos perspectivas:

```text
Vista fuente
    x = x + 1;

Vista concurrente
    SHARED_READ x
    COMPUTE
    SHARED_WRITE x
```

### SimulationSnapshot

La UI no necesita manipular directamente el estado interno del engine.

`SimulationSnapshot` expone una representación segura del estado necesaria
para visualización y análisis.

Actualmente puede incluir:

- step actual;
- memoria compartida;
- procesos;
- memoria local;
- call stack;
- historial de microoperaciones;
- conflictos de memoria;
- resúmenes de conflictos.

Las memorias expuestas se clonan para impedir modificaciones accidentales
desde React.

## 11. Scheduler

El scheduler decide qué proceso `READY` obtiene el próximo paso de
ejecución.

Schedulers disponibles:

- First Ready;
- Round Robin;
- Random reproducible mediante seed.

A futuro podrá existir un scheduler especializado para exploración de
estados e interleavings.

En condiciones normales el scheduler puede elegir un proceso diferente
entre dos microoperaciones.

La excepción actual es la ejecución dentro de una región `atomic`.

## 12. SimulationEngine

`SimulationEngine` aplica transiciones válidas sobre `ExecutionState`.

API principal:

```ts
engine.step()
engine.reset()
engine.getState()
engine.getSnapshot()
```

`step()` informa si se produjo progreso real.

Conceptualmente:

```text
true  -> se ejecutó una transición
false -> ningún proceso pudo progresar
```

Esto permite evitar loops infinitos en `Run` cuando ningún proceso puede
ser seleccionado.

Si una instrucción produce un error de runtime, el proceso no debe quedar
permanentemente en estado `RUNNING`.

Cuando una instrucción requiere microoperaciones, completar una instrucción
fuente puede necesitar múltiples llamadas a `step()`.

## 13. Atomicidad explícita

El lenguaje soporta:

```text
atomic {
    ...
}
```

Una región `atomic` representa una región no intercalable.

No convierte todo su cuerpo en una única microoperación.

Ejemplo:

```text
atomic {
    x = x + 1;
}
```

continúa pudiendo ejecutar:

```text
SHARED_READ x
COMPUTE
SHARED_WRITE x
```

pero el scheduler no puede ejecutar otro proceso entre esas
microoperaciones.

### atomicDepth

Cada proceso mantiene `atomicDepth`.

Conceptualmente:

```text
fuera de atomic       0
atomic exterior       1
atomic anidado        2
salida del anidado    1
salida del exterior   0
```

Mientras un proceso `READY` tenga `atomicDepth > 0`, ese proceso conserva
la ejecución antes de consultar la política normal del scheduler.

Esto permite soportar regiones anidadas.

### Salidas no estructuradas

`return`, `break` y `continue` pueden abandonar frames internos antes de
que estos completen su flujo normal.

Por eso el unwind del `executionStack` debe detectar frames que representan
la salida de una región atómica y reducir correctamente `atomicDepth`.

Esto evita que un proceso quede permanentemente marcado como si siguiera
dentro de una región `atomic`.

Las regiones atómicas vacías también están soportadas y no deben dejar
estado atómico residual.

## 14. Eventos y análisis de memoria

Cada acceso compartido relevante puede producir un `MicroOperationEvent`.

Un evento registra información como:

- step;
- proceso;
- tipo de microoperación;
- descripción;
- ubicación de memoria;
- profundidad atómica.

Los eventos son la base del análisis de interferencias.

### MemoryAccessConflict

Dos accesos se consideran conflictivos cuando:

1. pertenecen a procesos diferentes;
2. afectan la misma `MemoryLocation`;
3. al menos uno es una escritura.

Casos relevantes:

```text
READ  + WRITE
WRITE + READ
WRITE + WRITE
```

Dos lecturas no generan conflicto.

### Clasificación

Los conflictos conocidos actualmente pueden clasificarse como:

```text
POTENTIAL_RACE
SYNCHRONIZED
```

`POTENTIAL_RACE` representa accesos conflictivos que no están protegidos
completamente por el mecanismo de atomicidad conocido.

`SYNCHRONIZED` representa accesos conflictivos donde ambos accesos fueron
realizados dentro de regiones atómicas.

Ejemplo conceptual:

```text
P1 normal + P2 normal -> POTENTIAL_RACE
P1 atomic + P2 normal -> POTENTIAL_RACE
P1 atomic + P2 atomic -> SYNCHRONIZED
```

Esta clasificación todavía no constituye una implementación formal
completa de data race basada en happens-before.

Cuando existan semáforos, monitores y otros mecanismos de sincronización,
el análisis deberá evolucionar.

### MemoryConflictSummary

Los conflictos pueden agruparse por `MemoryLocation` para facilitar la
visualización.

Esto permite mostrar, por ejemplo, qué procesos accedieron
conflictivamente a una variable o elemento de array y cuántos conflictos
se observaron durante la ejecución.

## 15. Modelos de comunicación

No se crearán simuladores independientes para cada paradigma.

El mismo framework compartirá el núcleo de procesos, scheduling, estados,
historial y análisis.

```text
Simulation Engine
├── Process / Scheduler
├── Shared Memory Subsystem
└── Message Passing Subsystem
```

### Memoria compartida

Actualmente soporta:

- variables compartidas;
- arrays compartidos;
- interleavings de microoperaciones;
- análisis de accesos;
- regiones `atomic`.

Próximamente incorporará:

- `await`;
- semáforos;
- monitores;
- variables condición.

### Pasaje de mensajes

Previsto posteriormente:

- memoria local aislada;
- canales;
- `send`;
- `receive`;
- comunicación asincrónica;
- comunicación sincrónica;
- RPC;
- Rendezvous.

### Modo híbrido

El motor podrá combinar mecanismos, pero la interfaz educativa podrá
restringirlos para respetar el paradigma que se esté estudiando.

## 16. Tiempo

No se utilizará tiempo real de JavaScript como fundamento de la semántica
concurrente.

Cuando se incorpore:

```text
sleep(3)
```

representará una cantidad de ticks simulados y no segundos reales del
navegador.

Esto mantiene las ejecuciones:

- reproducibles;
- independientes de la velocidad de la máquina;
- compatibles con análisis programático de estados.

## 17. Lenguaje actual y evolución

La capa secuencial soporta actualmente:

- variables;
- arrays;
- asignaciones;
- expresiones;
- funciones;
- llamadas;
- llamadas dentro de expresiones;
- `if / else`;
- `while`;
- `repeat / until`;
- `for`;
- `foreach`;
- `break`;
- `continue`;
- `return`.

La capa concurrente soporta actualmente:

- `process`;
- memoria compartida;
- microoperaciones compartidas;
- `atomic`.

Próximas extensiones:

- `await`;
- semáforos `P` y `V`;
- monitores;
- `wait` / `signal`;
- canales;
- `send` / `receive`;
- `sync_send`;
- tiempo simulado;
- otros mecanismos relevantes de la cursada.

## 18. Parser

El parser ya forma parte de la arquitectura vigente.

El flujo actual es:

```text
Texto
    ↓
Tokenizer
    ↓
Parser descendente recursivo
    ↓
AST / Program
    ↓
SimulationEngine
```

El parser soporta la capa secuencial actual y se extiende incrementalmente
con las nuevas primitivas concurrentes.

La implementación conserva información de línea y columna para producir
errores de sintaxis precisos.

`atomic` ya forma parte del tokenizer, parser y AST.

Las primitivas futuras, comenzando por `await`, deberán integrarse al mismo
pipeline en lugar de utilizar parsers o rutas de ejecución paralelas.

## 19. Análisis de errores

El simulador debe detectar problemas que emerjan de la ejecución real del
programa.

Actualmente existe una primera base de análisis mediante conflictos de
memoria compartida.

El objetivo posterior incluye:

- data races con análisis más formal;
- deadlock;
- violaciones de exclusión mutua;
- busy waiting;
- starvation cuando sea razonablemente detectable;
- bloqueos por comunicación;
- estados inválidos.

La detección de deadlock podrá utilizar grafos de espera cuando existan
recursos y procesos bloqueados suficientes para construirlos.

## 20. Exploración de interleavings

Una ejecución correcta no demuestra que un programa concurrente sea
correcto.

El sistema deberá eventualmente poder explorar elecciones alternativas del
scheduler y buscar contraejemplos.

Ejemplo:

```text
Ejecución actual:
finalizó correctamente.

Análisis:
existe otro interleaving que produce deadlock.
```

Los contraejemplos deberán poder reproducirse paso a paso en la interfaz.

La reproducibilidad mediante seeds y el historial detallado de ejecución
son fundamentos para esta funcionalidad futura.

## 21. Problemas clásicos

Los problemas clásicos no deben estar codificados como animaciones
especiales.

Ejemplos previstos:

- Productor/Consumidor;
- Lectores/Escritores;
- Filósofos comensales / mesa circular;
- Sección crítica;
- Barreras.

Deben expresarse como programas válidos del lenguaje y ser ejecutados por
el mismo motor general.

## 22. Fuente académica

La semántica de primitivas concurrentes debe seguir prioritariamente el
material de Programación Concurrente de la Facultad de Informática de la
UNLP utilizado en la cursada actual.

El material histórico puede utilizarse para anticipar conceptos y diseñar
extensibilidad, pero debe compararse con el material vigente antes de fijar
comportamientos específicos.

La próxima primitiva a incorporar es `await`.

Su diseño deberá reutilizar la infraestructura existente de:

- estados de proceso;
- scheduling;
- microoperaciones;
- atomicidad;
- historial;
- snapshots;

sin introducir un segundo mecanismo de ejecución paralelo.
