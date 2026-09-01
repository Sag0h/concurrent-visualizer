import type { Expression } from '../expressions/Expression'
import {
  arrayAccess,
  binary,
  literal,
  unary,
  variable,
  functionCall,
  fieldAccess,
  recordGetter,
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
  atomicInstruction,
  awaitInstruction,
  semaphoreVInstruction,
  semaphorePInstruction,
  dataStructureOperationInstruction,
  recordFieldTarget,
  simulatedOperationInstruction,
} from '../instructions/instructionFactories'
import {
  createRecordValue,
  createPriorityQueueValue,
  createQueueValue,
  createStackValue,
  type PriorityQueueItem,
  type PrimitiveType,
  type PrimitiveValue,
  type RuntimeValue,
} from '../memory/RuntimeValue'
import type {
  DataStructureOperation,
  DataStructureResultTarget,
} from '../instructions/Instruction'
import type { Process } from '../process/Process'
import type { Program } from '../engine/Program'
import type { Token, TokenType } from './Token'
import type { SourceRange } from './SourceRange'
import { ParserError } from './ParserError'
import { tokenize } from './tokenize'
import type { FunctionDefinition } from './FunctionDefinition'
import type { RecordDefinition } from './RecordDefinition'
import type { DeclaredType } from './DeclaredType'

const MAX_PARAMETERIZED_PROCESS_COUNT = 1000

export function parseProgram(
  source: string,
): Program {
  const parser = new Parser(tokenize(source))

  return parser.parseProgram()
}

class Parser {
  private current = 0
  private readonly tokens: Token[]
  private readonly recordDefinitions: Record<
    string,
    RecordDefinition
  > = {}

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

    const semaphores: NonNullable<
      Program['semaphores']
    > = {}

    while (!this.isAtEnd()) {
      if (this.match('RECORD')) {
        this.parseRecordDefinition()
        continue
      }

      if (this.match('SHARED')) {
        this.parseSharedDeclaration(sharedMemory)
        continue
      }

      if (this.match('SEM')) {
        this.parseSemaphoreDeclaration(semaphores)
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
        const parsedProcesses = this.parseProcess()

        for (const process of parsedProcesses) {
          if (processes.some(
            (existing) => existing.id === process.id,
          )) {
            throw this.error(
              this.previous(),
              `Process "${process.id}" is already defined`,
            )
          }

          processes.push(process)
        }
        continue
      }

      throw this.error(
        this.peek(),
        'Expected "record", "shared", "sem", "function" or "process"'
      )
    }

