# Monitor runtime

El runtime soporta estado privado y procedures con parámetros `in/out`.
`MonitorDefinition` es código inmutable y
`ExecutionState.monitorStates` conserva la instancia mutable.

Un `MonitorCallFrame` contiene la memoria activa del procedure. Sólo las
variables declaradas como estado del monitor se sincronizan con la
instancia; las variables locales desaparecen al terminar. El frame de
ejecución `MONITOR_RETURN` libera la propiedad antes de avanzar la llamada
del proceso.

`MonitorEntryRequest` captura una vez los valores `in` y los destinos
locales `out` antes de competir por la instancia. Si la entrada bloquea, el
request permanece en el proceso. Al entrar, cada `out` comienza con un
centinela no legible. Al retornar se exige que todos tengan un valor válido,
se realiza el write-back sobre el frame llamador capturado y recién después
se libera la propiedad.

El próximo paso son las variables condición con semántica
signal-and-continue.
