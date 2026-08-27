import { describe, expect, it } from 'vitest'
import { parseProgram } from '../parseProgram'

describe('parseProgram', () => {
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
})
