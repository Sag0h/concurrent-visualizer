# Monitor runtime

La primera vertical ejecutable soporta estado privado y procedures sin
parámetros. `MonitorDefinition` es código inmutable y
`ExecutionState.monitorStates` conserva la instancia mutable.

Un `MonitorCallFrame` contiene la memoria activa del procedure. Sólo las
variables declaradas como estado del monitor se sincronizan con la
instancia; las variables locales desaparecen al terminar. El frame de
ejecución `MONITOR_RETURN` libera la propiedad antes de avanzar la llamada
del proceso.

Los próximos pasos son parámetros `in/out` y variables condición con
semántica signal-and-continue.
