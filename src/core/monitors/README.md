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

Cada condición mantiene una cola FIFO propia. `wait` guarda el frame activo,
encola al proceso, libera la instancia y deja la instrucción pendiente.
`signal` mueve al primer esperador a `entryContenderProcessIds` y
`signal_all` mueve a todos; una cola vacía no conserva la señal. El señalador
continúa como propietario.

Un proceso despertado conserva `MONITOR_CONDITION` con fase `REACQUIRE` hasta
volver a adquirir la instancia. En ese momento el runtime refresca únicamente
el estado privado dentro de su frame suspendido: parámetros, variables locales
y bindings `out` sobreviven, pero el proceso observa las modificaciones hechas
por el señalador antes de continuar después de `wait`.

Las colas, fases y competidores forman parte de snapshots, forks, claves
semánticas y Step Back. El diagnóstico representa una espera no señalada como
recurso `CONDITION`; la UI expone las colas y eventos de condición.

Las condiciones son escalares. Arrays de condiciones y operaciones de consulta
quedan como extensiones futuras.
