import type { Expression } from '../expressions/Expression'
import {
  arrayAccess,
  binary,
  literal,
  unary,
  variable,
  functionCall,
} from '../expressions/expressionFactories'
import type { Instruction } from '../instructions/Instruction'
import {
  arrayTarget,
  assign,
  breakInstruction,
  callInstruction,
  continueInstruction,
  declare,
  foreachInstruction,
  forInstruction,
  ifInstruction,
  repeatUntilInstruction,
  variableTarget,
  whileInstruction,
  returnInstruction,
} from '../instructions/instructionFactories'
import type { RuntimeValue } from '../memory/RuntimeValue'
import type { Process } from '../process/Process'
import type { Program } from '../engine/Program'
import type { Token, TokenType } from './Token'
import { ParserError } from './ParserError'
import { tokenize } from './tokenize'
import type { FunctionDefinition } from './FunctionDefinition'

export function parseProgram(
  source: string,
): Program {
  const parser = new Parser(tokenize(source))

  return parser.parseProgram()
}

class Parser {
  private current = 0
  private readonly tokens: Token[]

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  parseProgram(): Program {
    const processes: Process[] = []
    const sharedMemory: Program['sharedMemory'] = {}

    const functions: Record<
      string,
      FunctionDefinition
    > = {}

    while (!this.isAtEnd()) {
      if (this.match('SHARED')) {
        this.parseSharedDeclaration(sharedMemory)
        continue
      }

      if (this.match('FUNCTION')) {
        const functionDefinition =
          this.parseFunctionDefinition()

        if (functions[functionDefinition.name]) {
          throw this.error(
            this.previous(),
            `Function "${functionDefinition.name}" is already defined`,
          )
        }

        functions[functionDefinition.name] =
          functionDefinition

        continue
      }

      if (this.match('PROCESS')) {
        processes.push(this.parseProcess())
        continue
      }

      throw this.error(
        this.peek(),
        'Expected "shared", "function" or "process"'
      )
    }

    return {
      processes,
      sharedMemory,
      functions,
    }
  }

  private parseSharedDeclaration(
    sharedMemory: Program['sharedMemory'],
  ): void {
    this.parseType()

    const name = this.consume(
      'IDENTIFIER',
      'Expected variable name',
    )

    this.consume(
      'ASSIGN',
      'Expected "=" after variable name',
    )

    const value = this.parseLiteralOrArrayValue()

    this.consume(
      'SEMICOLON',
      'Expected ";" after shared declaration',
    )

    sharedMemory[name.lexeme] = value
  }

  private parseProcess(): Process {
    const name = this.consume(
      'IDENTIFIER',
      'Expected process name',
    )

    this.consume(
      'LEFT_BRACE',
      'Expected "{" after process name',
    )

    const instructions: Instruction[] = []

    while (
      !this.check('RIGHT_BRACE')
      && !this.isAtEnd()
    ) {
      instructions.push(
        this.parseProcessInstruction(),
      )
    }

    this.consume(
      'RIGHT_BRACE',
      'Expected "}" after process body',
    )

    return {
      id: name.lexeme,
      state: 'READY',
      programCounter: 0,
      instructions,
      localMemory: {},
      executionStack: [],
      callStack: [],
      expressionRuntimeStatus: 'IDLE',
    }
  }

  private parseProcessInstruction(): Instruction {
    if (this.isTypeToken(this.peek().type)) {
      return this.parseLocalDeclaration()
    }

    if (this.match('IF')) {
      return this.parseIfInstruction()
    }

    if (this.match('WHILE')) {
      return this.parseWhileInstruction()
    }

    if (this.match('REPEAT')) {
      return this.parseRepeatUntilInstruction()
    }

    if (this.match('FOR')) {
      return this.parseForInstruction()
    }

    if (this.match('FOREACH')) {
      return this.parseForeachInstruction()
    }

    if (this.match('RETURN')) {
      return this.parseReturnInstruction()
    }

    if (this.match('BREAK')) {
      this.consume(
        'SEMICOLON',
        'Expected ";" after "break"',
      )
      return breakInstruction()
    }

    if (this.match('CONTINUE')) {
      this.consume(
        'SEMICOLON',
        'Expected ";" after "continue"',
      )
      return continueInstruction()
    }

    if (
      this.check('IDENTIFIER')
      && this.checkNext('LEFT_PAREN')
    ) {
      return this.parseFunctionCall()
    }

    if (this.check('IDENTIFIER')) {
      return this.parseAssignment()
    }

    throw this.error(
      this.peek(),
      'Expected declaration or assignment',
    )
  }

