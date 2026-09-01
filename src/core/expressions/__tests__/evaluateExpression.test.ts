import { describe, expect, it } from 'vitest'
import type { Expression } from '../Expression'
import { evaluateExpression } from '../evaluateExpression'
import {
  arrayAccess,
  binary,
  literal,
  unary,
  variable,
} from '../expressionFactories'

describe('evaluateExpression', () => {
  it('evaluates literal values', () => {
    const expression: Expression = {
      type: 'LITERAL',
      value: 10,
    }

    expect(
      evaluateExpression(expression, {
        localMemory: {},
        sharedMemory: {},
      }),
    ).toBe(10)
  })

  it('reads variables from local memory', () => {
    const expression: Expression = {
      type: 'VARIABLE',
      name: 'x',
    }

    expect(
      evaluateExpression(expression, {
        localMemory: {
          x: 5,
        },
        sharedMemory: {},
      }),
    ).toBe(5)
  })

  it('reads variables from shared memory', () => {
    const expression: Expression = {
      type: 'VARIABLE',
      name: 'x',
    }

    expect(
      evaluateExpression(expression, {
        localMemory: {},
        sharedMemory: {
          x: 8,
        },
      }),
    ).toBe(8)
  })

  it('prefers local memory when both scopes contain the same variable', () => {
    const expression: Expression = {
      type: 'VARIABLE',
      name: 'x',
    }

    expect(
      evaluateExpression(expression, {
        localMemory: {
          x: 3,
        },
        sharedMemory: {
          x: 100,
        },
      }),
    ).toBe(3)
  })

  it('evaluates arithmetic expressions', () => {
    const expression: Expression = {
      type: 'BINARY',
      operator: '+',
      left: {
        type: 'VARIABLE',
        name: 'x',
      },
      right: {
        type: 'LITERAL',
        value: 2,
      },
    }

    expect(
      evaluateExpression(expression, {
        localMemory: {
          x: 5,
        },
        sharedMemory: {},
      }),
    ).toBe(7)
  })

  it('evaluates modulo expressions', () => {
    const expression = binary(
      '%',
      binary(
        '+',
        literal(5),
        literal(2),
      ),
      literal(4),
    )

    expect(
      evaluateExpression(expression, {
        localMemory: {},
        sharedMemory: {},
      }),
    ).toBe(3)
  })

  it('evaluates comparison expressions', () => {
    const expression: Expression = {
      type: 'BINARY',
      operator: '<',
      left: {
        type: 'VARIABLE',
        name: 'x',
      },
      right: {
        type: 'LITERAL',
        value: 10,
      },
    }

    expect(
      evaluateExpression(expression, {
        localMemory: {
          x: 5,
        },
        sharedMemory: {},
      }),
    ).toBe(true)
  })

  it('evaluates boolean expressions', () => {
    const expression: Expression = {
      type: 'BINARY',
      operator: '&&',
      left: {
        type: 'LITERAL',
        value: true,
      },
      right: {
        type: 'LITERAL',
        value: false,
      },
    }

    expect(
      evaluateExpression(expression, {
        localMemory: {},
        sharedMemory: {},
      }),
    ).toBe(false)
  })

  it('throws when reading an undefined variable', () => {
    const expression: Expression = {
      type: 'VARIABLE',
      name: 'missing',
    }

    expect(() =>
      evaluateExpression(expression, {
        localMemory: {},
        sharedMemory: {},
      }),
    ).toThrow('Variable "missing" is not defined')
  })

  it('evaluates unary boolean negation', () => {
    const expression = unary(
      '!',
      variable('active'),
    )

    expect(
      evaluateExpression(expression, {
        localMemory: {
          active: true,
        },
        sharedMemory: {},
      }),
    ).toBe(false)
  })

  it('evaluates nested expressions', () => {
    const expression = binary(
      '>',
      binary(
        '+',
        variable('x'),
        literal(5),
      ),
      literal(10),
    )

    expect(
      evaluateExpression(expression, {
        localMemory: {
          x: 8,
        },
        sharedMemory: {},
      }),
    ).toBe(true)
  })

  it('reads a value from an array', () => {
    const expression = arrayAccess(
      variable('numbers'),
      literal(1),
    )

    expect(
      evaluateExpression(expression, {
        localMemory: {
          numbers: [10, 20, 30],
        },
        sharedMemory: {},
      }),
    ).toBe(20)
  })

  it('reads an array using a variable as index', () => {
    const expression = arrayAccess(
      variable('numbers'),
      variable('i'),
    )

    expect(
      evaluateExpression(expression, {
        localMemory: {
          numbers: [10, 20, 30],
          i: 2,
        },
        sharedMemory: {},
      }),
    ).toBe(30)
  })

  it('throws when an array index is out of bounds', () => {
    const expression = arrayAccess(
      variable('numbers'),
      literal(10),
    )

    expect(() =>
      evaluateExpression(expression, {
        localMemory: {
          numbers: [10, 20, 30],
        },
        sharedMemory: {},
      }),
    ).toThrow('Array index 10 is out of bounds')
  })

  it('evaluates string literals', () => {
    expect(
      evaluateExpression(
        literal('hello'),
        {
          localMemory: {},
          sharedMemory: {},
        },
      ),
    ).toBe('hello')
  })

  it('concatenates strings with the plus operator', () => {
    const expression = binary(
      '+',
      literal('Hello '),
      literal('world'),
    )

    expect(
      evaluateExpression(expression, {
        localMemory: {},
        sharedMemory: {},
      }),
    ).toBe('Hello world')
  })

  it('does not mix strings and numbers with plus', () => {
    const expression = binary(
      '+',
      literal('value: '),
      literal(10),
    )

    expect(() =>
      evaluateExpression(expression, {
        localMemory: {},
        sharedMemory: {},
      }),
    ).toThrow(
      'Operator "+" requires two numbers or two strings',
    )
  })
})
