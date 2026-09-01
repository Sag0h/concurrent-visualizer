# Concurrent Visualizer Language

## Versión

**Sintaxis V3**

Esta versión documenta las características actualmente soportadas por el
lenguaje y el motor al cierre de M6 y durante M7.5.

Además de la capa secuencial, `atomic`, `await` y semáforos, la sintaxis
incorpora colas FIFO primitivas locales y compartidas.

La sintaxis crecerá junto con el simulador. Las nuevas primitivas
concurrentes se incorporarán siguiendo prioritariamente la terminología
y semántica utilizada por la cátedra.

------------------------------------------------------------------------

## Programa

Un programa puede contener:

1.  variables compartidas;
2.  declaraciones de semáforos;
3.  definiciones de funciones;
4.  uno o más procesos.

Ejemplo:

``` text
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

``` text
shared int counter = 0;
shared bool active = true;
shared string message = "hello";
shared int[] values = [10, 20, 30];
```

Todos los procesos pueden leer y modificar estas variables.

Los accesos relevantes a memoria compartida pueden ser descompuestos
internamente por el motor en microoperaciones para permitir
interleavings.

Por ejemplo:

``` text
counter = counter + 1;
```

puede producir conceptualmente:

``` text
SHARED_READ counter
COMPUTE
SHARED_WRITE counter
```

------------------------------------------------------------------------

## Semáforos

Los semáforos se declaran en el nivel global mediante `sem`.

Sintaxis soportada:

``` text
sem mutex = 1;
sem available = 3;
sem event = 0;
```

La inicialización es obligatoria.

El valor inicial debe ser un **literal entero no negativo**.

Ejemplos válidos:

``` text
sem s0 = 0;
sem s1 = 1;
sem slots = 5;
```

Ejemplos no válidos:

``` text
sem missing;
sem negative = -1;
sem computed = 1 + 1;
```

Actualmente los semáforos son escalares. No se soportan todavía arrays
de semáforos.

Los semáforos no son variables compartidas ordinarias. No se leen ni
modifican mediante asignaciones como:

``` text
mutex = 0;   // no corresponde al modelo actual
```

Su estado se modifica mediante `P` y `V`.

### `P`

Sintaxis:

``` text
P(mutex);
```

`P` intenta adquirir una unidad del semáforo.

Si el valor es mayor que cero, la comprobación y el decremento se
realizan atómicamente y el proceso continúa.

Si el valor es cero, el proceso queda `BLOCKED` y permanece sobre la
misma instrucción `P` hasta poder volver a intentarla.

La reactivación no reserva el recurso: cuando el proceso sea
seleccionado por el scheduler, `P` se evalúa nuevamente.

### `V`

Sintaxis:

``` text
V(mutex);
```

`V` incrementa atómicamente el valor del semáforo y nunca bloquea.

Los semáforos generales no modelan ownership, por lo que el lenguaje no
exige que el proceso que ejecuta `V` sea el mismo que ejecutó
previamente `P`.

### Ejemplo de exclusión mutua

``` text
sem mutex = 1;
shared int x = 0;

process P1 {
    P(mutex);
    x = x + 1;
    V(mutex);
}

process P2 {
    P(mutex);
    x = x + 1;
    V(mutex);
}
```

No existe un tipo sintáctico especial de semáforo binario. Para V1 se
utilizan únicamente semáforos generales/contadores.

------------------------------------------------------------------------

## Variables locales

Las variables declaradas dentro de un proceso son locales a ese proceso.

``` text
process P1 {
    int value = 10;
    bool ready = true;
    string name = "worker";
}
```

Dos procesos pueden declarar una variable con el mismo nombre sin
compartirla.

``` text
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

``` text
int x = 10;
```

### bool

``` text
bool active = true;
bool finished = false;
```

### string

``` text
string message = "hello";
```

### arrays

``` text
int[] numbers = [10, 20, 30];
bool[] flags = [true, false];
string[] names = ["P1", "P2"];
```

Los arrays anidados no están soportados actualmente.

------------------------------------------------------------------------

## Asignaciones

``` text
x = 10;
x = x + 1;
counter = counter + 1;
```

Los nombres locales tienen prioridad sobre los nombres compartidos.

