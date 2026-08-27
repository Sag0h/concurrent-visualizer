export type TokenType =
  | 'IDENTIFIER'
  | 'NUMBER'
  | 'STRING'
  | 'BOOLEAN'
  | 'SHARED'
  | 'PROCESS'
  | 'INT'
  | 'BOOL'
  | 'STRING_TYPE'
  | 'LEFT_BRACE'
  | 'RIGHT_BRACE'
  | 'LEFT_BRACKET'
  | 'RIGHT_BRACKET'
  | 'LEFT_PAREN'
  | 'RIGHT_PAREN'
  | 'SEMICOLON'
  | 'COMMA'
  | 'ASSIGN'
  | 'PLUS'
  | 'MINUS'
  | 'STAR'
  | 'SLASH'
  | 'EQUAL_EQUAL'
  | 'NOT_EQUAL'
  | 'LESS'
  | 'LESS_EQUAL'
  | 'GREATER'
  | 'GREATER_EQUAL'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'EOF'

export interface Token {
  readonly type: TokenType
  readonly lexeme: string
  readonly line: number
  readonly column: number
}
