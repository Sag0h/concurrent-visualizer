# Concurrent Visualizer --- Arquitectura

> Este documento describe la arquitectura vigente. Debe actualizarse
> cuando el diseño real cambie.

## 1. Visión

Concurrent Visualizer será una aplicación web educativa capaz de
interpretar y simular pseudocódigo concurrente.

El objetivo no es crear animaciones prefabricadas para problemas
específicos. Los problemas deben emerger de la ejecución real del
programa ingresado.

Ejemplo conceptual:

`Código → Parser → AST → Simulation Engine → Estado → Visualización / Análisis`

## 2. Stack

-   React
-   TypeScript
-   Vite
-   ESLint
-   Git
-   Tailwind CSS: previsto, todavía no necesario.
-   React Flow: previsto para visualizaciones de procesos, recursos y
    canales.

No se requiere backend para la primera versión.

## 3. Principio fundamental

El motor de simulación debe ser independiente de React.

La UI consume el estado producido por el motor, pero no contiene la
lógica de concurrencia.

Esto permitirá:

-   probar el motor mediante tests;
-   ejecutar análisis sin renderizar la UI;
-   cambiar la interfaz sin modificar la semántica;
-   explorar múltiples ejecuciones programáticamente.

## 4. Estructura objetivo inicial

``` text
src/
├── core/
│   ├── engine/
│   ├── scheduler/
│   ├── process/
│   ├── instructions/
│   ├── memory/
│   └── analysis/
├── components/
├── pages/
└── App.tsx
```

La estructura puede cambiar a medida que el dominio se comprenda mejor.

## 5. Entidades fundamentales previstas

### Program

Representa un programa concurrente completo.

Podrá contener:

-   procesos;
-   memoria compartida;
-   semáforos;
-   monitores;
-   canales;
-   configuración del modelo de ejecución.

### Process

Representará una unidad de ejecución concurrente.

Información prevista:

-   identificador;
-   estado;
-   program counter;
-   instrucciones;
-   memoria local;
-   call stack;
-   recurso o condición esperada;
-   recursos poseídos;
-   historial relevante.

Estados iniciales previstos:

-   `READY`
-   `RUNNING`
-   `BLOCKED`
-   `FINISHED`

### Instruction y microoperaciones

`Instruction` representa una instrucción visible del pseudocódigo.

Una instrucción no constituye necesariamente una única acción atómica del
simulador. Cuando sea necesario representar interferencia, podrá
descomponerse en microoperaciones internas del runtime.

Ejemplo conceptual:

``` text
Instrucción fuente:

x = x + 1;

Microoperaciones:

READ x
COMPUTE + 1
WRITE x
```

Una microoperación constituye la unidad mínima de ejecución atómica del
motor.

El scheduler podrá seleccionar otro proceso entre dos microoperaciones,
permitiendo que distintos procesos intercalen la ejecución de instrucciones
que todavía no terminaron.

Por este motivo, un proceso podrá mantener estado temporal asociado a una
instrucción parcialmente ejecutada.

En particular, una lectura de memoria compartida deberá capturar el valor
observado en ese instante. Las microoperaciones posteriores utilizarán ese
valor capturado aunque otro proceso modifique la memoria compartida antes de
que la instrucción termine.

Inicialmente la descomposición detallada se concentrará en operaciones que
interactúan con memoria compartida. Las operaciones puramente locales podrán
continuar ejecutándose con mayor granularidad salvo que sea necesario
descomponerlas por motivos semánticos o educativos.

### ExecutionState

Snapshot del estado actual del sistema.

Debe ser suficiente para:

-   renderizar la simulación;
-   reproducir una ejecución;
-   comparar estados;
-   explorar interleavings;
-   detectar errores.

### Scheduler

Decide qué proceso `READY` obtiene el próximo paso de ejecución.

Schedulers previstos:

-   determinista;
-   round-robin;
-   aleatorio reproducible mediante seed;
-   scheduler de exploración para análisis exhaustivo/acotado.

### SimulationEngine

Responsable de aplicar una transición válida al estado actual.

En el modelo concurrente detallado, una transición producida por `step()`
corresponderá normalmente a una microoperación atómica del proceso
seleccionado.