``` text
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

``` text
x = numbers[0];
x = numbers[i];
x = numbers[i + 1];
```

Escritura:

``` text
numbers[1] = 50;
numbers[i] = value;
numbers[i + offset] = value;
```

Los índices comienzan en cero.

Los índices pueden ser expresiones.

Cuando un target de un array compartido depende de variables
compartidas, las lecturas necesarias para resolver el índice forman
parte de la ejecución concurrente.

Por ejemplo:

``` text
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

## Colas FIFO

Las colas almacenan valores primitivos de un único tipo y pueden ser
locales o compartidas:

``` text
shared queue<int> trabajos = queue[10, 20];

process Worker {
    queue<string> mensajes = queue["inicio"];
}
```

Tipos de elemento disponibles:

``` text
queue<int>
queue<bool>
queue<string>
```

La notación `queue[...]` enumera los elementos desde el frente hacia el
fondo. Una cola vacía se declara con `queue[]`.

### `enqueue`

Inserta un valor al fondo:

``` text
trabajos.enqueue(30);
```

El valor debe coincidir con el tipo de elemento declarado.

### `dequeue`

Extrae y retorna el elemento del frente:

``` text
int trabajo = trabajos.dequeue();
trabajo = trabajos.dequeue();
```

### `front`

Retorna el elemento del frente sin extraerlo:

``` text
int siguiente = trabajos.front();
```

### `isEmpty`

Indica si la cola no contiene elementos:

``` text
bool vacia = trabajos.isEmpty();
```

### `size`

Retorna la cantidad actual de elementos sin modificar la cola:

``` text
int cantidad = trabajos.size();
```

En esta primera versión, los métodos que retornan valores deben aparecer
directamente a la derecha de una declaración o asignación **local**.
Todavía no se admiten como parte de expresiones compuestas, condiciones o
escrituras directas a otra variable compartida.

El argumento de `enqueue` puede usar literales y memoria local. Una
lectura compartida debe hacerse primero mediante una asignación normal y
después insertar el valor local, para que la lectura siga apareciendo en
las microoperaciones y el análisis de interferencia.

Cada método constituye una operación atómica de un step. Esto evita un
estado estructural intermedio de la cola, pero no vuelve atómica una
secuencia completa:

``` text
P(mutex);
bool vacia = trabajos.isEmpty();
int trabajo = trabajos.dequeue();
V(mutex);
```

El protocolo sigue siendo necesario cuando varias operaciones y
variables forman un mismo invariante. `dequeue()` y `front()` sobre una
cola vacía producen un error de runtime; no bloquean automáticamente.

### Colas de prioridad estables

Las colas de prioridad son una estructura separada. Cada elemento tiene
un valor primitivo y una prioridad entera:

``` text
shared priority_queue<string> fallos =
    priority_queue[("F1", 2), ("F2", 3)];

process Controlador {
    fallos.enqueue("F3", 3);
    string siguiente = fallos.dequeue();
}
```

El número más alto representa mayor prioridad. En el ejemplo, `F2` sale
antes que `F3`: ambos tienen prioridad `3`, pero `F2` fue insertado
primero. Por lo tanto, la estructura es estable y conserva FIFO entre
elementos empatados.

La declaración vacía es:

``` text
priority_queue<int> pendientes = priority_queue[];
```

Una inserción requiere valor y prioridad:

``` text
pendientes.enqueue(42, 5);
```

`dequeue`, `front`, `size` e `isEmpty` se utilizan igual que en una cola
FIFO y retornan el valor, no la prioridad. Todas las operaciones siguen
siendo atómicas individualmente y admiten las mismas restricciones sobre
resultados locales, llamadas a funciones y lecturas compartidas.

### Pilas

Las pilas almacenan valores primitivos en orden LIFO. La notación
literal enumera los elementos desde el fondo hacia la cima:

``` text
shared stack<int> valores = stack[10, 20];

process Worker {
    valores.push(30);
    int cima = valores.top();
    int extraido = valores.pop();
    int cantidad = valores.size();
    bool vacia = valores.isEmpty();
}
```

En este ejemplo, tanto `top()` como `pop()` retornan `30`, pero sólo
`pop()` lo elimina. Después de ambas operaciones, `20` vuelve a quedar en
la cima. Una pila vacía se declara con `stack[]`.

Las pilas pueden ser locales o compartidas. Cada método consume un step
atómico y sigue las mismas restricciones que las colas: los resultados
se escriben directamente en memoria local y `push` no admite llamadas a
funciones ni lecturas compartidas dentro de su argumento.

