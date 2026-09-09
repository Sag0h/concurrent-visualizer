import { describe, expect, it } from 'vitest'
import { parseProgram } from '../parseProgram'

describe('collection query expressions', () => {
  it('parses size and isEmpty inside compound expressions and guards', () => {
    const program = parseProgram(`
      process Worker {
        queue<int> resources = queue[1, 2];
        int adjusted = resources.size() + 10;

        if (!resources.isEmpty() && resources.size() == 2) {
          print(resources.size());
        }

        while (!resources.isEmpty()) {
          int current = resources.dequeue();
        }

        repeat {
          print("checked");
        } until (resources.isEmpty());

        for (int i = 0; i < resources.size(); i = i + 1) {
          print(i);
        }

        await (resources.isEmpty());
      }
    `)

    const instructions = program.processes[0].instructions

    expect(instructions[1]).toMatchObject({
      type: 'DECLARE',
      initialValue: {
        type: 'BINARY',
        left: {
          type: 'COLLECTION_QUERY',
          query: 'SIZE',
        },
      },
    })
    expect(instructions[2]).toMatchObject({
      type: 'IF',
      condition: {
        type: 'BINARY',
        operator: '&&',
        left: {
          type: 'UNARY',
          operand: {
            type: 'COLLECTION_QUERY',
            query: 'IS_EMPTY',
          },
        },
      },
      thenBranch: [{
        type: 'SIMULATED_OPERATION',
        arguments: [{
          type: 'COLLECTION_QUERY',
          query: 'SIZE',
        }],
      }],
    })
    expect(instructions[3]).toMatchObject({
      type: 'WHILE',
      condition: {
        type: 'UNARY',
        operand: {
          type: 'COLLECTION_QUERY',
          query: 'IS_EMPTY',
        },
      },
    })
    expect(instructions[4]).toMatchObject({
      type: 'REPEAT_UNTIL',
      condition: {
        type: 'COLLECTION_QUERY',
        query: 'IS_EMPTY',
      },
    })
    expect(instructions[5]).toMatchObject({
      type: 'FOR',
      condition: {
        type: 'BINARY',
        right: {
          type: 'COLLECTION_QUERY',
          query: 'SIZE',
        },
      },
    })
    expect(instructions[6]).toMatchObject({
      type: 'AWAIT',
      condition: {
        type: 'COLLECTION_QUERY',
        query: 'IS_EMPTY',
      },
    })
  })

  it('parses direct array queries as regular expressions', () => {
    const program = parseProgram(`
      process Worker {
        int[] values = [1, 2, 3];
        int count = values.size();
        bool empty = values.isEmpty();
      }
    `)

    expect(program.processes[0].instructions.slice(1)).toMatchObject([
      {
        type: 'DECLARE',
        initialValue: {
          type: 'COLLECTION_QUERY',
          query: 'SIZE',
        },
      },
      {
        type: 'DECLARE',
        initialValue: {
          type: 'COLLECTION_QUERY',
          query: 'IS_EMPTY',
        },
      },
    ])
  })

  it('rejects arguments in collection queries', () => {
    expect(() => parseProgram(`
      process Worker {
        queue<int> resources = queue[];
        while (resources.isEmpty(1)) { }
      }
    `)).toThrow('isEmpty() does not accept arguments')
  })
})
