import { describe, expect, it } from 'vitest'
import { literal, variable } from '../../expressions/expressionFactories'
import { arrayTarget, variableTarget } from '../../instructions/instructionFactories'
import type { MonitorDefinition } from '../MonitorDefinition'
import {
  monitorInput,
  monitorOutput,
  monitorProcedureCall,
} from '../monitorFactories'

describe('monitor model', () => {
  it('separates private state, conditions and procedures', () => {
    const definition: MonitorDefinition = {
      name: 'Buffer',
      state: [
        {
          name: 'count',
          declaredType: {
            container: 'SCALAR',
            primitiveType: 'int',
          },
          initialValue: literal(0),
        },
      ],
      conditions: [
        { name: 'notEmpty' },
        { name: 'notFull' },
      ],
      procedures: {},
      initializationBody: [],
    }

    expect(definition).toMatchObject({
      name: 'Buffer',
      state: [{ name: 'count' }],
      conditions: [
        { name: 'notEmpty' },
        { name: 'notFull' },
      ],
    })
  })

  it('distinguishes captured inputs from writable outputs', () => {
    const call = monitorProcedureCall(
      'Buffer',
      'take',
      [
        monitorInput(variable('requestedId')),
        monitorOutput(variableTarget('result')),
        monitorOutput(arrayTarget('results', literal(2))),
      ],
    )

    expect(call).toEqual({
      type: 'MONITOR_PROCEDURE_CALL',
      monitorName: 'Buffer',
      procedureName: 'take',
      arguments: [
        {
          mode: 'IN',
          expression: {
            type: 'VARIABLE',
            name: 'requestedId',
          },
        },
        {
          mode: 'OUT',
          target: {
            type: 'VARIABLE',
            name: 'result',
          },
        },
        {
          mode: 'OUT',
          target: {
            type: 'ARRAY_ACCESS',
            arrayName: 'results',
            index: {
              type: 'LITERAL',
              value: 2,
            },
          },
        },
      ],
    })
  })
})