Las pilas de registros/objetos todavía no están soportadas.

------------------------------------------------------------------------

## Registros

Un registro agrupa campos primitivos relacionados bajo un tipo con
nombre. La definición debe aparecer antes de sus declaraciones:

``` text
record Fallo {
    int id;
    int nivel;
    string mensaje;
}

shared Fallo fallo = Fallo {
    id: 7,
    nivel: 3,
    mensaje: "temperatura"
};

process Controlador {
    int nivelAnterior = fallo.nivel;
    int id = fallo.getID();
    fallo.nivel = 2;
}
```

Los literales usan campos con nombre, pueden escribirlos en cualquier
orden y deben incluirlos exactamente una vez con el tipo declarado. Los
registros pueden ser locales o compartidos; actualmente sus campos sólo
pueden ser `int`, `bool` o `string`.

Cada campo compartido tiene granularidad propia para microoperaciones y
análisis. Por ejemplo, `fallo.id` y `fallo.nivel` son ubicaciones de
memoria diferentes.

Cada campo también expone automáticamente un getter sin argumentos. El
nombre comienza con `get` y se resuelve sin distinguir mayúsculas:

``` text
fallo.getNivel()  // equivale a leer fallo.nivel
fallo.getId()     // equivale a leer fallo.id
fallo.getID()     // también equivale a leer fallo.id
```

Un getter es sólo azúcar sintáctica para una lectura. No tiene cuerpo,
no modifica estado y, si el registro es compartido, conserva la
ubicación de memoria del campo en las microoperaciones y el análisis.
No acepta argumentos.

Todavía no se permiten registros dentro de arrays, colas o pilas. El
acceso puede ser directo mediante `fallo.nivel` o mediante su getter
automático.

------------------------------------------------------------------------

## Operaciones simuladas

`print(...)` representa una salida educativa observable sin escribir en
la consola real ni realizar I/O:

``` text
process Controlador {
    print("Fallo", fallo.getID(), fallo.getNivel());
}
```

Acepta cero o más expresiones. Sus valores se evalúan de izquierda a
derecha y quedan congelados en un evento `SIMULATED_OPERATION` del
historial. Si un argumento lee memoria compartida, esas lecturas siguen
apareciendo como microoperaciones y pueden intercalarse normalmente. La
emisión final es determinista y no modifica la memoria del programa.

Actualmente no se admiten llamadas a funciones definidas por el usuario
dentro de `print(...)`. Los getters de registros sí están admitidos
porque son lecturas de campos y no funciones suspendidas.

Un registro también puede recibir cualquier método simulado que no
comience con `get`:

``` text
fallo.procesar();
fallo.notificar("nivel crítico", fallo.getNivel());
```

Estos métodos no necesitan una declaración ni tienen cuerpo. El nombre
representa la acción educativa y el runtime valida que el receptor sea
un registro. El evento conserva el nombre y tipo del receptor, si era
local o compartido, y una copia de sus argumentos. No modifica campos.
Los nombres `getCampo()` están reservados para getters y deben usarse
dentro de una expresión o asignación.

------------------------------------------------------------------------

## Expresiones aritméticas

``` text
a + b
a - b
a * b
a / b
a % b
```

`%` calcula el resto de la división. Es útil para recorridos circulares,
por ejemplo:

``` text
next = (current + 1) % M;
```

`*`, `/` y `%` comparten nivel de precedencia y se evalúan de izquierda
a derecha. Los paréntesis pueden modificar la precedencia de cualquier
expresión aritmética:

``` text
result = (a + b) * 3;
position = (position + 1) % M;
```

El divisor de `/` y `%` debe ser distinto de cero. En recorridos como el
anterior esto implica la precondición `M > 0`.

También se soporta el menos unario:

``` text
-5
-x
-(x + 1)
```

`+` permite concatenar dos strings:

``` text
"hello " + "world"
```

Actualmente no existe conversión automática entre números y strings.

Esto no es válido:

``` text
"value: " + 10
```

------------------------------------------------------------------------

## Comparaciones

``` text
a == b
a != b
a < b
a <= b
a > b
a >= b
```

------------------------------------------------------------------------

## Expresiones booleanas

``` text
a && b
a || b
!a
```