    return {
      processes,
      sharedMemory,
      functions,
      semaphores,
      recordDefinitions: this.recordDefinitions,
    }
  }

  private parseRecordDefinition(): void {
    const name = this.consume(
      'IDENTIFIER',
      'Expected record name',
    )

    if (this.recordDefinitions[name.lexeme]) {
      throw this.error(
        name,
        `Record "${name.lexeme}" is already defined`,
      )
    }

    this.consume(
      'LEFT_BRACE',
      'Expected "{" after record name',
    )

    const fields: RecordDefinition['fields'] = []

    while (!this.check('RIGHT_BRACE') && !this.isAtEnd()) {
      const type = this.parsePrimitiveType()
      const field = this.consume(
        'IDENTIFIER',
        'Expected record field name',
      )

      if (fields.some(
        (existing) => existing.name.toLocaleLowerCase()
          === field.lexeme.toLocaleLowerCase(),
      )) {
        throw this.error(
          field,
          `Field "${field.lexeme}" is already defined in record "${name.lexeme}"`,
        )
      }

      this.consume(
        'SEMICOLON',
        'Expected ";" after record field',
      )
      fields.push({ name: field.lexeme, type })
    }

    this.consume(
      'RIGHT_BRACE',
      'Expected "}" after record definition',
    )

    this.recordDefinitions[name.lexeme] = {
      name: name.lexeme,
      fields,
    }
  }

  private parseSharedDeclaration(
    sharedMemory: Program['sharedMemory'],
  ): void {
    const declaredType = this.parseType()

    const name = this.consume(
      'IDENTIFIER',
      'Expected variable name',
    )

    this.consume(
      'ASSIGN',
      'Expected "=" after variable name',
    )

    const value = declaredType.container === 'QUEUE'
      ? this.parseQueueLiteral(
          declaredType.primitiveType,
        )
      : declaredType.container === 'PRIORITY_QUEUE'
        ? this.parsePriorityQueueLiteral(
            declaredType.primitiveType,
          )
        : declaredType.container === 'STACK'
          ? this.parseStackLiteral(
              declaredType.primitiveType,
            )
          : declaredType.container === 'RECORD'
            ? this.parseRecordLiteral(
                declaredType.recordType,
              )
            : this.parseLiteralOrArrayValue()

    this.consume(
      'SEMICOLON',
      'Expected ";" after shared declaration',
    )

    sharedMemory[name.lexeme] = value
  }

    private parseSemaphoreDeclaration(
    semaphores: NonNullable<Program['semaphores']>,
  ): void {
    const name = this.consume(
      'IDENTIFIER',
      'Expected semaphore name',
    )

    this.consume(
      'ASSIGN',
      'Expected "=" after semaphore name',
    )

    const value = this.consume(
      'NUMBER',
      'Expected non-negative integer semaphore value',
    )

    this.consume(
      'SEMICOLON',
      'Expected ";" after semaphore declaration',
    )

    if (semaphores[name.lexeme]) {
      throw this.error(
        name,
        `Semaphore "${name.lexeme}" is already defined`,
      )
    }

    semaphores[name.lexeme] = {
      name: name.lexeme,
      value: Number(value.lexeme),
    }
  }

  private parseProcess(): Process[] {
    const name = this.consume(
      'IDENTIFIER',
      'Expected process name',
    )

    let range: {
      readonly indexName: string
      readonly start: number
      readonly end: number
    } | undefined

    if (this.match('LEFT_BRACKET')) {
      const indexName = this.consume(
        'IDENTIFIER',
        'Expected process range index name',
      )
      this.consume(
        'COLON',
        'Expected ":" after process range index',
      )
      const start = this.parseSignedInteger(
        'Expected process range start',
      )
      this.consume(
        'DOT',
        'Expected ".." in process range',
      )
      this.consume(
        'DOT',
        'Expected ".." in process range',
      )
      const end = this.parseSignedInteger(
        'Expected process range end',
      )
      this.consume(
        'RIGHT_BRACKET',
        'Expected "]" after process range',
      )
      range = {
        indexName: indexName.lexeme,
        start,
        end,
      }

      const processCount = Math.abs(end - start) + 1

      if (processCount > MAX_PARAMETERIZED_PROCESS_COUNT) {
        throw this.error(
          this.previous(),
          `Process range expands to ${processCount} instances; maximum is ${MAX_PARAMETERIZED_PROCESS_COUNT}`,
        )
      }
    }

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

    const createProcess = (
      id: string,
      localMemory: Process['localMemory'],
    ): Process => ({
      id,
      state: 'READY',
      programCounter: 0,
      instructions: structuredClone(instructions),
      localMemory,
      executionStack: [],
      callStack: [],
      expressionRuntimeStatus: 'IDLE',
      pendingEvaluations: [],
      atomicDepth: 0,
    })

    if (!range) {
      return [createProcess(name.lexeme, {})]
    }

    const processes: Process[] = []
    const step = range.start <= range.end ? 1 : -1

    for (
      let index = range.start;
      step > 0 ? index <= range.end : index >= range.end;
      index += step
    ) {
      const process = createProcess(
        `${name.lexeme}[${index}]`,
        { [range.indexName]: index },
      )
      processes.push(process)
    }

    return processes
  }

  private parseSignedInteger(message: string): number {
    const sign = this.match('MINUS') ? -1 : 1
    const value = this.consume('NUMBER', message)

    return sign * Number(value.lexeme)
  }

  private parseProcessInstruction(): Instruction {
    const startToken = this.peek()
    const instruction =
      this.parseProcessInstructionWithoutSourceRange()

    return this.withSourceRange(
      instruction,
      startToken,
      this.previous(),
    )
  }

  private parseProcessInstructionWithoutSourceRange(): Instruction {
    if (this.isLocalDeclarationStart()) {
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

    if (this.match('ATOMIC')) {
      return this.parseAtomicInstruction()
    }

    if (this.match('AWAIT')) {
      return this.parseAwaitInstruction()
    }

    if (this.match('SEMAPHORE_P')) {
      return this.parseSemaphoreOperation('P')
    }

    if (this.match('SEMAPHORE_V')) {
      return this.parseSemaphoreOperation('V')
    }

    if (this.match('PRINT')) {
      return this.parsePrintInstruction()
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
      && this.checkNext('DOT')
      && !this.checkAt(3, 'ASSIGN')
    ) {
      return this.isDataStructureOperationCallStart()
        ? this.parseDataStructureOperationStatement()
        : this.parseSimulatedRecordMethodStatement()
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
    const declaredType = this.parseType()

    const name = this.consume(
      'IDENTIFIER',
      'Expected variable name',
    )

    this.consume(
      'ASSIGN',
      'Expected "=" after variable name',
    )

    if (this.isDataStructureOperationCallStart()) {
      if (declaredType.container !== 'SCALAR') {
        throw this.error(
          this.peek(),
          'Data structure operation results require a primitive scalar declaration',
        )
      }

      const operation = this.parseDataStructureOperationCall()

      if (operation.operation === 'ENQUEUE'
        || operation.operation === 'PUSH') {
        throw this.error(
          this.previous(),
          `${dataStructureMethodName(operation.operation)}() does not return a value`,
        )
      }

      this.consume(
        'SEMICOLON',
        'Expected ";" after data structure operation',
      )

      return dataStructureOperationInstruction(
        operation.structureName,
        operation.operation,
        {
          resultTarget: {
            type: 'DECLARE',
            scope: 'LOCAL',
            name: name.lexeme,
          },
        },
      )
    }

    const initialValue =
      declaredType.container === 'QUEUE'
        ? literal(
            this.parseQueueLiteral(
              declaredType.primitiveType,
            ),
          )
        : declaredType.container === 'PRIORITY_QUEUE'
          ? literal(
              this.parsePriorityQueueLiteral(
                declaredType.primitiveType,
              ),
            )
          : declaredType.container === 'STACK'
            ? literal(
                this.parseStackLiteral(
                  declaredType.primitiveType,
                ),
              )
            : declaredType.container === 'RECORD'
              ? literal(
                  this.parseRecordLiteral(
                    declaredType.recordType,
                  ),
                )
              : this.parseExpression()

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
        'PERCENT',
      )
    ) {
      const operatorToken = this.previous()
      const operator =
        operatorToken.type === 'STAR'
          ? '*'
          : operatorToken.type === 'SLASH'
            ? '/'
            : '%'

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

      let expression: Expression = variable(name)

      if (this.match('LEFT_BRACKET')) {
        const index =
          this.parseExpression()

        this.consume(
          'RIGHT_BRACKET',
          'Expected "]" after array index',
        )

        expression = arrayAccess(
          expression,
          index,
        )
      }

      if (this.match('DOT')) {
        const field = this.consume(
          'IDENTIFIER',
          'Expected field name after "."',
        )

        if (this.match('LEFT_PAREN')) {
          if (!field.lexeme.startsWith('get')) {
            throw this.error(
              field,
              'Only record getters can return a value currently',
            )
          }

          if (!this.check('RIGHT_PAREN')) {
            throw this.error(
              this.peek(),
              `Getter "${field.lexeme}" does not accept arguments`,
            )
          }

          this.consume(
            'RIGHT_PAREN',
            `Expected ")" after getter "${field.lexeme}"`,
          )
          expression = recordGetter(
            expression,
            field.lexeme,
          )
        } else {
          expression = fieldAccess(
            expression,
            field.lexeme,
          )
        }
      }

      return expression
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

  private parsePrintInstruction(): Instruction {
    this.consume(
      'LEFT_PAREN',
      'Expected "(" after "print"',
    )

    const args: Expression[] = []

    if (!this.check('RIGHT_PAREN')) {
      do {
        args.push(this.parseExpression())
      } while (this.match('COMMA'))
    }

    this.consume(
      'RIGHT_PAREN',
      'Expected ")" after print arguments',
    )
    this.consume(
      'SEMICOLON',
      'Expected ";" after print operation',
    )

    return simulatedOperationInstruction(
      'print',
      args,
    )
  }

  private parseSimulatedRecordMethodStatement(): Instruction {
    const receiver = this.consume(
      'IDENTIFIER',
      'Expected record name',
    )
    this.consume(
      'DOT',
      'Expected "." after record name',
    )
    const method = this.consume(
      'IDENTIFIER',
      'Expected simulated method name',
    )

    if (method.lexeme.startsWith('get')) {
      throw this.error(
        method,
        `Getter "${method.lexeme}" returns a value and cannot be used as a statement`,
      )
    }

    this.consume(
      'LEFT_PAREN',
      `Expected "(" after "${method.lexeme}"`,
    )

    const args: Expression[] = []

    if (!this.check('RIGHT_PAREN')) {
      do {
        args.push(this.parseExpression())
      } while (this.match('COMMA'))
    }

    this.consume(
      'RIGHT_PAREN',
      `Expected ")" after "${method.lexeme}" arguments`,
    )
    this.consume(
      'SEMICOLON',
      `Expected ";" after "${method.lexeme}" operation`,
    )

    return simulatedOperationInstruction(
      method.lexeme,
      args,
      receiver.lexeme,
    )
  }

  private parseQueueLiteral(
    elementType: PrimitiveType,
  ): RuntimeValue {
    this.consume(
      'QUEUE',
      'Expected queue literal',
    )

    this.consume(
      'LEFT_BRACKET',
      'Expected "[" after "queue"',
    )

    const items: PrimitiveValue[] = []

    if (!this.check('RIGHT_BRACKET')) {
      do {
        const token = this.peek()
        let value: PrimitiveValue

        if (this.match('NUMBER')) {
          value = Number(this.previous().lexeme)
        } else if (this.match('STRING')) {
          value = this.previous().lexeme
        } else if (this.match('BOOLEAN')) {
          value = this.previous().lexeme === 'true'
        } else {
          throw this.error(
            token,
            'Expected primitive queue item',
          )
        }

        if (!matchesPrimitiveType(value, elementType)) {
          throw this.error(
            token,
            `Queue<${elementType}> item has the wrong type`,
          )
        }

        items.push(value)
      } while (this.match('COMMA'))
    }

    this.consume(
      'RIGHT_BRACKET',
      'Expected "]" after queue literal',
    )

    return createQueueValue(
      elementType,
      items,
    )
  }

  private parsePriorityQueueLiteral(
    elementType: PrimitiveType,
  ): RuntimeValue {
    this.consume(
      'PRIORITY_QUEUE',
      'Expected priority queue literal',
    )
    this.consume(
      'LEFT_BRACKET',
      'Expected "[" after "priority_queue"',
    )

    const items: PriorityQueueItem[] = []

    if (!this.check('RIGHT_BRACKET')) {
      do {
        this.consume(
          'LEFT_PAREN',
          'Expected "(" before priority queue item',
        )

        const token = this.peek()
        let value: PrimitiveValue

        if (this.match('NUMBER')) {
          value = Number(this.previous().lexeme)
        } else if (this.match('STRING')) {
          value = this.previous().lexeme
        } else if (this.match('BOOLEAN')) {
          value = this.previous().lexeme === 'true'
        } else {
          throw this.error(
            token,
            'Expected primitive priority queue item',
          )
        }

        if (!matchesPrimitiveType(value, elementType)) {
          throw this.error(
            token,
            `PriorityQueue<${elementType}> item has the wrong type`,
          )
        }

        this.consume(
          'COMMA',
          'Expected "," before item priority',
        )

        const sign = this.match('MINUS') ? -1 : 1
        const priority = sign * Number(this.consume(
          'NUMBER',
          'Expected integer item priority',
        ).lexeme)

        this.consume(
          'RIGHT_PAREN',
          'Expected ")" after priority queue item',
        )
        items.push({ value, priority })
      } while (this.match('COMMA'))
    }

    this.consume(
      'RIGHT_BRACKET',
      'Expected "]" after priority queue literal',
    )

    return createPriorityQueueValue(
      elementType,
      items,
    )
  }

  private parseStackLiteral(
    elementType: PrimitiveType,
  ): RuntimeValue {
    this.consume(
      'STACK',
      'Expected stack literal',
    )
    this.consume(
      'LEFT_BRACKET',
      'Expected "[" after "stack"',
    )

    const items: PrimitiveValue[] = []

    if (!this.check('RIGHT_BRACKET')) {
      do {
        const token = this.peek()
        let value: PrimitiveValue

        if (this.match('NUMBER')) {
          value = Number(this.previous().lexeme)
        } else if (this.match('STRING')) {
          value = this.previous().lexeme
        } else if (this.match('BOOLEAN')) {
          value = this.previous().lexeme === 'true'
        } else {
          throw this.error(
            token,
            'Expected primitive stack item',
          )
        }

        if (!matchesPrimitiveType(value, elementType)) {
          throw this.error(
            token,
            `Stack<${elementType}> item has the wrong type`,
          )
        }

        items.push(value)
      } while (this.match('COMMA'))
    }

    this.consume(
      'RIGHT_BRACKET',
      'Expected "]" after stack literal',
    )

    return createStackValue(elementType, items)
  }

  private parseRecordLiteral(
    recordType: string,
  ): RuntimeValue {
    const definition = this.recordDefinitions[recordType]

    if (!definition) {
      throw this.error(
        this.peek(),
        `Record "${recordType}" is not defined`,
      )
    }

    const literalType = this.consume(
      'IDENTIFIER',
      `Expected record literal "${recordType}"`,
    )

    if (literalType.lexeme !== recordType) {
      throw this.error(
        literalType,
        `Expected record literal "${recordType}"`,
      )
    }

    this.consume(
      'LEFT_BRACE',
      `Expected "{" after "${recordType}"`,
    )

    const fields: Record<string, PrimitiveValue> = {}

    if (!this.check('RIGHT_BRACE')) {
      do {
        const field = this.consume(
          'IDENTIFIER',
          'Expected record field name',
        )
        const fieldDefinition = definition.fields.find(
          (candidate) => candidate.name === field.lexeme,
        )

        if (!fieldDefinition) {
          throw this.error(
            field,
            `Record "${recordType}" has no field "${field.lexeme}"`,
          )
        }

        if (field.lexeme in fields) {
          throw this.error(
            field,
            `Field "${field.lexeme}" is repeated in record literal "${recordType}"`,
          )
        }

        this.consume(
          'COLON',
          'Expected ":" after record field name',
        )
        const valueToken = this.peek()
        const value = this.parsePrimitiveLiteral(
          'Expected primitive record field value',
        )

        if (!matchesPrimitiveType(value, fieldDefinition.type)) {
          throw this.error(
            valueToken,
            `Field "${field.lexeme}" of record "${recordType}" must be ${fieldDefinition.type}`,
          )
        }

        fields[field.lexeme] = value
      } while (this.match('COMMA'))
    }

    this.consume(
      'RIGHT_BRACE',
      `Expected "}" after record literal "${recordType}"`,
    )

    const missingField = definition.fields.find(
      (field) => !(field.name in fields),
    )

    if (missingField) {
      throw this.error(
        this.previous(),
        `Record literal "${recordType}" is missing field "${missingField.name}"`,
      )
    }

    return createRecordValue(recordType, fields)
  }

  private parsePrimitiveLiteral(
    message: string,
  ): PrimitiveValue {
    const sign = this.match('MINUS') ? -1 : 1

    if (this.match('NUMBER')) {
      return sign * Number(this.previous().lexeme)
    }

    if (sign === -1) {
      throw this.error(this.peek(), message)
    }

    if (this.match('STRING')) {
      return this.previous().lexeme
    }

    if (this.match('BOOLEAN')) {
      return this.previous().lexeme === 'true'
    }

    throw this.error(this.peek(), message)
  }

  private parseType(): DeclaredType {
    if (
      this.check('IDENTIFIER')
      && this.recordDefinitions[this.peek().lexeme]
    ) {
      const recordType = this.advance().lexeme

      return {
        container: 'RECORD',
        recordType,
      }
    }

    if (this.match('STACK')) {
      this.consume(
        'LESS',
        'Expected "<" after "stack"',
      )

      const primitiveType = this.parsePrimitiveType()

      this.consume(
        'GREATER',
        'Expected ">" after stack element type',
      )

      return {
        container: 'STACK',
        primitiveType,
      }
    }

    if (this.match('PRIORITY_QUEUE')) {
      this.consume(
        'LESS',
        'Expected "<" after "priority_queue"',
      )

      const primitiveType =
        this.parsePrimitiveType()

      this.consume(
        'GREATER',
        'Expected ">" after priority queue element type',
      )

      return {
        container: 'PRIORITY_QUEUE',
        primitiveType,
      }
    }

    if (this.match('QUEUE')) {
      this.consume(
        'LESS',
        'Expected "<" after "queue"',
      )

      const primitiveType =
        this.parsePrimitiveType()

      this.consume(
        'GREATER',
        'Expected ">" after queue element type',
      )

      return {
        container: 'QUEUE',
        primitiveType,
      }
    }

    const primitiveType =
      this.parsePrimitiveType()

    if (this.match('LEFT_BRACKET')) {
      this.consume(
        'RIGHT_BRACKET',
        'Expected "]" in array type',
      )

      return {
        container: 'ARRAY',
        primitiveType,
      }
    }

    return {
      container: 'SCALAR',
      primitiveType,
    }
  }

  private parsePrimitiveType(): PrimitiveType {
    if (this.match('INT')) {
      return 'int'
    }

    if (this.match('BOOL')) {
      return 'bool'
    }

    if (this.match('STRING_TYPE')) {
      return 'string'
    }

    throw this.error(
      this.peek(),
      'Expected primitive type',
    )
  }

  private isTypeToken(
    type: TokenType,
  ): boolean {
    return (
      type === 'INT'
      || type === 'BOOL'
      || type === 'STRING_TYPE'
      || type === 'QUEUE'
      || type === 'PRIORITY_QUEUE'
      || type === 'STACK'
    )
  }

  private isLocalDeclarationStart(): boolean {
    return (
      this.isTypeToken(this.peek().type)
      || (
        this.check('IDENTIFIER')
        && Boolean(this.recordDefinitions[this.peek().lexeme])
        && this.checkNext('IDENTIFIER')
      )
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

  private withSourceRange(
    instruction: Instruction,
    startToken: Token,
    endToken: Token,
  ): Instruction {
    const sourceRange: SourceRange = {
      start: startToken.sourceRange.start,
      end: endToken.sourceRange.end,
    }

    return {
      ...instruction,
      sourceRange,
    }
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

    const initializerStart = this.peek()
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

    const initializerEnd = this.consume(
      'SEMICOLON',
      'Expected ";" after FOR initializer',
    )

    const initializer = this.withSourceRange(
      declare(
        'LOCAL',
        variableName.lexeme,
        initialValue,
      ),
      initializerStart,
      initializerEnd,
    )

    const condition =
      this.parseExpression()

    this.consume(
      'SEMICOLON',
      'Expected ";" after FOR condition',
    )

    const incrementStart = this.peek()
    const increment = this.withSourceRange(
      this.parseAssignmentWithoutSemicolon(),
      incrementStart,
      this.previous(),
    )

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

      if (this.isDataStructureOperationCallStart()) {
        return this.parseDataStructureResultInstruction(
          {
            type: 'ASSIGN',
            target: arrayTarget(
              name.lexeme,
              index,
            ),
          },
        )
      }

      return assign(
        arrayTarget(
          name.lexeme,
          index,
        ),
        this.parseExpression(),
      )
    }

    if (this.match('DOT')) {
      const field = this.consume(
        'IDENTIFIER',
        'Expected record field name',
      )

      this.consume(
        'ASSIGN',
        'Expected "=" after assignment target',
      )

      return assign(
        recordFieldTarget(
          name.lexeme,
          field.lexeme,
        ),
        this.parseExpression(),
      )
    }

    this.consume(
      'ASSIGN',
      'Expected "=" after assignment target',
    )

    if (this.isDataStructureOperationCallStart()) {
      return this.parseDataStructureResultInstruction(
        {
          type: 'ASSIGN',
          target: variableTarget(name.lexeme),
        },
      )
    }

    return assign(
      variableTarget(name.lexeme),
      this.parseExpression(),
    )
  }

  private parseDataStructureOperationStatement(): Instruction {
    const operation = this.parseDataStructureOperationCall()

    this.consume(
      'SEMICOLON',
      'Expected ";" after data structure operation',
    )

    if (
      operation.operation !== 'ENQUEUE'
      && operation.operation !== 'PUSH'
    ) {
      throw this.error(
        this.previous(),
        `${dataStructureMethodName(operation.operation)}() must be assigned to a variable`,
      )
    }

    return dataStructureOperationInstruction(
      operation.structureName,
      operation.operation,
      {
        argument: operation.argument,
        priorityArgument:
          operation.priorityArgument,
      },
    )
  }

  private parseDataStructureResultInstruction(
    resultTarget: DataStructureResultTarget,
  ): Instruction {
    const operation = this.parseDataStructureOperationCall()

    if (
      operation.operation === 'ENQUEUE'
      || operation.operation === 'PUSH'
    ) {
      throw this.error(
        this.previous(),
        `${dataStructureMethodName(operation.operation)}() does not return a value`,
      )
    }

    return dataStructureOperationInstruction(
      operation.structureName,
      operation.operation,
      { resultTarget },
    )
  }

  private parseDataStructureOperationCall(): {
    readonly structureName: string
    readonly operation: DataStructureOperation
    readonly argument?: Expression
    readonly priorityArgument?: Expression
  } {
    const structureName = this.consume(
      'IDENTIFIER',
      'Expected data structure name',
    )

    this.consume(
      'DOT',
      'Expected "." after data structure name',
    )

    const method = this.consume(
      'IDENTIFIER',
      'Expected data structure method name',
    )
    const operation = parseDataStructureOperationName(
      method.lexeme,
      () => this.error(
        method,
        `Unknown data structure method "${method.lexeme}"`,
      ),
    )

    this.consume(
      'LEFT_PAREN',
      `Expected "(" after "${method.lexeme}"`,
    )

    let argument: Expression | undefined
    let priorityArgument: Expression | undefined

    if (
      operation === 'ENQUEUE'
      || operation === 'PUSH'
    ) {
      argument = this.parseExpression()

      if (
        operation === 'ENQUEUE'
        && this.match('COMMA')
      ) {
        priorityArgument = this.parseExpression()
      }
    } else if (!this.check('RIGHT_PAREN')) {
      throw this.error(
        this.peek(),
        `${method.lexeme}() does not accept arguments`,
      )
    }

    this.consume(
      'RIGHT_PAREN',
      `Expected ")" after "${method.lexeme}"`,
    )

    return {
      structureName: structureName.lexeme,
      operation,
      argument,
      priorityArgument,
    }
  }

  private isDataStructureOperationCallStart(): boolean {
    return (
      this.check('IDENTIFIER')
      && this.checkNext('DOT')
      && this.checkAt(3, 'LEFT_PAREN')
      && isDataStructureMethodName(
        this.tokens[this.current + 2]?.lexeme,
      )
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

  private parseAtomicInstruction(): Instruction {
    const body = this.parseInstructionBlock()

    return atomicInstruction(body)
  }

  private parseAwaitInstruction(): Instruction {
    this.consume(
      'LEFT_PAREN',
      'Expected "(" after "await"',
    )

    const condition = this.parseExpression()

    this.consume(
      'RIGHT_PAREN',
      'Expected ")" after await condition',
    )

    if (this.match('SEMICOLON')) {
      return awaitInstruction(
        condition,
        [],
      )
    }

    const body = this.parseInstructionBlock()

    return awaitInstruction(
      condition,
      body,
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

  private parseSemaphoreOperation(
    operation: 'P' | 'V',
  ): Instruction {
    this.consume(
      'LEFT_PAREN',
      `Expected "(" after "${operation}"`,
    )

    const semaphore = this.consume(
      'IDENTIFIER',
      'Expected semaphore name',
    )

    this.consume(
      'RIGHT_PAREN',
      `Expected ")" after semaphore name`,
    )

    this.consume(
      'SEMICOLON',
      `Expected ";" after ${operation} operation`,
    )

    return operation === 'P'
      ? semaphorePInstruction(semaphore.lexeme)
      : semaphoreVInstruction(semaphore.lexeme)
  }

  private checkAt(
    offset: number,
    type: TokenType,
  ): boolean {
    return this.tokens[this.current + offset]?.type === type
  }
}

function matchesPrimitiveType(
  value: PrimitiveValue,
  type: PrimitiveType,
): boolean {
  return (
    (type === 'int' && typeof value === 'number')
    || (type === 'bool' && typeof value === 'boolean')
    || (type === 'string' && typeof value === 'string')
  )
}

function parseDataStructureOperationName(
  methodName: string,
  createError: () => Error,
): DataStructureOperation {
  switch (methodName) {
    case 'enqueue':
      return 'ENQUEUE'
    case 'dequeue':
      return 'DEQUEUE'
    case 'front':
      return 'FRONT'
    case 'push':
      return 'PUSH'
    case 'pop':
      return 'POP'
    case 'top':
      return 'TOP'
    case 'isEmpty':
      return 'IS_EMPTY'
    case 'size':
      return 'SIZE'
    default:
      throw createError()
  }
}

function isDataStructureMethodName(
  methodName: string | undefined,
): boolean {
  return methodName !== undefined && [
    'enqueue',
    'dequeue',
    'front',
    'push',
    'pop',
    'top',
    'isEmpty',
    'size',
  ].includes(methodName)
}

function dataStructureMethodName(
  operation: DataStructureOperation,
): string {
  switch (operation) {
    case 'ENQUEUE':
      return 'enqueue'
    case 'DEQUEUE':
      return 'dequeue'
    case 'FRONT':
      return 'front'
    case 'PUSH':
      return 'push'
    case 'POP':
      return 'pop'
    case 'TOP':
      return 'top'
    case 'IS_EMPTY':
      return 'isEmpty'
    case 'SIZE':
      return 'size'
  }
}
