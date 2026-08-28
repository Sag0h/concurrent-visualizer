# Concurrent Visualizer

> Simulador educativo de programación concurrente para **escribir, ejecutar, visualizar y analizar pseudocódigo concurrente paso a paso**.

Concurrent Visualizer nace como herramienta de estudio para **Programación Concurrente de la Facultad de Informática de la UNLP**, pero está diseñado como un motor general de pseudocódigo concurrente.

La idea central es que los problemas de concurrencia no sean animaciones prefabricadas: deben **emerger de la ejecución real del programa**, del scheduler y de los interleavings producidos por el motor.

---

## Estado del proyecto

**Milestone actual:** M5 completado — **Atomicidad e interferencia**.

El simulador ya dispone de un lenguaje ejecutable, parser, procesos, estructuras de control, funciones, scheduling reproducible, memoria compartida, ejecución mediante microoperaciones, detección básica de interferencias y secciones `atomic`.

Actualmente el desarrollo avanza hacia **M6 — `await`**, siguiendo prioritariamente la semántica utilizada por la cátedra.

---

## ¿Qué permite hacer actualmente?

El usuario puede escribir pseudocódigo como:

```text
shared int x = 0;

process P1 {
    x = x + 1;
}

process P2 {
    x = x + 1;
}
```

y observar cómo una operación aparentemente simple puede descomponerse en acciones intercalables:

```text
P1 SHARED_READ  x = 0
P2 SHARED_READ  x = 0
P1 COMPUTE      result = 1
P2 COMPUTE      result = 1
P1 SHARED_WRITE x = 1
P2 SHARED_WRITE x = 1
```

El resultado puede ser:

```text
x = 1
```

reproduciendo un **lost update** a partir del interleaving real de los procesos.

El mismo programa puede protegerse mediante:

```text
atomic {
    x = x + 1;
}
```

Las microoperaciones siguen siendo visibles, pero otro proceso no puede intercalarse mientras la región atómica permanezca activa.

---

## Flujo de ejecución

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
Execution State
      ↓
┌───────────────┬─────────────────┐
│ Visualización │     Análisis    │
└───────────────┴─────────────────┘
```

La lógica del simulador vive en el motor y es independiente de React.

---

## Funcionalidades implementadas

### Lenguaje

- Variables locales y compartidas.
- `int`, `bool` y `string`.
- Arrays.
- Expresiones aritméticas, booleanas y comparaciones.
- Asignaciones.
- `if / else`.
- `while`.
- `repeat / until`.
- `for`.
- `foreach`.
- `break`.
- `continue`.
- Funciones y parámetros.
- Call stack.
- Llamadas a funciones dentro de expresiones.
- `return`.
- Evaluaciones suspendibles.
- `atomic`.

### Motor concurrente

- Procesos independientes.
- Estados `READY`, `RUNNING`, `BLOCKED` y `FINISHED`.
- Memoria local por proceso.
- Memoria compartida.
- Ejecución paso a paso.
- Scheduling **First Ready**.
- Scheduling **Round Robin**.
- Scheduling **Random** reproducible mediante seed.
- Microoperaciones intercalables.
- Captura de valores observados durante lecturas compartidas.
- Accesos a variables y elementos concretos de arrays mediante `MemoryLocation`.
- Resolución de índices compartidos en targets de arrays.
- Regiones atómicas anidables mediante `atomicDepth`.

### Visualización y análisis

- Estado de los procesos.
- Memoria local.
- Memoria compartida.
- Call stack.
- Historial de ejecución.
- Historial de microoperaciones.
- Lecturas y escrituras compartidas.
- Detección de accesos conflictivos.
- Clasificación `POTENTIAL_RACE`.
- Clasificación `SYNCHRONIZED`.
- Resumen de conflictos por ubicación de memoria.

---

## Ejemplo de atomicidad

Sin protección:

```text
shared int x = 0;

process P1 {
    x = x + 1;
}

process P2 {
    x = x + 1;
}
```

puede existir un interleaving que termine con:

```text
x = 1
```

Con protección:

```text
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

las microoperaciones de cada región no pueden intercalarse con las del otro proceso y el resultado esperado es:

```text
x = 2
```

---

## Arquitectura

El proyecto separa deliberadamente el motor de simulación de la interfaz:

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

Esto permite probar la semántica sin depender de React y deja preparado el motor para futuros mecanismos como semáforos, monitores y pasaje de mensajes.

Para más detalle:

**[Arquitectura completa](docs/ARCHITECTURE.md)**

---

## Principios del proyecto

### Un motor real, no animaciones prefabricadas

Productor/Consumidor, Lectores/Escritores, Filósofos, exclusión mutua y otros problemas clásicos deben poder expresarse como programas normales y ejecutarse mediante el mismo motor.