Se pueden combinar expresiones mediante paréntesis:

``` text
(a < b) && active
!(finished || cancelled)
```

------------------------------------------------------------------------

## `if / else`

``` text
if (x > 0) {
    x = x - 1;
}
```

Con `else`:

``` text
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

``` text
while (x < 10) {
    x = x + 1;
}
```

La condición se vuelve a evaluar antes de cada iteración.

------------------------------------------------------------------------

## `repeat / until`

``` text
repeat {
    x = x + 1;
} until (x >= 10);
```

El cuerpo se ejecuta antes de evaluar la condición `until`.

------------------------------------------------------------------------

## `for`

Sintaxis soportada:

``` text
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

``` text
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

``` text
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

``` text
for (int i = 0; i < 10; i = i + 1) {
    if (i == 5) {
        continue;
    }

    sum = sum + i;
}
```

Su comportamiento depende del tipo de loop:

-   `while`: vuelve a evaluar la condición;
-   `repeat / until`: evalúa la condición `until`;
-   `for`: ejecuta el incremento y luego evalúa la condición;
-   `foreach`: avanza al siguiente elemento.

------------------------------------------------------------------------

## Funciones

Las funciones se definen fuera de los procesos.

Ejemplo:

``` text
function double(int value) {
    return value * 2;
}
```

Pueden recibir parámetros:

``` text
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

``` text
doWork();
```

También puede utilizarse dentro de una expresión:

``` text
int result = double(5);
int result = double(5) + 3;
int result = double(double(5));
int result = double(5) + double(10);
```

Los argumentos también pueden contener llamadas:

``` text
add(double(5), double(10));
```

Las llamadas dentro de expresiones no se ejecutan artificialmente como
una única operación atómica. El motor puede suspender la evaluación,
ejecutar la función durante múltiples steps y reanudar posteriormente la
expresión original.

------------------------------------------------------------------------

## `return`

Una función puede retornar sin valor:

``` text
return;
```

o retornar una expresión:

``` text
return x + 1;
```

También se permiten llamadas a funciones dentro de la expresión
retornada:

``` text
return double(x) + 1;
```

`return` puede aparecer dentro de estructuras de control anidadas. Al
ejecutarse, abandona los bloques internos hasta alcanzar la frontera de
la llamada actual.

------------------------------------------------------------------------

## Procesos

Los procesos se declaran utilizando `process`.

``` text
process P1 {
    int x = 0;
    x = x + 1;
}
```

También puede declararse una familia de procesos mediante un rango
inclusivo:

``` text
process Controlador[i:0..3] {
    int identificador = i;
}
```

El parser genera cuatro procesos independientes:

``` text
Controlador[0]
Controlador[1]
Controlador[2]
Controlador[3]
```

Cada proceso comienza con su propia variable local `i`. El rango también
puede ser descendente: `process Worker[i:3..0]` genera los índices `3`,
`2`, `1` y `0`. Los extremos negativos son válidos.

Para evitar expansiones accidentales que bloqueen el navegador, una sola
declaración puede generar como máximo 1000 procesos.

La expansión ocurre durante el parseo. Para el scheduler, los snapshots,
los forks y la exploración, cada instancia es un proceso ordinario y una
transición independiente.

Cada proceso mantiene su propio estado de ejecución, incluyendo:

-   memoria local;
-   program counter;
-   secuencia de instrucciones;
-   execution stack;
-   call stack;
-   evaluaciones suspendidas;
-   estado temporal de microoperaciones cuando corresponde;
-   profundidad de región atómica;
-   motivo de bloqueo cuando se encuentra en `BLOCKED`.

Estados posibles:

``` text
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

``` text
atomic {
    x = x + 1;
}
```

`atomic` impide que otro proceso intercale su ejecución mientras el
proceso actual permanezca dentro de la región.

Esto no significa que el cuerpo se convierta internamente en una única
microoperación.

Por ejemplo:

``` text
atomic {
    x = x + 1;
}
```

puede seguir produciendo conceptualmente:

``` text
SHARED_READ x
COMPUTE
SHARED_WRITE x
```

pero ningún otro proceso puede ejecutar una microoperación entre ellas.

### Regiones anidadas

Se soportan regiones `atomic` anidadas:

