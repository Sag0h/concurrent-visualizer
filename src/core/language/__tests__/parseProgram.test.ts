import { describe, expect, it } from 'vitest'
import { parseProgram } from '../parseProgram'

describe('parseProgram', () => {
  it('parses stable priority queues and their enqueue priority', () => {
    const program = parseProgram(`
      shared priority_queue<string> jobs =
        priority_queue[("low", 1), ("first-high", 3)];

      process Worker {
        jobs.enqueue("second-high", 3);
      }
    `)

    expect(program.sharedMemory.jobs).toEqual({
      kind: 'PRIORITY_QUEUE',
      elementType: 'string',
      items: [
        { value: 'first-high', priority: 3 },
        { value: 'low', priority: 1 },
      ],
    })
    expect(program.processes[0].instructions[0]).toMatchObject({
      type: 'QUEUE_OPERATION',
      operation: 'ENQUEUE',
      argument: {
        type: 'LITERAL',
        value: 'second-high',
      },
      priorityArgument: {
        type: 'LITERAL',
        value: 3,
      },
    })
  })

  it('parses shared and local FIFO queues', () => {
    const program = parseProgram(`
      shared queue<int> jobs = queue[10, 20];

      process Worker {
        queue<string> messages = queue["first"];
      }
    `)

    expect(program.sharedMemory.jobs).toEqual({
      kind: 'QUEUE',
      elementType: 'int',
      items: [10, 20],
    })

    expect(
      program.processes[0].instructions[0],
    ).toMatchObject({
      type: 'DECLARE',
      initialValue: {
        type: 'LITERAL',
        value: {
          kind: 'QUEUE',
          elementType: 'string',
          items: ['first'],
        },
      },
    })
  })

  it('parses queue operations and direct result assignments', () => {
    const program = parseProgram(`
      process Worker {
        queue<int> jobs = queue[1];
        jobs.enqueue(2);
        int first = jobs.front();
        first = jobs.dequeue();
        bool empty = jobs.isEmpty();
        int size = jobs.size();
      }
    `)

    expect(
      program.processes[0].instructions.slice(1),
    ).toMatchObject([
      {
        type: 'QUEUE_OPERATION',
        queueName: 'jobs',
        operation: 'ENQUEUE',
      },
      {
        type: 'QUEUE_OPERATION',
        operation: 'FRONT',
        resultTarget: {
          type: 'DECLARE',
          name: 'first',
        },
      },
      {
        type: 'QUEUE_OPERATION',
        operation: 'DEQUEUE',
        resultTarget: {
          type: 'ASSIGN',
        },
      },
      {
        type: 'QUEUE_OPERATION',
        operation: 'IS_EMPTY',
        resultTarget: {
          type: 'DECLARE',
          name: 'empty',
        },
      },
      {
        type: 'QUEUE_OPERATION',
        operation: 'SIZE',
        resultTarget: {
          type: 'DECLARE',
          name: 'size',
        },
      },
    ])
  })

  it('rejects queue literals with incompatible primitive values', () => {
    expect(() => parseProgram(`
      shared queue<int> jobs = queue[1, "wrong"];
      process Worker { }
    `)).toThrow(
      'Queue<int> item has the wrong type',
    )
  })

  it('requires scalar declarations for queue operation results', () => {
    expect(() => parseProgram(`
      process Worker {
        queue<int> jobs = queue[1];
        queue<int> invalid = jobs.dequeue();
      }
    `)).toThrow(
      'Queue operation results require a primitive scalar declaration',
    )
  })


  it('parses shared variables', () => {
    const program = parseProgram(`
      shared int counter = 0;
      shared bool active = true;
      shared string message = "hello";
    `)

    expect(program.sharedMemory).toEqual({
      counter: 0,
      active: true,
      message: 'hello',
    })
  })

  it('parses processes', () => {
    const program = parseProgram(`
      process P1 {
        int x = 10;
      }

      process P2 {
        int x = 20;
      }
    `)

    expect(
      program.processes.map(
        (process) => process.id,
      ),
    ).toEqual([
      'P1',
      'P2',
    ])
  })

  it('parses local declarations', () => {
    const program = parseProgram(`
      process P1 {
        int x = 10;
        bool active = true;
        string name = "worker";
      }
    `)

    expect(
      program.processes[0].instructions,
    ).toHaveLength(3)

    expect(
      program.processes[0].instructions[0],
    ).toMatchObject({
      type: 'DECLARE',
      scope: 'LOCAL',
      name: 'x',
    })
  })

  it('parses assignments', () => {
    const program = parseProgram(`
      process P1 {
        int x = 10;
        x = x + 5;
      }
    `)

    expect(
      program.processes[0].instructions[1],
    ).toMatchObject({
      type: 'ASSIGN',
      target: {
        type: 'VARIABLE',
        name: 'x',
      },
    })
  })

  it('parses array assignments', () => {
    const program = parseProgram(`
      process P1 {
        int[] numbers = [10, 20, 30];
        numbers[1] = 50;
      }
    `)

    expect(
      program.processes[0].instructions[1],
    ).toMatchObject({
      type: 'ASSIGN',
      target: {
        type: 'ARRAY_ACCESS',
        arrayName: 'numbers',
      },
    })
  })

  it('respects arithmetic precedence', () => {
    const program = parseProgram(`
      process P1 {
        int x = 0;
        x = 1 + 2 * 3;
      }
    `)

    const instruction =
      program.processes[0].instructions[1]

    expect(instruction.type).toBe('ASSIGN')

    if (instruction.type !== 'ASSIGN') {
      throw new Error(
        'Expected assignment instruction',
      )
    }

    expect(
      instruction.expression,
    ).toMatchObject({
      type: 'BINARY',
      operator: '+',
      right: {
        type: 'BINARY',
        operator: '*',
      },
    })
  })

  it('parses a complete executable program', () => {
    const program = parseProgram(`
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
    `)

    expect(
      program.processes,
    ).toHaveLength(2)

    expect(
      program.sharedMemory.counter,
    ).toBe(0)

    expect(
      program.processes[0].instructions,
    ).toHaveLength(3)

    expect(
      program.processes[1].instructions,
    ).toHaveLength(3)
  })

  it('throws useful syntax errors', () => {
    expect(() =>
      parseProgram(`
        process P1 {
          int x = ;
        }
      `),
    ).toThrow('Expected expression')
  })

  it('parses if and else blocks', () => {
    const program = parseProgram(`
      process P1 {
        int x = 10;

        if (x > 5) {
          x = 100;
        } else {
          x = 200;
        }
      }
    `)

    const instruction =
      program.processes[0].instructions[1]

    expect(instruction.type).toBe('IF')

    if (instruction.type !== 'IF') {
      throw new Error(
        'Expected IF instruction',
      )
    }

    expect(
      instruction.thenBranch,
    ).toHaveLength(1)

    expect(
      instruction.elseBranch,
    ).toHaveLength(1)
  })

  it('parses function calls as expressions', () => {
    const program = parseProgram(`
      function double(int value) {
        return value * 2;
      }

      process P1 {
        int result = double(5);
      }
    `)

    const instruction =
      program.processes[0].instructions[0]

    expect(instruction.type).toBe('DECLARE')

    if (instruction.type !== 'DECLARE') {
      throw new Error(
        'Expected DECLARE instruction',
      )
    }

    expect(
      instruction.initialValue,
    ).toMatchObject({
      type: 'FUNCTION_CALL',
      functionName: 'double',
      arguments: [
        {
          type: 'LITERAL',
          value: 5,
        },
      ],
    })
  })

  it('parses nested function call expressions', () => {
    const program = parseProgram(`
      function double(int value) {
        return value * 2;
      }

      process P1 {
        int result = double(double(5));
      }
    `)

    const instruction =
      program.processes[0].instructions[0]

    if (instruction.type !== 'DECLARE') {
      throw new Error(
        'Expected DECLARE instruction',
      )
    }

    expect(
      instruction.initialValue,
    ).toMatchObject({
      type: 'FUNCTION_CALL',
      functionName: 'double',
      arguments: [
        {
          type: 'FUNCTION_CALL',
          functionName: 'double',
        },
      ],
    })
  })

  it('parses atomic blocks', () => {
    const program = parseProgram(`
      shared int x = 0;

      process P1 {
        atomic {
          x = x + 1;
        }
      }
    `)

    expect(
      program.processes[0].instructions[0],
    ).toMatchObject({
      type: 'ATOMIC',
      body: [
        {
          type: 'ASSIGN',
        },
      ],
    })
  })

  it('parses await without a body', () => {
    const program = parseProgram(`
      shared bool ready = false;

      process P1 {
        await (ready);
      }
    `)

    expect(
      program.processes[0].instructions[0],
    ).toMatchObject({
      type: 'AWAIT',
      condition: {
        type: 'VARIABLE',
        name: 'ready',
      },
      body: [],
    })
  })

  it('parses await with a body', () => {
    const program = parseProgram(`
      shared bool lock = false;

      process P1 {
        await (!lock) {
          lock = true;
        }
      }
    `)

    expect(
      program.processes[0].instructions[0],
    ).toMatchObject({
      type: 'AWAIT',
      condition: {
        type: 'UNARY',
        operator: '!',
      },
      body: [
        {
          type: 'ASSIGN',
        },
      ],
    })
  })

  it('parses await with a compound condition', () => {
    const program = parseProgram(`
      shared bool in2 = false;
      shared int ultimo = 2;

      process P1 {
        await (!in2 || ultimo == 2);
      }
    `)

    const instruction =
      program.processes[0].instructions[0]

    expect(instruction.type).toBe('AWAIT')

    if (instruction.type !== 'AWAIT') {
      throw new Error(
        'Expected AWAIT instruction',
      )
    }

    expect(instruction.condition).toMatchObject({
      type: 'BINARY',
      operator: '||',
    })
  })

  it('throws when await is missing opening parenthesis', () => {
    expect(() =>
      parseProgram(`
        process P1 {
          await true;
        }
      `),
    ).toThrow('Expected "(" after "await"')
  })

  it('throws when await is missing closing parenthesis', () => {
    expect(() =>
      parseProgram(`
        shared bool ready = false;

        process P1 {
          await (ready;
        }
      `),
    ).toThrow('Expected ")" after await condition')
  })

  it('throws when await has neither body nor semicolon', () => {
    expect(() =>
      parseProgram(`
        shared bool ready = false;

        process P1 {
          await (ready)
          ready = true;
        }
      `),
    ).toThrow('Expected "{" before block')
  })

  it('parses semaphore declarations', () => {
    const program = parseProgram(`
      sem mutex = 1;
      sem available = 3;
    `)

    expect(program.semaphores).toEqual({
      mutex: {
        name: 'mutex',
        value: 1,
      },
      available: {
        name: 'available',
        value: 3,
      },
    })
  })

  it('parses semaphore P and V operations', () => {
    const program = parseProgram(`
      sem mutex = 1;

      process P1 {
        P(mutex);
        V(mutex);
      }
    `)

    expect(
      program.processes[0].instructions,
    ).toEqual([
      {
        type: 'SEMAPHORE_P',
        semaphoreName: 'mutex',
      },
      {
        type: 'SEMAPHORE_V',
        semaphoreName: 'mutex',
      },
    ])
  })

  it('throws when semaphore initialization is missing', () => {
    expect(() =>
      parseProgram(`
        sem mutex;
      `),
    ).toThrow(
      'Expected "=" after semaphore name',
    )
  })

  it('throws when semaphore initial value is negative', () => {
    expect(() =>
      parseProgram(`
        sem mutex = -1;
      `),
    ).toThrow(
      'Expected non-negative integer semaphore value',
    )
  })

  it('throws when semaphore initial value is not an integer literal', () => {
    expect(() =>
      parseProgram(`
        sem mutex = true;
      `),
    ).toThrow(
      'Expected non-negative integer semaphore value',
    )
  })

  it('throws when a semaphore is declared twice', () => {
    expect(() =>
      parseProgram(`
        sem mutex = 1;
        sem mutex = 2;
      `),
    ).toThrow(
      'Semaphore "mutex" is already defined',
    )
  })

})
