import { describe, expect, it } from 'vitest'
import { tokenize } from '../tokenize'

describe('tokenize', () => {
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
})
