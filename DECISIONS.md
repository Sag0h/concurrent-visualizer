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

**Motivo:** primero necesitamos comprender y estabilizar la semántica de
procesos, instrucciones y scheduling. Inicialmente los programas se
representarán mediante objetos TypeScript.

El parser se agregará cuando el motor sea funcional.

------------------------------------------------------------------------

## ADR-008 --- Lenguaje secuencial suficientemente expresivo

**Estado:** Aceptada

**Decisión:** el lenguaje deberá soportar estructuras secuenciales
convencionales además de primitivas concurrentes.

Previstas:

-   `if / else`;
-   `while`;
-   `repeat / until`;
-   `for`;
-   `foreach`;
-   `break`;
-   `continue`;
-   funciones;
-   `return`;
-   funciones vacías;
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

**Mecanismo previsto:** scheduler pseudoaleatorio con seed + historial
de decisiones.

**Motivo:** un error encontrado debe poder estudiarse y mostrarse
nuevamente.

------------------------------------------------------------------------

## ADR-012 --- Material de la cátedra como referencia semántica

**Estado:** Aceptada

**Decisión:** para primitivas y conceptos de concurrencia se priorizará
la terminología y semántica del material oficial de la cursada actual.

El material histórico de la UNLP se utilizará para anticipar temas y
planificar extensibilidad, pero no para asumir sin verificación que la
semántica de 2026 es idéntica a la de años anteriores.