  private parseLocalDeclaration(): Instruction {
    this.parseType()

    const name = this.consume(
      'IDENTIFIER',
      'Expected variable name',
    )

    this.consume(
      'ASSIGN',
      'Expected "=" after variable name',
    )

    const initialValue = this.parseExpression()

    this.consume(
      'SEMICOLON',
      'Expected ";" after variable declaration',
    )

    return declare(
      'LOCAL',
      name.lexeme,
      initialValue,
    )
  }

  private parseAssignment(): Instruction {
    const instruction =
      this.parseAssignmentWithoutSemicolon()

    this.consume(
      'SEMICOLON',
      'Expected ";" after assignment',
    )

    return instruction
  }

  private parseExpression(): Expression {
    return this.parseOr()
  }

  private parseOr(): Expression {
    let expression = this.parseAnd()

    while (this.match('OR')) {
      expression = binary(
        '||',
        expression,
        this.parseAnd(),
      )
    }

    return expression
  }

  private parseAnd(): Expression {
    let expression = this.parseEquality()

    while (this.match('AND')) {
      expression = binary(
        '&&',
        expression,
        this.parseEquality(),
      )
    }

    return expression
  }

  private parseEquality(): Expression {
    let expression = this.parseComparison()

    while (
      this.match(
        'EQUAL_EQUAL',
        'NOT_EQUAL',
      )
    ) {
      const operator =
        this.previous().type === 'EQUAL_EQUAL'
          ? '=='
          : '!='

      expression = binary(
        operator,
        expression,
        this.parseComparison(),
      )
    }

    return expression
  }

  private parseComparison(): Expression {
    let expression = this.parseTerm()

    while (
      this.match(
        'LESS',
        'LESS_EQUAL',
        'GREATER',
        'GREATER_EQUAL',
      )
    ) {
      const operatorToken = this.previous()

      let operator: '<' | '<=' | '>' | '>='

      switch (operatorToken.type) {
        case 'LESS':
          operator = '<'
          break

        case 'LESS_EQUAL':
          operator = '<='
          break

        case 'GREATER':
          operator = '>'
          break

        case 'GREATER_EQUAL':
          operator = '>='
          break

        default:
          throw this.error(
            operatorToken,
            'Invalid comparison operator',
          )
      }

      expression = binary(
        operator,
        expression,
        this.parseTerm(),
      )
    }

    return expression
  }

  private parseTerm(): Expression {
    let expression = this.parseFactor()

    while (
      this.match(
        'PLUS',
        'MINUS',
      )
    ) {
      const operator =
        this.previous().type === 'PLUS'
          ? '+'
          : '-'

      expression = binary(
        operator,
        expression,
        this.parseFactor(),
      )
    }

    return expression
  }

  private parseFactor(): Expression {
    let expression = this.parseUnary()

    while (
      this.match(
        'STAR',
        'SLASH',
      )
    ) {
      const operator =
        this.previous().type === 'STAR'
          ? '*'
          : '/'

      expression = binary(
        operator,
        expression,
        this.parseUnary(),
      )
    }

    return expression
  }

  private parseUnary(): Expression {
    if (this.match('NOT')) {
      return unary(
        '!',
        this.parseUnary(),
      )
    }

    if (this.match('MINUS')) {
      return unary(
        '-',
        this.parseUnary(),
      )
    }

    return this.parsePrimary()
  }

  private parsePrimary(): Expression {
    if (this.match('NUMBER')) {
      return literal(
        Number(this.previous().lexeme),
      )
    }

    if (this.match('STRING')) {
      return literal(
        this.previous().lexeme,
      )
    }

    if (this.match('BOOLEAN')) {
      return literal(
        this.previous().lexeme === 'true',
      )
    }

    if (this.match('LEFT_BRACKET')) {
      const values: Array<number | boolean | string> = []

      if (!this.check('RIGHT_BRACKET')) {
        do {
          if (this.match('NUMBER')) {
            values.push(
              Number(this.previous().lexeme),
            )
            continue
          }

          if (this.match('STRING')) {
            values.push(
              this.previous().lexeme,
            )
            continue
          }

          if (this.match('BOOLEAN')) {
            values.push(
              this.previous().lexeme === 'true',
            )
            continue
          }

          throw this.error(
            this.peek(),
            'Expected array literal value',
          )
        } while (this.match('COMMA'))
      }

      this.consume(
        'RIGHT_BRACKET',
        'Expected "]" after array literal',
      )

      return literal(values)
    }

    if (this.match('IDENTIFIER')) {
      const name = this.previous().lexeme

      if (this.match('LEFT_PAREN')) {
        const args: Expression[] = []

        if (!this.check('RIGHT_PAREN')) {
          do {
            args.push(
              this.parseExpression(),
            )
          } while (this.match('COMMA'))
        }

        this.consume(
          'RIGHT_PAREN',
          'Expected ")" after function arguments',
        )

        return functionCall(
          name,
          args,
        )
      }

      if (this.match('LEFT_BRACKET')) {
        const index =
          this.parseExpression()

        this.consume(
          'RIGHT_BRACKET',
          'Expected "]" after array index',
        )

        return arrayAccess(
          variable(name),
          index,
        )
      }

      return variable(name)
    }

    if (this.match('LEFT_PAREN')) {
      const expression = this.parseExpression()

      this.consume(
        'RIGHT_PAREN',
        'Expected ")" after expression',
      )

      return expression
    }

    throw this.error(
      this.peek(),
      'Expected expression',
    )
  }

