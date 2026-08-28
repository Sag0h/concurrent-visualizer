# Concurrent Visualizer Language

## Versión

**Sintaxis V1**

Esta versión documenta las características actualmente soportadas por el
lenguaje y el motor al cierre de M5.

La sintaxis crecerá junto con el simulador. Las primitivas concurrentes
posteriores se incorporarán siguiendo prioritariamente la terminología y
semántica utilizada por la cátedra.

------------------------------------------------------------------------

## Programa

Un programa puede contener:

1. variables compartidas;
2. definiciones de funciones;
3. uno o más procesos.

Ejemplo:

```text
shared int counter = 0;

function increment(int value) {
    return value + 1;
}

process P1 {
    int x = 10;
    x = increment(x);
    counter = counter + 1;
}

process P2 {
    int x = 20;
    x = increment(x);
    counter = counter + 1;
}
```

------------------------------------------------------------------------

## Variables compartidas

Las variables compartidas se declaran fuera de los procesos utilizando
`shared`.

```text
shared int counter = 0;
shared bool active = true;
shared string message = "hello";
shared int[] values = [10, 20, 30];
```

Todos los procesos pueden leer y modificar estas variables.

Los accesos relevantes a memoria compartida pueden ser descompuestos
internamente por el motor en microoperaciones para permitir interleavings.

Por ejemplo:

```text
counter = counter + 1;
```

puede producir conceptualmente:

```text
SHARED_READ counter
COMPUTE
SHARED_WRITE counter
```

------------------------------------------------------------------------

## Variables locales

Las variables declaradas dentro de un proceso son locales a ese proceso.

```text
process P1 {
    int value = 10;
    bool ready = true;
    string name = "worker";
}
```

Dos procesos pueden declarar una variable con el mismo nombre sin
compartirla.

```text
process P1 {
    int x = 10;
}

process P2 {
    int x = 20;
}
```

Las variables declaradas dentro de una función pertenecen al frame de
esa llamada y no son compartidas entre procesos ni entre invocaciones.

------------------------------------------------------------------------

## Tipos

### int

```text
int x = 10;
```

### bool

```text
bool active = true;
bool finished = false;
```

### string

```text
string message = "hello";
```

### arrays

```text
int[] numbers = [10, 20, 30];
bool[] flags = [true, false];
string[] names = ["P1", "P2"];
```

Los arrays anidados no están soportados actualmente.

------------------------------------------------------------------------

## Asignaciones

```text
x = 10;
x = x + 1;
counter = counter + 1;
```

Los nombres locales tienen prioridad sobre los nombres compartidos.

```text
shared int x = 100;

process P1 {
    int x = 5;
    x = 10;
}
```

En este caso la asignación modifica la variable local de `P1`.

------------------------------------------------------------------------

## Arrays

Lectura:

```text
x = numbers[0];
x = numbers[i];
x = numbers[i + 1];
```

Escritura:

```text
numbers[1] = 50;
numbers[i] = value;
numbers[i + offset] = value;
```

Los índices comienzan en cero.

Los índices pueden ser expresiones.

Cuando un target de un array compartido depende de variables compartidas,
las lecturas necesarias para resolver el índice forman parte de la
ejecución concurrente.

Por ejemplo:

```text
shared int i = 0;
shared int offset = 1;
shared int[] values = [0, 0, 0];

process P1 {
    values[i + offset] = 50;
}
```

El motor captura los valores observados durante las lecturas de `i` y
`offset`. La ubicación concreta de destino se determina utilizando esos
valores y no se modifica retroactivamente si otro proceso cambia las
variables antes del `WRITE`.

------------------------------------------------------------------------

## Expresiones aritméticas

```text
a + b
a - b
a * b
a / b
```

También se soporta el menos unario:

```text
-5
-x
-(x + 1)
```

`+` permite concatenar dos strings:

```text
"hello " + "world"
```

Actualmente no existe conversión automática entre números y strings.

Esto no es válido:

