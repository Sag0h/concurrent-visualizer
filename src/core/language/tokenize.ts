import type { Token, TokenType } from './Token'
import { TokenizerError } from './TokenizerError'

const keywords: Record<string, TokenType> = {
  shared: 'SHARED',
  process: 'PROCESS',
  int: 'INT',
  bool: 'BOOL',
  string: 'STRING_TYPE',
  true: 'BOOLEAN',
  false: 'BOOLEAN',
  if: 'IF',
  else: 'ELSE',
  while: 'WHILE',
  repeat: 'REPEAT',
  until: 'UNTIL',
  for: 'FOR',
  foreach: 'FOREACH',
  in: 'IN',
  break: 'BREAK',
  continue: 'CONTINUE',
  function: 'FUNCTION',
  return: 'RETURN',
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = []

  let current = 0
  let line = 1
  let column = 1

  function isAtEnd(): boolean {
    return current >= source.length
  }

  function peek(): string {
    return source[current] ?? '\0'
  }


  function advance(): string {
    const character = source[current]

    current++

    if (character === '\n') {
      line++
      column = 1
    } else {
      column++
    }

    return character
  }

  function addToken(
    type: TokenType,
    lexeme: string,
    tokenLine: number,
    tokenColumn: number,
  ): void {
    tokens.push({
      type,
      lexeme,
      line: tokenLine,
      column: tokenColumn,
    })
  }

  while (!isAtEnd()) {
    const tokenLine = line
    const tokenColumn = column

    const character = advance()

    if (
      character === ' '
      || character === '\r'
      || character === '\t'
      || character === '\n'
    ) {
      continue
    }

    if (character === '/' && peek() === '/') {
      while (peek() !== '\n' && !isAtEnd()) {
        advance()
      }

      continue
    }

    switch (character) {
      case '{':
        addToken('LEFT_BRACE', character, tokenLine, tokenColumn)
        continue

      case '}':
        addToken('RIGHT_BRACE', character, tokenLine, tokenColumn)
        continue

      case '[':
        addToken('LEFT_BRACKET', character, tokenLine, tokenColumn)
        continue

      case ']':
        addToken('RIGHT_BRACKET', character, tokenLine, tokenColumn)
        continue

      case '(':
        addToken('LEFT_PAREN', character, tokenLine, tokenColumn)
        continue

      case ')':
        addToken('RIGHT_PAREN', character, tokenLine, tokenColumn)
        continue

      case ';':
        addToken('SEMICOLON', character, tokenLine, tokenColumn)
        continue

      case ',':
        addToken('COMMA', character, tokenLine, tokenColumn)
        continue

      case '+':
        addToken('PLUS', character, tokenLine, tokenColumn)
        continue

      case '-':
        addToken('MINUS', character, tokenLine, tokenColumn)
        continue

      case '*':
        addToken('STAR', character, tokenLine, tokenColumn)
        continue

      case '/':
        addToken('SLASH', character, tokenLine, tokenColumn)
        continue

      case '=':
        if (peek() === '=') {
          advance()
          addToken(
            'EQUAL_EQUAL',
            '==',
            tokenLine,
            tokenColumn,
          )
        } else {
          addToken(
            'ASSIGN',
            character,
            tokenLine,
            tokenColumn,
          )
        }

        continue

      case '!':
        if (peek() === '=') {
          advance()
          addToken(
            'NOT_EQUAL',
            '!=',
            tokenLine,
            tokenColumn,
          )
        } else {
          addToken(
            'NOT',
            character,
            tokenLine,
            tokenColumn,
          )
        }

        continue

      case '<':
        if (peek() === '=') {
          advance()
          addToken(
            'LESS_EQUAL',
            '<=',
            tokenLine,
            tokenColumn,
          )
        } else {
          addToken(
            'LESS',
            character,
            tokenLine,
            tokenColumn,
          )
        }

        continue

      case '>':
        if (peek() === '=') {
          advance()
          addToken(
            'GREATER_EQUAL',
            '>=',
            tokenLine,
            tokenColumn,
          )
        } else {
          addToken(
            'GREATER',
            character,
            tokenLine,
            tokenColumn,
          )
        }

        continue

      case '&':
        if (peek() === '&') {
          advance()
          addToken(
            'AND',
            '&&',
            tokenLine,
            tokenColumn,
          )
          continue
        }

        throw new TokenizerError(
          'Expected "&" after "&"',
          tokenLine,
          tokenColumn,
        )

      case '|':
        if (peek() === '|') {
          advance()
          addToken(
            'OR',
            '||',
            tokenLine,
            tokenColumn,
          )
          continue
        }

        throw new TokenizerError(
          'Expected "|" after "|"',
          tokenLine,
          tokenColumn,
        )

      case '"': {
        let value = ''

        while (
          peek() !== '"'
          && !isAtEnd()
        ) {
          if (peek() === '\n') {
            throw new TokenizerError(
              'Unterminated string',
              tokenLine,
              tokenColumn,
            )
          }

          value += advance()
        }

        if (isAtEnd()) {
          throw new TokenizerError(
            'Unterminated string',
            tokenLine,
            tokenColumn,
          )
        }

        advance()

        addToken(
          'STRING',
          value,
          tokenLine,
          tokenColumn,
        )

        continue
      }
    }

    if (isDigit(character)) {
      let value = character

      while (isDigit(peek())) {
        value += advance()
      }

      addToken(
        'NUMBER',
        value,
        tokenLine,
        tokenColumn,
      )

      continue
    }

    if (isIdentifierStart(character)) {
      let value = character

      while (isIdentifierPart(peek())) {
        value += advance()
      }

      const type =
        keywords[value]
        ?? 'IDENTIFIER'

      addToken(
        type,
        value,
        tokenLine,
        tokenColumn,
      )

      continue
    }

    throw new TokenizerError(
      `Unexpected character "${character}"`,
      tokenLine,
      tokenColumn,
    )
  }

  tokens.push({
    type: 'EOF',
    lexeme: '',
    line,
    column,
  })

  return tokens
}

function isDigit(character: string): boolean {
  return character >= '0' && character <= '9'
}

function isIdentifierStart(
  character: string,
): boolean {
  return (
    character === '_'
    || (
      character >= 'a'
      && character <= 'z'
    )
    || (
      character >= 'A'
      && character <= 'Z'
    )
  )
}

function isIdentifierPart(
  character: string,
): boolean {
  return (
    isIdentifierStart(character)
    || isDigit(character)
  )
}