  private parseLiteralOrArrayValue(): RuntimeValue {
    if (this.match('NUMBER')) {
      return Number(this.previous().lexeme)
    }

    if (this.match('STRING')) {
      return this.previous().lexeme
    }

    if (this.match('BOOLEAN')) {
      return this.previous().lexeme === 'true'
    }

    if (this.match('LEFT_BRACKET')) {
      const values: Array<
        number | boolean | string
      > = []

      if (!this.check('RIGHT_BRACKET')) {
        do {
          const token = this.peek()

          if (this.match('NUMBER')) {
            values.push(
              Number(this.previous().lexeme),
            )
            continue
          }

          if (this.match('STRING')) {
            values.push(
              this.previous().lexeme,
            )
            continue
          }

          if (this.match('BOOLEAN')) {
            values.push(
              this.previous().lexeme === 'true',
            )
            continue
          }

          throw this.error(
            token,
            'Expected array literal value',
          )
        } while (this.match('COMMA'))
      }

      this.consume(
        'RIGHT_BRACKET',
        'Expected "]" after array literal',
      )

      return values
    }

    throw this.error(
      this.peek(),
      'Expected literal value',
    )
  }

  private parseType(): void {
    if (
      !this.match(
        'INT',
        'BOOL',
        'STRING_TYPE',
      )
    ) {
      throw this.error(
        this.peek(),
        'Expected type',
      )
    }

    if (this.match('LEFT_BRACKET')) {
      this.consume(
        'RIGHT_BRACKET',
        'Expected "]" in array type',
      )
    }
  }

  private isTypeToken(
    type: TokenType,
  ): boolean {
    return (
      type === 'INT'
      || type === 'BOOL'
      || type === 'STRING_TYPE'
    )
  }

