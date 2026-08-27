export class TokenizerError extends Error {
  readonly line: number
  readonly column: number

  constructor(
    message: string,
    line: number,
    column: number,
  ) {
    super(`${message} at line ${line}, column ${column}`)

    this.name = 'TokenizerError'
    this.line = line
    this.column = column
  }
}
