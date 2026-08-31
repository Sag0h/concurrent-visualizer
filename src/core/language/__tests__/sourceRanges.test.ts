import { describe, expect, it } from 'vitest'
import { parseProgram } from '../parseProgram'
import { tokenize } from '../tokenize'

describe('source ranges', () => {
  it('keeps one-based positions and exclusive offsets in tokens', () => {
    const source = 'P(mutex);\nV(mutex);'
    const tokens = tokenize(source)

    expect(tokens[0].sourceRange).toEqual({
      start: {
        offset: 0,
        line: 1,
        column: 1,
      },
      end: {
        offset: 1,
        line: 1,
        column: 2,
      },
    })

    expect(tokens[5].sourceRange).toEqual({
      start: {
        offset: 10,
        line: 2,
        column: 1,
      },
      end: {
        offset: 11,
        line: 2,
        column: 2,
      },
    })

    expect(tokens.at(-1)?.sourceRange).toEqual({
      start: {
        offset: source.length,
        line: 2,
        column: 10,
      },
      end: {
        offset: source.length,
        line: 2,
        column: 10,
      },
    })
  })

  it('attaches the original source fragment to nested instructions', () => {
    const source = `sem mutex = 1;
process Worker {
  P(mutex);
  if (true) {
    print("ok");
  }
}`
    const program = parseProgram(source)
    const [semaphoreP, ifStatement] =
      program.processes[0].instructions

    expect(sourceFragment(source, semaphoreP)).toBe(
      'P(mutex);',
    )
    expect(semaphoreP.sourceRange?.start).toMatchObject({
      line: 3,
      column: 3,
    })

    expect(sourceFragment(source, ifStatement)).toBe(
      'if (true) {\n    print("ok");\n  }',
    )

    if (ifStatement.type !== 'IF') {
      throw new Error('Expected IF instruction')
    }

    expect(
      sourceFragment(source, ifStatement.thenBranch[0]),
    ).toBe('print("ok");')
    expect(
      ifStatement.thenBranch[0].sourceRange?.start,
    ).toMatchObject({
      line: 5,
      column: 5,
    })
  })

  it('preserves ranges in parameterized clones and FOR clauses', () => {
    const source = `process Worker[id:0..1] {
  for (int i = 0; i < 2; i = i + 1) {
    print(i);
  }
}`
    const program = parseProgram(source)
    const firstFor = program.processes[0].instructions[0]
    const secondFor = program.processes[1].instructions[0]

    expect(firstFor.sourceRange).toEqual(
      secondFor.sourceRange,
    )

    if (firstFor.type !== 'FOR') {
      throw new Error('Expected FOR instruction')
    }

    expect(sourceFragment(source, firstFor.initializer)).toBe(
      'int i = 0;',
    )
    expect(sourceFragment(source, firstFor.increment)).toBe(
      'i = i + 1',
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
