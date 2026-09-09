import { describe, expect, it } from 'vitest'
import { parseProgram } from '../parseProgram'
import { tokenize } from '../tokenize'

describe('message passing syntax', () => {
  it('tokenizes channel declarations, send and receive', () => {
    const tokens = tokenize(`
      chan jobs(int);
      process Worker {
        send jobs(10);
        receive jobs(value);
      }
    `)

    expect(tokens.map((token) => token.type)).toEqual([
      'CHAN',
      'IDENTIFIER',
      'LEFT_PAREN',
      'INT',
      'RIGHT_PAREN',
      'SEMICOLON',
      'PROCESS',
      'IDENTIFIER',
      'LEFT_BRACE',
      'SEND',
      'IDENTIFIER',
      'LEFT_PAREN',
      'NUMBER',
      'RIGHT_PAREN',
      'SEMICOLON',
      'RECEIVE',
      'IDENTIFIER',
      'LEFT_PAREN',
      'IDENTIFIER',
      'RIGHT_PAREN',
      'SEMICOLON',
      'RIGHT_BRACE',
      'EOF',
    ])
  })

  it('parses typed scalar channels with tuple and record payloads', () => {
    const program = parseProgram(`
      record Failure {
        int id;
        string detail;
      }

      chan jobs(int, string);
      chan failures(Failure);
    `)

    expect(program.channels).toEqual({
      jobs: {
        name: 'jobs',
        payloadTypes: [
          {
            kind: 'PRIMITIVE',
            primitiveType: 'int',
          },
          {
            kind: 'PRIMITIVE',
            primitiveType: 'string',
          },
        ],
      },
      failures: {
        name: 'failures',
        payloadTypes: [
          {
            kind: 'RECORD',
            recordType: 'Failure',
          },
        ],
      },
    })
  })

  it('parses send expressions and assignable receive targets', () => {
    const source = `record Result { int value; }
chan data(int, int);

process Sender {
  int base = 9;
  send data(base + 1, 20);
}

process Receiver {
  int[] values = [0];
  Result result = Result { value: 0 };
  receive data(values[0], result.value);
}`
    const program = parseProgram(source)
    const send = program.processes[0].instructions[1]
    const receive = program.processes[1].instructions[2]

    expect(send).toMatchObject({
      type: 'SEND',
      channelName: 'data',
      arguments: [
        {
          type: 'BINARY',
          operator: '+',
        },
        {
          type: 'LITERAL',
          value: 20,
        },
      ],
    })
    expect(receive).toMatchObject({
      type: 'RECEIVE',
      channelName: 'data',
      targets: [
        {
          type: 'ARRAY_ACCESS',
          arrayName: 'values',
        },
        {
          type: 'RECORD_FIELD',
          recordName: 'result',
          fieldName: 'value',
        },
      ],
    })
    expect(sourceFragment(source, send)).toBe(
      'send data(base + 1, 20);',
    )
    expect(sourceFragment(source, receive)).toBe(
      'receive data(values[0], result.value);',
    )
  })

  it('requires a payload type and unique channel names', () => {
    expect(() => parseProgram('chan events();')).toThrow(
      'Channel "events" must declare at least one payload type',
    )

    expect(() => parseProgram(`
      chan events(int);
      chan events(string);
    `)).toThrow('Channel "events" is already defined')
  })

  it('requires channels to be declared before process operations', () => {
    expect(() => parseProgram(`
      process Producer {
        send jobs(1);
      }
      chan jobs(int);
    `)).toThrow(
      'Channel "jobs" is not defined; declare it before processes',
    )
  })

  it('validates send and receive arity', () => {
    expect(() => parseProgram(`
      chan jobs(int, string);
      process Producer {
        send jobs(1);
      }
    `)).toThrow(
      'Channel "jobs" expects 2 value(s), but send provides 1',
    )

    expect(() => parseProgram(`
      chan jobs(int, string);
      process Consumer {
        int value;
        receive jobs(value);
      }
    `)).toThrow(
      'Channel "jobs" expects 2 value(s), but receive provides 1',
    )
  })

  it('rejects non-assignable receive arguments', () => {
    expect(() => parseProgram(`
      chan jobs(int);
      process Consumer {
        receive jobs(1);
      }
    `)).toThrow('Expected assignable target in receive')
  })

  it('parses channel arrays and indexed send/receive references', () => {
    const source = `chan replies[4](string);

process Worker[id:0..3] {
  string response;
  send replies[id]("ready");
  receive replies[id](response);
}`
    const program = parseProgram(source)
    const [declaration, send, receive] =
      program.processes[0].instructions

    expect(program.channels?.replies).toEqual({
      name: 'replies',
      arrayLength: 4,
      payloadTypes: [
        {
          kind: 'PRIMITIVE',
          primitiveType: 'string',
        },
      ],
    })
    expect(declaration.type).toBe('DECLARE')
    expect(send).toMatchObject({
      type: 'SEND',
      channelName: 'replies',
      channelIndex: {
        type: 'VARIABLE',
        name: 'id',
      },
    })
    expect(receive).toMatchObject({
      type: 'RECEIVE',
      channelName: 'replies',
      channelIndex: {
        type: 'VARIABLE',
        name: 'id',
      },
    })
    expect(sourceFragment(source, send)).toBe(
      'send replies[id]("ready");',
    )
    expect(sourceFragment(source, receive)).toBe(
      'receive replies[id](response);',
    )
  })

  it('accepts expressions as channel indexes', () => {
    const program = parseProgram(`
      chan replies[4](int);
      process Worker {
        int id = 1;
        send replies[id + 1](10);
      }
    `)
    const send = program.processes[0].instructions[1]

    expect(send).toMatchObject({
      type: 'SEND',
      channelIndex: {
        type: 'BINARY',
        operator: '+',
      },
    })
  })

  it('validates channel array lengths', () => {
    expect(() => parseProgram(
      'chan replies[0](string);',
    )).toThrow(
      'Channel array length must be a positive integer',
    )

    expect(() => parseProgram(
      'chan replies[1001](string);',
    )).toThrow(
      'Channel array length 1001 exceeds maximum 1000',
    )

    expect(() => parseProgram(
      'chan replies[size](string);',
    )).toThrow(
      'Expected positive integer channel array length',
    )
  })

  it('distinguishes scalar and array channel references', () => {
    expect(() => parseProgram(`
      chan replies[2](string);
      process Worker {
        send replies("ready");
      }
    `)).toThrow(
      'Channel array "replies" requires an index',
    )

    expect(() => parseProgram(`
      chan reply(string);
      process Worker {
        send reply[0]("ready");
      }
    `)).toThrow(
      'Channel "reply" is not an array',
    )
  })

  it('rejects literal channel indexes outside the declaration', () => {
    expect(() => parseProgram(`
      chan replies[2](string);
      process Worker {
        send replies[2]("ready");
      }
    `)).toThrow(
      'Channel index 2 is outside "replies" range 0..1',
    )

    expect(() => parseProgram(`
      chan replies[2](string);
      process Worker {
        string response;
        receive replies[-1](response);
      }
    `)).toThrow(
      'Channel index -1 is outside "replies" range 0..1',
    )
  })
})

function sourceFragment(
  source: string,
  instruction: {
    readonly sourceRange?: {
      readonly start: { readonly offset: number }
      readonly end: { readonly offset: number }
    }
  },
): string | undefined {
  const range = instruction.sourceRange

  return range
    ? source.slice(range.start.offset, range.end.offset)
    : undefined
}
