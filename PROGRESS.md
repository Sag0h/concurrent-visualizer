# Concurrent Visualizer --- Progreso

> Diario breve para poder retomar el proyecto después de una pausa o
> desde otro contexto.

## Estado actual

**Fase:** M0 --- Base del proyecto.

**Próximo objetivo:** terminar la limpieza y estructura inicial antes de
comenzar `Process`.

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

### Pendiente inmediato

1.  Renombrar rama `master` a `main`.
2.  Configurar `main` como rama predeterminada de Git.
3.  Copiar esta documentación al repositorio.
4.  Limpiar el contenido demo de Vite.
5.  Crear estructura inicial de `src/`.
6.  Commit de estructura/documentación.
7.  Comenzar M1 definiendo `ProcessId` y los estados de proceso.

### Comandos previstos

``` bash
git branch -m main
git config --global init.defaultBranch main
```

### Nota para retomar

Antes de continuar después de una pausa:

1.  Leer `BACKLOG.md`.
2.  Leer este archivo desde la entrada más reciente.
3.  Revisar `docs/DECISIONS.md`.
4.  Consultar `docs/ARCHITECTURE.md` para conocer la arquitectura
    vigente.
5.  Ejecutar los tests existentes.
6.  Continuar únicamente desde el próximo ticket pendiente.
