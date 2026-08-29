import type {
  DeadlockExplorationResult,
  ExplorationLimits,
  ExplorationTruncationReason,
} from '../core/exploration/DeadlockExplorationResult'

interface DeadlockExplorerPanelProps {
  readonly limits: ExplorationLimits
  readonly result: DeadlockExplorationResult | null
  readonly replayChoiceIndex: number | null
  readonly onLimitsChange: (limits: ExplorationLimits) => void
  readonly onExplore: () => void
  readonly onStartReplay: () => void
  readonly onReplayNext: () => void
  readonly onReplayAll: () => void
  readonly onExitReplay: () => void
}

export function DeadlockExplorerPanel({
  limits,
  result,
  replayChoiceIndex,
  onLimitsChange,
  onExplore,
  onStartReplay,
  onReplayNext,
  onReplayAll,
  onExitReplay,
}: DeadlockExplorerPanelProps) {
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
        >
          Explore current state
        </button>
      </div>

      <p className="exploration-intro">
        Try every enabled process choice from the current state.
        The visible simulation is not modified during the search.
      </p>

      <div className="exploration-limit-grid">
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

      {result && (
        <div
          className={`exploration-result exploration-result-${result.status.toLowerCase()}`}
          aria-live="polite"
        >
          <div className="exploration-result-heading">
            <strong>{statusLabel(result.status)}</strong>
            <span>
              depth ≤ {result.limits.maxDepth}
              {' · '}
              states ≤ {result.limits.maxStates}
            </span>
          </div>

          <p>{statusDescription(result)}</p>

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
                    Deadlock after {counterexample.depth}{' '}
                    {pluralize(
                      counterexample.depth,
                      'explicit process choice',
                      'explicit process choices',
                    )}.
                  </p>
                </div>

                <span className="counterexample-kind">
                  {counterexample.diagnostic.kind === 'CIRCULAR_WAIT'
                    ? 'Circular wait'
                    : 'Terminal blocking'}
                </span>
              </div>

              {counterexample.processChoices.length === 0 ? (
                <p className="empty">
                  The explored state was already deadlocked.
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
                    ? 'Replay complete: the recorded deadlock is now visible.'
                    : `Next choice: ${nextProcessId} (${(replayChoiceIndex ?? 0) + 1} of ${counterexample.processChoices.length})`}
                </p>
              )}

              <div className="counterexample-actions">
                {!isReplaying ? (
                  <button
                    type="button"
                    onClick={onStartReplay}
                  >
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

                    <button
                      type="button"
                      onClick={onExitReplay}
                    >
                      Exit replay
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={onReplayAll}
                >
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
  status: DeadlockExplorationResult['status'],
): string {
  switch (status) {
    case 'FOUND':
      return 'Deadlock found'
    case 'EXHAUSTED':
      return 'State space exhausted'
    case 'TRUNCATED':
      return 'Search truncated'
  }
}

function statusDescription(
  result: DeadlockExplorationResult,
): string {
  switch (result.status) {
    case 'FOUND':
      return 'At least one reachable interleaving ends with no process able to advance.'
    case 'EXHAUSTED':
      return 'No reachable deadlock was found after visiting every distinct semantic state.'
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
  return count === 1
    ? singular
    : plural
}
