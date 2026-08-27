import type { Token } from './Token'

export class ParserError extends Error {
  readonly line: number
  readonly column: number

  constructor(
    message: string,
    token: Token,
  ) {
    super(
      `${message} at line ${token.line}, column ${token.column}`,
    )

    this.name = 'ParserError'
    this.line = token.line
    this.column = token.column
  }
}
