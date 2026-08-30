import type { MemoryAccessProtection } from '../core/engine/MemoryConflictReason'
import type { DeadlockExplorationResult } from '../core/exploration/DeadlockExplorationResult'
import type {
  ExplorationLimits,
  ExplorationStatus,
  ExplorationTruncationReason,
} from '../core/exploration/ExplorationResult'
import type { MutualExclusionViolationExplorationResult } from '../core/exploration/MutualExclusionViolationExplorationResult'

export type ExplorationTarget =
  | 'DEADLOCK'
  | 'MUTUAL_EXCLUSION_VIOLATION'

export type SupportedExplorationResult =
  | DeadlockExplorationResult
  | MutualExclusionViolationExplorationResult

interface ExplorationPanelProps {
  readonly target: ExplorationTarget
  readonly limits: ExplorationLimits
  readonly result: SupportedExplorationResult | null
  readonly replayChoiceIndex: number | null
  readonly onTargetChange: (target: ExplorationTarget) => void
  readonly onLimitsChange: (limits: ExplorationLimits) => void
  readonly onExplore: () => void
  readonly onStartReplay: () => void
  readonly onReplayNext: () => void
  readonly onReplayAll: () => void
  readonly onExitReplay: () => void
}

export function ExplorationPanel({
  target,
  limits,
  result,
  replayChoiceIndex,
  onTargetChange,
  onLimitsChange,
  onExplore,
  onStartReplay,
  onReplayNext,
  onReplayAll,
  onExitReplay,
}: ExplorationPanelProps) {
  const counterexample = result?.counterexample
  const isReplaying = replayChoiceIndex !== null
  const replayComplete =
    counterexample !== undefined
    && replayChoiceIndex === counterexample.processChoices.length
  const nextProcessId =
    counterexample
    && replayChoiceIndex !== null
      ? counterexample.processChoices[replayChoiceIndex]
      : undefined

  return (
    <section
      className="exploration-panel"
      aria-labelledby="exploration-heading"
    >
      <div className="exploration-header">
        <div>
          <span className="exploration-badge">
            BOUNDED BFS
          </span>

          <h2 id="exploration-heading">
            Explore interleavings
          </h2>
        </div>

        <button
          type="button"
          onClick={onExplore}
          disabled={isReplaying}
        >
          Explore current state
        </button>
      </div>

      <p className="exploration-intro">
        Try every enabled process choice from the current state.
        The visible simulation is not modified during the search.
      </p>

      <div className="exploration-limit-grid">
        <label className="exploration-property-control">
          <span>Property</span>
          <select
            value={target}
            disabled={isReplaying}
            onChange={(event) => {
              onTargetChange(
                event.target.value as ExplorationTarget,
              )
            }}
          >
            <option value="DEADLOCK">
              Deadlock
            </option>
            <option value="MUTUAL_EXCLUSION_VIOLATION">
              Observed mutex violation
            </option>
          </select>
        </label>

        <label>
          <span>Maximum depth</span>
          <input
            type="number"
            min="0"
            step="1"
            value={limits.maxDepth}
            onChange={(event) => {
              onLimitsChange({
                ...limits,
                maxDepth: Number(event.target.value),
              })
            }}
          />
        </label>

        <label>
          <span>Maximum states</span>
          <input
            type="number"
            min="1"
            step="1"
            value={limits.maxStates}
            onChange={(event) => {
              onLimitsChange({
                ...limits,
                maxStates: Number(event.target.value),
              })
            }}
          />
        </label>
      </div>

      {target === 'MUTUAL_EXCLUSION_VIOLATION' && (
        <p className="exploration-scope-note">
          Searches only for observed overlap between incompatible
          mutex protocols. An ordinary potential race is not treated
          as a proven violation.
        </p>
      )}

      {result && (
        <div
          className={`exploration-result exploration-result-${result.status.toLowerCase()}`}
          aria-live="polite"
        >
          <div className="exploration-result-heading">
            <strong>
              {statusLabel(result.status, target)}
            </strong>
            <span>
              depth ≤ {result.limits.maxDepth}
              {' · '}
              states ≤ {result.limits.maxStates}
            </span>
          </div>

          <p>{statusDescription(result.status, target)}</p>

          <div className="exploration-statistics">
            <span>
              <strong>{result.statistics.visitedStateCount}</strong>
              {' '}{pluralize(
                result.statistics.visitedStateCount,
                'state',
                'states',
              )}{' '}visited
            </span>
            <span>
              <strong>{result.statistics.exploredTransitionCount}</strong>
              {' '}{pluralize(
                result.statistics.exploredTransitionCount,
                'transition',
                'transitions',
              )}{' '}tried
            </span>
            <span>
              <strong>{result.statistics.maximumDepthReached}</strong>
              {' '}maximum depth reached
            </span>
          </div>

          {result.truncationReasons.length > 0 && (
            <div className="exploration-reasons">
              <strong>Limits reached</strong>
              <div>
                {result.truncationReasons.map((reason) => (
                  <span key={reason}>
                    {truncationReasonLabel(reason)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {counterexample && (
            <div className="counterexample-panel">
              <div className="counterexample-heading">
                <div>
                  <h3>Shortest counterexample</h3>
                  <p>
                    {findingLabel(counterexample.kind)} after{' '}
                    {counterexample.depth}{' '}
                    {pluralize(
                      counterexample.depth,
                      'explicit process choice',
                      'explicit process choices',
                    )}.
                  </p>
                </div>

                <span className="counterexample-kind">
                  {findingKindLabel(counterexample)}
                </span>
              </div>

              {counterexample.kind
                === 'MUTUAL_EXCLUSION_VIOLATION' && (
                <div className="counterexample-evidence">
                  <span>
                    Location:{' '}
                    <code>
                      {memoryLocationLabel(
                        counterexample.diagnostic,
                      )}
                    </code>
                  </span>
                  <span>
                    Processes:{' '}
                    <strong>
                      {counterexample.diagnostic.first.processId}
                      {' ↔ '}
                      {counterexample.diagnostic.second.processId}
                    </strong>
                  </span>
                  <span>
                    Protection:{' '}
                    {protectionLabel(
                      counterexample.diagnostic.reason.first,
                    )}
                    {' vs '}
                    {protectionLabel(
                      counterexample.diagnostic.reason.second,
                    )}
                  </span>
                </div>
              )}

              {counterexample.processChoices.length === 0 ? (
                <p className="empty">
                  The explored state already violates this property.
                </p>
              ) : (
                <div
                  className="counterexample-sequence"
                  aria-label="Counterexample process sequence"
                >
                  {counterexample.processChoices.map(
                    (processId, index) => (
                      <span
                        className={choiceClassName(
                          index,
                          replayChoiceIndex,
                        )}
                        key={`${processId}-${index}`}
                        title={`Choice ${index + 1}`}
                      >
                        {processId}
                      </span>
                    ),
                  )}
                </div>
              )}

              {isReplaying && (
                <p className="counterexample-progress">
                  {replayComplete
                    ? 'Replay complete: the recorded finding is now visible.'
                    : `Next choice: ${nextProcessId} (${(replayChoiceIndex ?? 0) + 1} of ${counterexample.processChoices.length})`}
                </p>
              )}

              <div className="counterexample-actions">
                {!isReplaying ? (
                  <button type="button" onClick={onStartReplay}>
                    Start guided replay
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={onReplayNext}
                      disabled={replayComplete}
                    >
                      Replay next choice
                    </button>
                    <button type="button" onClick={onExitReplay}>
                      Exit replay
                    </button>
                  </>
                )}

                <button type="button" onClick={onReplayAll}>
                  Replay all
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function statusLabel(
  status: ExplorationStatus,
  target: ExplorationTarget,
): string {
  switch (status) {
    case 'FOUND':
      return target === 'DEADLOCK'
        ? 'Deadlock found'
        : 'Observed mutex violation found'
    case 'EXHAUSTED':
      return 'State space exhausted'
    case 'TRUNCATED':
      return 'Search truncated'
  }
}

function statusDescription(
  status: ExplorationStatus,
  target: ExplorationTarget,
): string {
  switch (status) {
    case 'FOUND':
      return target === 'DEADLOCK'
        ? 'At least one reachable interleaving ends with no process able to advance.'
        : 'At least one reachable interleaving overlaps shared-memory accesses protected by incompatible mutexes.'
    case 'EXHAUSTED':
      return target === 'DEADLOCK'
        ? 'No reachable deadlock was found after visiting every distinct semantic state.'
        : 'No observed mutex violation was found after visiting every distinct analyzed state.'
    case 'TRUNCATED':
      return 'At least one branch remains unexplored, so this result does not prove the program safe.'
  }
}

function truncationReasonLabel(
  reason: ExplorationTruncationReason,
): string {
  switch (reason) {
    case 'MAX_DEPTH':
      return 'Maximum depth'
    case 'MAX_STATES':
      return 'Maximum states'
    case 'ENGINE_STEP_LIMIT':
      return 'Engine step limit'
  }
}

function findingLabel(
  kind: ExplorationTarget,
): string {
  return kind === 'DEADLOCK'
    ? 'Deadlock'
    : 'Observed mutex violation'
}

function findingKindLabel(
  counterexample: NonNullable<
    SupportedExplorationResult['counterexample']
  >,
): string {
  if (
    counterexample.kind
      === 'MUTUAL_EXCLUSION_VIOLATION'
  ) {
    return 'Incompatible mutex overlap'
  }

  return counterexample.diagnostic.kind
    === 'CIRCULAR_WAIT'
    ? 'Circular wait'
    : 'Terminal blocking'
}

function memoryLocationLabel(
  conflict: NonNullable<
    MutualExclusionViolationExplorationResult[
      'counterexample'
    ]
  >['diagnostic'],
): string {
  const location = conflict.first.location

  if (location?.type === 'VARIABLE') {
    return location.name
  }

  if (location?.type === 'ARRAY_ELEMENT') {
    return `${location.arrayName}[${location.index}]`
  }

  if (location?.type === 'RECORD_FIELD') {
    return `${location.recordName}.${location.fieldName}`
  }

  return 'unknown'
}

function protectionLabel(
  protection: MemoryAccessProtection,
): string {
  const labels = [
    ...(protection.atomicRegion ? ['atomic'] : []),
    ...protection.mutexSemaphoreNames,
    ...protection.ambiguousSemaphoreNames.map(
      (name) => `${name} (ambiguous)`,
    ),
  ]

  return labels.length > 0
    ? labels.join(' + ')
    : 'unprotected'
}

function choiceClassName(
  index: number,
  replayChoiceIndex: number | null,
): string {
  if (replayChoiceIndex === null) {
    return 'counterexample-choice'
  }

  if (index < replayChoiceIndex) {
    return 'counterexample-choice counterexample-choice-complete'
  }

  if (index === replayChoiceIndex) {
    return 'counterexample-choice counterexample-choice-next'
  }

  return 'counterexample-choice'
}

function pluralize(
  count: number,
  singular: string,
  plural: string,
): string {
  return count === 1 ? singular : plural
}