### Los errores deben emerger de la ejecución

Una race condition no debería aparecer porque la UI decidió mostrar una animación de una race condition.

Debe aparecer porque el scheduler produjo un interleaving válido que expuso el problema.

### Motor independiente de la UI

React visualiza el estado. La semántica vive en `core`.

### Ejecuciones reproducibles

Los escenarios aleatorios pueden utilizar una seed para volver a ejecutar exactamente un comportamiento interesante o problemático.

### Fidelidad académica

Las primitivas concurrentes se incorporan siguiendo prioritariamente la terminología y semántica utilizada por la cátedra de Programación Concurrente.

---

## Stack

| Tecnología | Uso |
| --- | --- |
| **React** | Interfaz y visualización |
| **TypeScript** | Lenguaje y motor de simulación |
| **Vite** | Desarrollo y build |
| **Vitest** | Tests automatizados |
| **ESLint** | Calidad y consistencia del código |
| **Git / GitHub** | Versionado y evolución del proyecto |

No se requiere backend para la versión actual.

---

## Ejecutar localmente

### Requisitos

- Node.js
- npm
- Git

### Instalación

```bash
git clone <URL-DEL-REPOSITORIO>
cd concurrent-visualizer
npm install
```

### Desarrollo

```bash
npm run dev
```

### Tests

```bash
npm test
```

### Lint

```bash
npm run lint
```

### Build

```bash
npm run build
```

---

## Documentación

La documentación forma parte del proyecto y se actualiza junto con el código.

| Documento | Contenido |
| --- | --- |
| **[BACKLOG.md](BACKLOG.md)** | Roadmap, milestones y tickets del proyecto |
| **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** | Arquitectura vigente y funcionamiento interno del motor |
| **[DECISIONS.md](docs/DECISIONS.md)** | Decisiones arquitectónicas y motivos detrás del diseño |
| **[PROGRESS.md](docs/PROGRESS.md)** | Historial de implementación y estado actual |
| **[SYNTAX.md](docs/SYNTAX.md)** | Sintaxis actualmente soportada por el lenguaje |

> Los enlaces anteriores asumen que `BACKLOG.md` está en la raíz del repositorio y el resto de los documentos se encuentra dentro de `docs/`.

---

## Roadmap

El desarrollo está organizado incrementalmente para que cada nueva primitiva se apoye sobre semántica ya probada.

```text
Lenguaje secuencial
        ↓
Scheduling
        ↓
Memoria compartida
        ↓
Microoperaciones
        ↓
Atomicidad
        ↓
await              ← próximo
        ↓
Semáforos P / V
        ↓
Monitores
        ↓
Pasaje de mensajes
        ↓
Análisis avanzado
```

### Próximo milestone — M6: `await`

El próximo objetivo es representar:

```text
<await (B); S>
```

La implementación debe cubrir, de acuerdo con la semántica utilizada por la cátedra:

- evaluación de la guarda `B`;
- bloqueo cuando la condición no permita progresar;
- reactivación de procesos;
- atomicidad correspondiente;
- visualización del estado de espera;
- ejercicios reales de la materia como tests.

El roadmap completo está en **[BACKLOG.md](BACKLOG.md)**.

---

## Objetivo a largo plazo

Concurrent Visualizer busca evolucionar desde un simulador paso a paso hacia una herramienta capaz de **explorar y explicar ejecuciones concurrentes**.

Entre los objetivos futuros se encuentran:

- `await`;
- semáforos `P` / `V`;
- monitores y variables condición;
- pasaje de mensajes;
- canales síncronos y asíncronos;
- deadlock detection;
- exploración de múltiples interleavings;
- reproducción de contraejemplos;
- problemas clásicos expresados directamente en el lenguaje;
- visualizaciones educativas de procesos, recursos y comunicación.

Una ejecución que termina correctamente no demuestra que un programa concurrente sea correcto. El objetivo final es que el simulador pueda ayudar a encontrar **la ejecución que demuestra que no lo es**.

---

## Regla de trabajo

Un ticket no se considera terminado solamente porque "parece funcionar".

Debe:

1. estar implementado;
2. estar verificado o testeado según corresponda;
3. mantener funcionando los tests existentes;
4. reflejarse en el backlog y el progreso;
5. actualizar arquitectura, decisiones o sintaxis cuando el cambio lo requiera.

---

## Contexto académico

Proyecto desarrollado como herramienta de aprendizaje para **Programación Concurrente — Facultad de Informática, UNLP**.

La arquitectura busca acompañar el avance de la materia: primero construir una base general y verificable, y luego incorporar cada mecanismo de concurrencia sobre ese mismo motor.