```text
"value: " + 10
```

------------------------------------------------------------------------

## Comparaciones

```text
a == b
a != b
a < b
a <= b
a > b
a >= b
```

------------------------------------------------------------------------

## Expresiones booleanas

```text
a && b
a || b
!a
```

Se pueden combinar expresiones mediante paréntesis:

```text
(a < b) && active
!(finished || cancelled)
```

------------------------------------------------------------------------

## `if / else`

```text
if (x > 0) {
    x = x - 1;
}
```

Con `else`:

```text
if (x > 0) {
    result = 1;
} else {
    result = 0;
}
```

Los bloques pueden contener otras estructuras de control, llamadas a
funciones y asignaciones.

------------------------------------------------------------------------

## `while`

```text
while (x < 10) {
    x = x + 1;
}
```

La condición se vuelve a evaluar antes de cada iteración.

------------------------------------------------------------------------

## `repeat / until`

```text
repeat {
    x = x + 1;
} until (x >= 10);
```

El cuerpo se ejecuta antes de evaluar la condición `until`.

------------------------------------------------------------------------

## `for`

Sintaxis soportada:

```text
for (int i = 0; i < 10; i = i + 1) {
    sum = sum + i;
}
```

Actualmente no existe una sintaxis especial `i++`. El incremento se
expresa mediante una asignación normal.

`continue` dentro de un `for` ejecuta el incremento antes de volver a
evaluar la condición.

------------------------------------------------------------------------

## `foreach`

Sintaxis:

```text
foreach (item in values) {
    sum = sum + item;
}
```

La variable utilizada para cada elemento es local al contexto de
ejecución correspondiente.

La expresión que produce la colección puede incluir llamadas a
funciones.

------------------------------------------------------------------------

## `break`

`break` termina el loop más cercano.

```text
while (true) {
    if (x >= 10) {
        break;
    }

    x = x + 1;
}
```

Funciona dentro de estructuras de control anidadas.

------------------------------------------------------------------------

## `continue`

`continue` continúa con la siguiente iteración del loop más cercano.

```text
for (int i = 0; i < 10; i = i + 1) {
    if (i == 5) {
        continue;
    }

    sum = sum + i;
}
```

Su comportamiento depende del tipo de loop:

- `while`: vuelve a evaluar la condición;
- `repeat / until`: evalúa la condición `until`;
- `for`: ejecuta el incremento y luego evalúa la condición;
- `foreach`: avanza al siguiente elemento.

------------------------------------------------------------------------

## Funciones

Las funciones se definen fuera de los procesos.

Ejemplo:

```text
function double(int value) {
    return value * 2;
}
```

Pueden recibir parámetros:

```text
function add(int a, int b) {
    return a + b;
}
```

Cada llamada crea su propio frame de ejecución con memoria local
independiente.

Distintos procesos pueden llamar a la misma función sin compartir sus
variables temporales.

Las funciones pueden ser vacías y también pueden contener estructuras de
control y llamadas a otras funciones.

------------------------------------------------------------------------

## Llamadas a funciones

Una función puede invocarse como instrucción:

```text
doWork();
```

También puede utilizarse dentro de una expresión:

```text
int result = double(5);
int result = double(5) + 3;
int result = double(double(5));
int result = double(5) + double(10);
```

Los argumentos también pueden contener llamadas:

```text
add(double(5), double(10));
```

Las llamadas dentro de expresiones no se ejecutan artificialmente como
una única operación atómica. El motor puede suspender la evaluación,
ejecutar la función durante múltiples steps y reanudar posteriormente la
expresión original.

------------------------------------------------------------------------

## `return`

Una función puede retornar sin valor:

```text
return;
```

o retornar una expresión:

```text
return x + 1;
```

También se permiten llamadas a funciones dentro de la expresión
retornada:

```text
return double(x) + 1;
```

`return` puede aparecer dentro de estructuras de control anidadas. Al
ejecutarse, abandona los bloques internos hasta alcanzar la frontera de
la llamada actual.