Completar una instrucción fuente podrá requerir múltiples llamadas a
`step()`.

API conceptual:

``` ts
engine.step()
engine.reset()
engine.getState()
```

No se fija todavía la API definitiva.

## 6. Modelos de comunicación

No se crearán dos aplicaciones independientes.

El mismo framework soportará subsistemas diferentes.

``` text
Simulation Engine
├── Process/Scheduler
├── Shared Memory Subsystem
└── Message Passing Subsystem
```

### Memoria compartida

Permitirá posteriormente:

-   variables compartidas;
-   acciones atómicas;
-   `await`;
-   semáforos;
-   monitores;
-   variables condición.

### Pasaje de mensajes

Permitirá posteriormente:

-   memoria local aislada;
-   canales;
-   `send`;
-   `receive`;
-   comunicación asincrónica;
-   comunicación sincrónica;
-   RPC;
-   Rendezvous.

### Modo híbrido

El motor podrá diseñarse para combinar mecanismos, pero la interfaz
educativa podrá restringirlos para respetar el paradigma que el alumno
está estudiando.

## 7. Tiempo

No se utilizará tiempo real de JavaScript como fundamento de la
semántica concurrente.

Se utilizará tiempo simulado.

Ejemplo:

``` text
sleep(3)
```

significará bloquear un proceso durante una cantidad definida de ticks
simulados.

Esto hace que las ejecuciones sean:

-   deterministas cuando corresponda;
-   reproducibles;
-   independientes de la velocidad de la máquina.

## 8. Lenguaje objetivo

La capa secuencial prevista incluye:

-   variables;
-   arrays;
-   asignaciones;
-   expresiones;
-   funciones;
-   llamadas;
-   `if / else`;
-   `while`;
-   `repeat / until`;
-   `for`;
-   `foreach`;
-   `break`;
-   `continue`;
-   `return`;
-   `sleep`;
-   `yield`.

La capa concurrente crecerá con la materia:

-   `process`;
-   memoria compartida;
-   atomicidad;
-   `await`;
-   semáforos `P` y `V`;
-   monitores;
-   `wait` / `signal`;
-   canales;
-   `send` / `receive`;
-   `sync_send`;
-   mecanismos posteriores de la cursada.

## 9. Parser

El parser NO se implementará al comienzo.

Primero se desarrollará y probará el motor usando representaciones
TypeScript creadas manualmente.

Cuando la semántica del motor sea suficientemente estable:

`Texto → Tokens → Parser → AST → representación ejecutable → Engine`

Esto reduce el riesgo de diseñar una gramática alrededor de un motor
todavía inestable.

## 10. Análisis de errores

El simulador debe aspirar a detectar problemas que emerjan de la
ejecución.

Entre ellos:

-   deadlock;
-   race conditions;
-   violaciones de exclusión mutua;
-   busy waiting;
-   starvation cuando sea razonablemente detectable;
-   bloqueos por comunicación;
-   estados inválidos.

El análisis de deadlock podrá utilizar grafos de espera.

## 11. Exploración de interleavings

Una ejecución correcta no demuestra que un programa concurrente sea
correcto.

El sistema deberá eventualmente poder explorar múltiples elecciones
posibles del scheduler y buscar contraejemplos.

Ejemplo:

``` text
Ejecución actual: finalizó correctamente.

Análisis:
Existe otro interleaving que produce deadlock.
```

Los contraejemplos deberán poder reproducirse paso a paso en la
interfaz.

## 12. Problemas clásicos

Los problemas clásicos no deberían estar codificados como animaciones
especiales.

Ejemplos previstos:

-   Productor/Consumidor.
-   Lectores/Escritores.
-   Filósofos comensales / mesa circular.
-   Sección crítica.
-   Barreras.

Deben expresarse como programas válidos del lenguaje y ser ejecutados
por el mismo motor general.

## 13. Fuente académica

La semántica de primitivas concurrentes debe seguir prioritariamente el
material de Programación Concurrente de la Facultad de Informática de la
UNLP que se esté utilizando en la cursada.

El material histórico sirve para anticipar temas y diseñar
extensibilidad, pero debe compararse con el material actual antes de
fijar comportamientos específicos.
