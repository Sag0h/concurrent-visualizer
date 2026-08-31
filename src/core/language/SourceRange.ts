export interface SourcePosition {
  readonly offset: number
  readonly line: number
  readonly column: number
}

export interface SourceRange {
  readonly start: SourcePosition
  readonly end: SourcePosition
}
