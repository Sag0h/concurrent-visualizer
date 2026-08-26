# Concurrent Visualizer

Simulador educativo de programación concurrente orientado a visualizar
la ejecución de procesos, mecanismos de sincronización, interleavings y
errores clásicos de concurrencia.

El proyecto nace como herramienta de estudio para Programación
Concurrente de la Facultad de Informática de la UNLP, pero se diseña
como un motor general de pseudocódigo concurrente.

## Estado

Proyecto en etapa inicial de diseño y construcción del motor.

## Objetivo

La experiencia final buscada es:

``` text
Pseudocódigo
    ↓
Parser
    ↓
AST
    ↓
Simulation Engine
    ↓
Estado de ejecución
    ├── Visualización
    └── Análisis
```

El usuario debería poder escribir un programa concurrente, ejecutarlo
paso a paso, observar procesos y recursos, cambiar el scheduling y
explorar ejecuciones problemáticas.

## Funcionalidades objetivo

-   Procesos concurrentes.
-   Estados `READY`, `RUNNING`, `BLOCKED`, `FINISHED`.
-   Scheduling e interleavings.
-   Variables locales y memoria compartida.
-   Estructuras de control convencionales.
-   Funciones.
-   Atomicidad.
-   `await`.
-   Semáforos.
-   Monitores.
-   Pasaje de mensajes.
-   Ejecución paso a paso.
-   Timeline e historial.
-   Detección de deadlocks y otros errores.
-   Exploración de ejecuciones y reproducción de contraejemplos.

## Principios

### Un motor real, no animaciones prefabricadas

Los problemas clásicos deben expresarse como programas y ejecutarse
mediante el mismo motor.

### Motor independiente de la UI

La lógica de simulación vive fuera de React.

### Aprender construyendo

Las funcionalidades se incorporarán siguiendo los conceptos estudiados
en la materia.

### Fidelidad académica

Las primitivas concurrentes deben respetar prioritariamente la
terminología y semántica utilizada por la cátedra.

## Stack

-   React
-   TypeScript
-   Vite
-   ESLint

Previstos cuando sean necesarios:

-   Tailwind CSS
-   React Flow

## Desarrollo

``` bash
npm install
npm run dev
```

## Documentación

-   `BACKLOG.md`: roadmap, milestones y tickets.
-   `docs/ARCHITECTURE.md`: arquitectura vigente.
-   `docs/DECISIONS.md`: decisiones importantes y sus motivos.
-   `docs/PROGRESS.md`: diario breve para retomar el desarrollo.

## Regla de trabajo

Un ticket no se considera terminado únicamente porque "parece
funcionar".

Debe:

1.  estar implementado;
2.  estar verificado/testeado según corresponda;
3.  mantener los tests existentes funcionando;
4.  reflejarse en el backlog y progreso;
5.  actualizar arquitectura/decisiones cuando corresponda.

## Roadmap

Consultar [`BACKLOG.md`](BACKLOG.md) para el roadmap completo.
