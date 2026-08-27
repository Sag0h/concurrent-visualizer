# Concurrent Visualizer Language

## Versión

**Sintaxis V0**

Esta versión contiene únicamente las características actualmente
soportadas por el motor. La sintaxis crecerá junto con el simulador.

------------------------------------------------------------------------

## Programa

Un programa puede contener:

1.  Variables compartidas.
2.  Uno o más procesos.

``` text
shared int counter = 0;

process P1 {
    int x = 10;

    x = x + 1;
    counter = counter + 1;
}

process P2 {
    int x = 20;

    x = x + 5;
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
```

Todos los procesos pueden leer y modificar estas variables.

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
```

Escritura:

``` text
numbers[1] = 50;
numbers[i] = value;
```

Los índices comienzan en cero.

------------------------------------------------------------------------

## Expresiones aritméticas

``` text
a + b
a - b
a * b
a / b
```

`+` también permite concatenar dos strings:

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

------------------------------------------------------------------------

## Procesos

Los procesos se declaran utilizando `process`.

``` text
process P1 {
    int x = 0;
    x = x + 1;
}
```

Cada proceso tiene:

-   memoria local;
-   program counter;
-   estado de ejecución;
-   secuencia de instrucciones.

Estados posibles:

``` text
READY
RUNNING
BLOCKED
FINISHED
```

En V0 no es necesario escribir una instrucción explícita de
finalización. Cuando un proceso consume todas sus instrucciones pasa
automáticamente a `FINISHED`.

------------------------------------------------------------------------

## Scheduling

El scheduler no se declara dentro del programa. Se selecciona desde la
interfaz del simulador.

Schedulers inicialmente disponibles:

``` text
First Ready
Round Robin
Random
```

`Random` permite especificar una seed para reproducir exactamente una
ejecución.

------------------------------------------------------------------------

## Características todavía no disponibles en la sintaxis V0

Estas características forman parte del roadmap pero todavía no están
disponibles:

``` text
if
else
while
repeat / until
for
foreach
break
continue

functions
return
sleep
yield

atomic
await

sem
P
V

monitor
wait
signal

channels
send
receive
sync_send
```

Se incorporarán de forma incremental y se documentarán en este archivo
cuando sean implementadas.
