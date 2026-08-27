import { describe, expect, it } from 'vitest'
import type { Expression } from '../Expression'
import { evaluateExpression } from '../evaluateExpression'
import {
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
})
