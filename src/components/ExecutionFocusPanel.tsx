import type { ExecutionFocusSnapshot } from '../core/engine/SimulationSnapshot'

interface ExecutionFocusPanelProps {
  readonly focus?: ExecutionFocusSnapshot
}

export function ExecutionFocusPanel({
  focus,
}: ExecutionFocusPanelProps) {
  return (
    <section
      className="execution-focus-panel"
      aria-label="Execution focus"
    >
      <div className="execution-focus-heading">
        <span>EXECUTION FOCUS</span>
        <strong>
          {focus
            ? `Step ${focus.step} · ${focus.processId}`
            : 'Waiting for the first step'}
        </strong>
      </div>

      {focus ? (
        <div className="execution-focus-detail">
          <div>
            <span>Instruction</span>
            <code>{instructionLabel(focus.instructionType)}</code>
            {focus.description && (
              <small>{focus.description}</small>
            )}
          </div>

          <div>
            <span>Micro-operation</span>
            {focus.microOperation ? (
              <>
                <code>{instructionLabel(
                  focus.microOperation.type,
                )}</code>
                <small>
                  {focus.microOperation.description}
                </small>
              </>
            ) : (
              <em>Completed as one instruction step</em>
            )}
          </div>
        </div>
      ) : (
        <p>
          Use Step or Play to see which process and operation
          are advancing.
        </p>
      )}
    </section>
  )
}

function instructionLabel(type: string): string {
  return type.replaceAll('_', ' ')
}