------------------------------------------------------------------------

## Procesos

Los procesos se declaran utilizando `process`.

```text
process P1 {
    int x = 0;
    x = x + 1;
}
```

Cada proceso mantiene su propio estado de ejecución, incluyendo:

- memoria local;
- program counter;
- secuencia de instrucciones;
- execution stack;
- call stack;
- evaluaciones suspendidas;
- estado temporal de microoperaciones cuando corresponde;
- profundidad de región atómica.

Estados posibles:

```text
READY
RUNNING
BLOCKED
FINISHED
```

No es necesario escribir una instrucción explícita de finalización.
Cuando un proceso consume todas sus instrucciones pasa automáticamente a
`FINISHED`.

------------------------------------------------------------------------

## `atomic`

Una región atómica se declara mediante:

```text
atomic {
    x = x + 1;
}
```

`atomic` impide que otro proceso intercale su ejecución mientras el
proceso actual permanezca dentro de la región.

Esto no significa que el cuerpo se convierta internamente en una única
microoperación.

Por ejemplo:

```text
atomic {
    x = x + 1;
}
```

puede seguir produciendo conceptualmente:

```text
SHARED_READ x
COMPUTE
SHARED_WRITE x
```

pero ningún otro proceso puede ejecutar una microoperación entre ellas.

### Regiones anidadas

Se soportan regiones `atomic` anidadas:

```text
atomic {
    atomic {
        x = x + 1;
    }
}
```

El proceso conserva la atomicidad hasta abandonar la región exterior.

### Control de flujo

`break`, `continue` y `return` pueden abandonar estructuras que se
encuentren dentro de una región atómica.

El runtime libera correctamente las regiones atómicas abandonadas
durante estos cambios de flujo.

También se permiten regiones vacías:

```text
atomic {
}
```

### Protección de los accesos

Para que dos accesos conflictivos sean considerados protegidos por la
atomicidad explícita actual, ambos deben respetar el mecanismo.

Por ejemplo:

```text
shared int x = 0;

process P1 {
    atomic {
        x = x + 1;
    }
}

process P2 {
    x = x + 1;
}
```

no garantiza exclusión mutua, porque `P2` continúa accediendo a `x`
fuera de la región protegida.

------------------------------------------------------------------------

## Scheduling

El scheduler no se declara dentro del programa. Se selecciona desde la
interfaz del simulador.

Schedulers disponibles:

```text
First Ready
Round Robin
Random
```

`Random` permite especificar una seed para reproducir una ejecución.

El scheduling puede ocurrir entre microoperaciones de una instrucción
cuando no existe una región `atomic` activa que lo impida.

------------------------------------------------------------------------

## Microoperaciones

Las microoperaciones no forman parte de la sintaxis que escribe el
usuario. Son una representación interna utilizada por el motor para
hacer visible la interferencia.

Los tipos utilizados actualmente para las operaciones relevantes
incluyen:

```text
SHARED_READ
COMPUTE
SHARED_WRITE
```

Una instrucción fuente puede requerir varios steps para completarse.

Las lecturas compartidas capturan el valor observado en el momento del
acceso. Ese valor capturado se utiliza posteriormente aunque otro proceso
modifique la memoria antes de que termine la instrucción.

La interfaz permite observar el historial de estas operaciones y los
interleavings producidos por el scheduler.

------------------------------------------------------------------------

## Características todavía no disponibles en la Sintaxis V1

Las siguientes características forman parte del roadmap pero todavía no
están disponibles:

```text
sleep
yield

await

sem
P
V

monitor
wait
signal
broadcast

channels
send
receive
sync_send
```

`await` es la próxima extensión prevista.

Su sintaxis y semántica definitiva se documentarán después de verificar
el comportamiento requerido por el material actual de la cátedra.

Las primitivas posteriores se incorporarán incrementalmente y este
documento se actualizará cuando sean implementadas.