``` text
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

``` text
atomic {
}
```

### Protección de los accesos

Para que dos accesos conflictivos sean considerados protegidos por la
atomicidad explícita actual, ambos deben respetar el mecanismo.

Por ejemplo:

``` text
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

## `await`

`await` representa una acción atómica condicional.

Se soportan dos formas.

### Espera sin cuerpo

``` text
await (ready);
```

Equivale conceptualmente a esperar hasta que la condición pueda
cumplirse.

Si la condición es falsa:

-   el proceso pasa a `BLOCKED`;
-   el program counter permanece sobre el `await`;
-   la condición se conserva para futuras reevaluaciones.

Cuando la condición pasa a ser verdadera, el proceso puede volver a
`READY`, pero esto no garantiza que vaya a ejecutar inmediatamente.

Al ser seleccionado nuevamente, la guarda se reevalúa.

### Espera con cuerpo

``` text
await (x > 0) {
    x = x - 1;
}
```

Cuando la guarda es verdadera, la comprobación exitosa y el cuerpo
forman una acción atómica condicional.

Las microoperaciones internas del cuerpo pueden seguir siendo visibles
en el simulador, pero ningún otro proceso puede intercalarse durante esa
acción.

### Tipo de la guarda

La guarda debe producir un `bool`.

Ejemplos válidos:

``` text
await (ready);
await (x > 0);
await ((x > 0) && active);
```

Actualmente no se permiten llamadas a funciones dentro de una guarda:

``` text
await (isReady()); // no soportado actualmente
```

Tampoco se soporta por ahora `await` dentro de una región `atomic`.

Sí pueden existir regiones `atomic` dentro del cuerpo de un `await`
habilitado.

### Ejemplo de lock con `await`

``` text
shared bool lock = false;

process P1 {
    await (!lock) {
        lock = true;
    }

    // sección crítica

    lock = false;
}

process P2 {
    await (!lock) {
        lock = true;
    }

    // sección crítica

    lock = false;
}
```

------------------------------------------------------------------------

## Scheduling

El scheduler no se declara dentro del programa. Se selecciona desde la
interfaz del simulador.

Schedulers disponibles:

``` text
First Ready
Round Robin
Random
```

`Random` permite especificar una seed para reproducir una ejecución.

El scheduling puede ocurrir entre microoperaciones de una instrucción
cuando no existe una región de atomicidad activa que lo impida.

Los procesos `BLOCKED` no son seleccionables por el scheduler.

Cuando una condición de `await` o una operación `P` puede volver a
progresar, el proceso puede pasar a `READY`. Esa reactivación no reserva
una condición ni un recurso: `READY` solo significa que el proceso
vuelve a ser elegible.

------------------------------------------------------------------------

## Microoperaciones

Las microoperaciones no forman parte de la sintaxis que escribe el
usuario. Son una representación interna utilizada por el motor para
hacer visible la interferencia.

Los tipos utilizados actualmente para las operaciones relevantes
incluyen:

``` text
SHARED_READ
COMPUTE
SHARED_WRITE
```

Una instrucción fuente puede requerir varios steps para completarse.

Las lecturas compartidas capturan el valor observado en el momento del
acceso. Ese valor capturado se utiliza posteriormente aunque otro
proceso modifique la memoria antes de que termine la instrucción.

La interfaz permite observar el historial de estas operaciones y los
interleavings producidos por el scheduler.

------------------------------------------------------------------------

## Características todavía no disponibles

Las siguientes características forman parte del roadmap pero todavía no
están disponibles:

``` text
sleep
yield

arrays de semáforos

monitor
wait
signal
broadcast

channels
send
receive
sync_send
```

También permanecen fuera del alcance actual:

-   llamadas a funciones dentro de guardas de `await`;
-   `await` dentro de regiones `atomic`;
-   un tipo especial de semáforo binario;
-   fairness formal/FIFO para semáforos;
-   sintaxis especial como `i++`;
-   arrays anidados;
-   métodos de registro con comportamiento o parámetros;
-   métodos reales con cuerpo y estado interno propio;

Las colas FIFO primitivas, las colas de prioridad estables y las pilas ya
están implementadas bajo el mismo modelo general.

Los registros con campos primitivos, getters automáticos y `print(...)`
simulado ya están disponibles. Los objetos con comportamiento quedan
como mejora posterior.

Las primitivas posteriores se incorporarán incrementalmente y este
documento se actualizará cuando sean implementadas.
