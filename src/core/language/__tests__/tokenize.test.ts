import { describe, expect, it } from 'vitest'
import { tokenize } from '../tokenize'

describe('tokenize', () => {
  it('tokenizes queue types, literals and method calls', () => {
    const tokens = tokenize(
      'shared queue<int> jobs = queue[1]; jobs.enqueue(2);',
    )

    expect(
      tokens.map((token) => token.type),
    ).toEqual([
      'SHARED',
      'QUEUE',
      'LESS',
      'INT',
      'GREATER',
      'IDENTIFIER',
      'ASSIGN',
      'QUEUE',
      'LEFT_BRACKET',
      'NUMBER',
      'RIGHT_BRACKET',
      'SEMICOLON',
      'IDENTIFIER',
      'DOT',
      'IDENTIFIER',
      'LEFT_PAREN',
      'NUMBER',
      'RIGHT_PAREN',
      'SEMICOLON',
      'EOF',
    ])
  })

  it('tokenizes a shared variable declaration', () => {
    const tokens = tokenize(
      'shared int counter = 0;',
    )

    expect(
      tokens.map((token) => token.type),
    ).toEqual([
      'SHARED',
      'INT',
      'IDENTIFIER',
      'ASSIGN',
      'NUMBER',
      'SEMICOLON',
      'EOF',
    ])
  })

  it('tokenizes a process declaration', () => {
    const tokens = tokenize(`
      process P1 {
        int x = 10;
      }
    `)

    expect(
      tokens.map((token) => token.type),
    ).toEqual([
      'PROCESS',
      'IDENTIFIER',
      'LEFT_BRACE',
      'INT',
      'IDENTIFIER',
      'ASSIGN',
      'NUMBER',
      'SEMICOLON',
      'RIGHT_BRACE',
      'EOF',
    ])
  })

  it('tokenizes boolean and string literals', () => {
    const tokens = tokenize(`
      bool active = true;
      string message = "hello";
    `)

    expect(
      tokens
        .filter(
          (token) =>
            token.type === 'BOOLEAN'
            || token.type === 'STRING',
        )
        .map((token) => token.lexeme),
    ).toEqual([
      'true',
      'hello',
    ])
  })

  it('tokenizes operators', () => {
    const tokens = tokenize(
      'a == b && c != d || x <= y;',
    )

    expect(
      tokens.map((token) => token.type),
    ).toContain('EQUAL_EQUAL')

    expect(
      tokens.map((token) => token.type),
    ).toContain('AND')

    expect(
      tokens.map((token) => token.type),
    ).toContain('NOT_EQUAL')

    expect(
      tokens.map((token) => token.type),
    ).toContain('OR')

    expect(
      tokens.map((token) => token.type),
    ).toContain('LESS_EQUAL')
  })

  it('tokenizes array syntax', () => {
    const tokens = tokenize(
      'int[] values = [10, 20, 30];',
    )

    expect(
      tokens.map((token) => token.type),
    ).toEqual([
      'INT',
      'LEFT_BRACKET',
      'RIGHT_BRACKET',
      'IDENTIFIER',
      'ASSIGN',
      'LEFT_BRACKET',
      'NUMBER',
      'COMMA',
      'NUMBER',
      'COMMA',
      'NUMBER',
      'RIGHT_BRACKET',
      'SEMICOLON',
      'EOF',
    ])
  })

  it('ignores single-line comments', () => {
    const tokens = tokenize(`
      // shared counter
      shared int counter = 0;
    `)

    expect(
      tokens.map((token) => token.type),
    ).toEqual([
      'SHARED',
      'INT',
      'IDENTIFIER',
      'ASSIGN',
      'NUMBER',
      'SEMICOLON',
      'EOF',
    ])
  })

  it('keeps line and column information', () => {
    const tokens = tokenize(
      'shared int counter = 0;',
    )

    expect(tokens[0]).toMatchObject({
      type: 'SHARED',
      line: 1,
      column: 1,
    })

    expect(tokens[1]).toMatchObject({
      type: 'INT',
      line: 1,
      column: 8,
    })
  })

  it('throws when a string is not terminated', () => {
    expect(() =>
      tokenize(
        'string message = "hello;',
      ),
    ).toThrow('Unterminated string')
  })

  it('tokenizes atomic as a keyword', () => {
    const tokens = tokenize(`
      atomic {
      }
    `)

    expect(tokens[0].type).toBe('ATOMIC')
  })

  it('tokenizes await as a keyword', () => {
    const tokens = tokenize(`
      await (ready);
    `)

    expect(
      tokens.map((token) => token.type),
    ).toEqual([
      'AWAIT',
      'LEFT_PAREN',
      'IDENTIFIER',
      'RIGHT_PAREN',
      'SEMICOLON',
      'EOF',
    ])
  })

  it('keeps await line and column information', () => {
    const tokens = tokenize(
      'await (ready);',
    )

    expect(tokens[0]).toMatchObject({
      type: 'AWAIT',
      lexeme: 'await',
      line: 1,
      column: 1,
    })
  })

  it('tokenizes semaphore declarations', () => {
  const tokens = tokenize(
    'sem mutex = 1;',
  )

  expect(
    tokens.map((token) => token.type),
  ).toEqual([
    'SEM',
    'IDENTIFIER',
    'ASSIGN',
    'NUMBER',
    'SEMICOLON',
    'EOF',
  ])
})

  it('tokenizes semaphore operations', () => {
    const tokens = tokenize(`
      P(mutex);
      V(mutex);
    `)

    expect(
      tokens.map((token) => token.type),
    ).toEqual([
      'SEMAPHORE_P',
      'LEFT_PAREN',
      'IDENTIFIER',
      'RIGHT_PAREN',
      'SEMICOLON',
      'SEMAPHORE_V',
      'LEFT_PAREN',
      'IDENTIFIER',
      'RIGHT_PAREN',
      'SEMICOLON',
      'EOF',
    ])
  })
})