  private match(
    ...types: TokenType[]
  ): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance()
        return true
      }
    }

    return false
  }

  private consume(
    type: TokenType,
    message: string,
  ): Token {
    if (this.check(type)) {
      return this.advance()
    }

    throw this.error(
      this.peek(),
      message,
    )
  }

  private check(
    type: TokenType,
  ): boolean {
    if (this.isAtEnd()) {
      return type === 'EOF'
    }

    return this.peek().type === type
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current++
    }

    return this.previous()
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF'
  }

  private peek(): Token {
    return this.tokens[this.current]
  }

  private previous(): Token {
    return this.tokens[this.current - 1]
  }

  private error(
    token: Token,
    message: string,
  ): ParserError {
    return new ParserError(
      message,
      token,
    )
  }

  private parseIfInstruction(): Instruction {
    this.consume(
      'LEFT_PAREN',
      'Expected "(" after "if"',
    )

    const condition = this.parseExpression()

    this.consume(
      'RIGHT_PAREN',
      'Expected ")" after IF condition',
    )

    const thenBranch = this.parseInstructionBlock()

    let elseBranch: Instruction[] = []

    if (this.match('ELSE')) {
      elseBranch = this.parseInstructionBlock()
    }

    return ifInstruction(
      condition,
      thenBranch,
      elseBranch,
    )
  }

  private parseInstructionBlock(): Instruction[] {
    this.consume(
      'LEFT_BRACE',
      'Expected "{" before block',
    )

    const instructions: Instruction[] = []

    while (
      !this.check('RIGHT_BRACE')
      && !this.isAtEnd()
    ) {
      instructions.push(
        this.parseProcessInstruction(),
      )
    }

    this.consume(
      'RIGHT_BRACE',
      'Expected "}" after block',
    )

    return instructions
  }

  private parseWhileInstruction(): Instruction {
    this.consume(
      'LEFT_PAREN',
      'Expected "(" after "while"',
    )

    const condition = this.parseExpression()

    this.consume(
      'RIGHT_PAREN',
      'Expected ")" after WHILE condition',
    )

    const body = this.parseInstructionBlock()

    return whileInstruction(
      condition,
      body,
    )
  }

  private parseRepeatUntilInstruction(): Instruction {
    const body = this.parseInstructionBlock()

    this.consume(
      'UNTIL',
      'Expected "until" after repeat block',
    )

    this.consume(
      'LEFT_PAREN',
      'Expected "(" after "until"',
    )

    const condition = this.parseExpression()

    this.consume(
      'RIGHT_PAREN',
      'Expected ")" after UNTIL condition',
    )

    this.consume(
      'SEMICOLON',
      'Expected ";" after repeat-until',
    )

    return repeatUntilInstruction(
      body,
      condition,
    )
  }

  private parseForInstruction(): Instruction {
    this.consume(
      'LEFT_PAREN',
      'Expected "(" after "for"',
    )

    this.parseType()

    const variableName = this.consume(
      'IDENTIFIER',
      'Expected FOR variable name',
    )

    this.consume(
      'ASSIGN',
      'Expected "=" in FOR initializer',
    )

    const initialValue =
      this.parseExpression()

    const initializer = declare(
      'LOCAL',
      variableName.lexeme,
      initialValue,
    )

    this.consume(
      'SEMICOLON',
      'Expected ";" after FOR initializer',
    )

    const condition =
      this.parseExpression()

    this.consume(
      'SEMICOLON',
      'Expected ";" after FOR condition',
    )

    const increment =
      this.parseAssignmentWithoutSemicolon()

    this.consume(
      'RIGHT_PAREN',
      'Expected ")" after FOR clauses',
    )

    const body =
      this.parseInstructionBlock()

    return forInstruction(
      initializer,
      condition,
      increment,
      body,
    )
  }

  private parseAssignmentWithoutSemicolon(): Instruction {
    const name = this.consume(
      'IDENTIFIER',
      'Expected assignment target',
    )

    if (this.match('LEFT_BRACKET')) {
      const index =
        this.parseExpression()

      this.consume(
        'RIGHT_BRACKET',
        'Expected "]" after array index',
      )

      this.consume(
        'ASSIGN',
        'Expected "=" after assignment target',
      )

      return assign(
        arrayTarget(
          name.lexeme,
          index,
        ),
        this.parseExpression(),
      )
    }

    this.consume(
      'ASSIGN',
      'Expected "=" after assignment target',
    )

    return assign(
      variableTarget(name.lexeme),
      this.parseExpression(),
    )
  }

  private parseForeachInstruction(): Instruction {
    this.consume(
      'LEFT_PAREN',
      'Expected "(" after "foreach"',
    )

    const item = this.consume(
      'IDENTIFIER',
      'Expected FOREACH item name',
    )

    this.consume(
      'IN',
      'Expected "in" after FOREACH item',
    )

    const collection =
      this.parseExpression()

    this.consume(
      'RIGHT_PAREN',
      'Expected ")" after FOREACH collection',
    )

    const body =
      this.parseInstructionBlock()

    return foreachInstruction(
      item.lexeme,
      collection,
      body,
    )
  }

  private parseFunctionDefinition(): FunctionDefinition {
    const name = this.consume(
      'IDENTIFIER',
      'Expected function name',
    )

    this.consume(
      'LEFT_PAREN',
      'Expected "(" after function name',
    )

    const parameters: string[] = []

    if (!this.check('RIGHT_PAREN')) {
      do {
        this.parseType()

        const parameter = this.consume(
          'IDENTIFIER',
          'Expected parameter name',
        )

        parameters.push(
          parameter.lexeme,
        )
      } while (this.match('COMMA'))
    }

    this.consume(
      'RIGHT_PAREN',
      'Expected ")" after parameters',
    )

    const body =
      this.parseInstructionBlock()

    return {
      name: name.lexeme,
      parameters,
      body,
    }
  }

  private checkNext(
    type: TokenType,
  ): boolean {
    if (
      this.current + 1
      >= this.tokens.length
    ) {
      return false
    }

    return (
      this.tokens[
        this.current + 1
      ].type === type
    )
  }

  private parseFunctionCall(): Instruction {
    const functionName = this.consume(
      'IDENTIFIER',
      'Expected function name',
    )

    this.consume(
      'LEFT_PAREN',
      'Expected "(" after function name',
    )

    const args: Expression[] = []

    if (!this.check('RIGHT_PAREN')) {
      do {
        args.push(
          this.parseExpression(),
        )
      } while (this.match('COMMA'))
    }

    this.consume(
      'RIGHT_PAREN',
      'Expected ")" after arguments',
    )

    this.consume(
      'SEMICOLON',
      'Expected ";" after function call',
    )

    return callInstruction(
      functionName.lexeme,
      args,
    )
  }

  private parseReturnInstruction(): Instruction {
    if (this.match('SEMICOLON')) {
      return returnInstruction()
    }

    const value = this.parseExpression()

    this.consume(
      'SEMICOLON',
      'Expected ";" after return value',
    )

    return returnInstruction(value)
  }
}
