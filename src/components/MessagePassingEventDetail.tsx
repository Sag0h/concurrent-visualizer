import type { MessagePassingExecutionEvent } from '../core/engine/ExecutionEvent'
import { formatExpression } from '../core/expressions/formatExpression'

interface MessagePassingEventDetailProps {
  readonly event: MessagePassingExecutionEvent
}

export function MessagePassingEventStatus({
  event,
}: MessagePassingEventDetailProps) {
  return (
    <span
      className={
        `message-passing-status message-passing-status-${event.status.toLowerCase()}`
      }
    >
      {event.status}
    </span>
  )
}

export function MessagePassingEventDetail({
  event,
}: MessagePassingEventDetailProps) {
  return (
    <span className="message-passing-history-detail">
      <code>
        {`${event.operation.toLowerCase()}(${event.channelName})`}
      </code>

      <span
        className="message-passing-count-transition"
        aria-label={
          `Pending messages: ${event.messageCountBefore} to ${event.messageCountAfter}`
        }
      >
        {event.messageCountBefore}
        {' → '}
        {event.messageCountAfter}
        {` ${event.messageCountAfter === 1 ? 'message' : 'messages'}`}
      </span>

      {event.values && (
        <code
          className="message-passing-payload"
          aria-label="Message payload"
        >
          {formatPayload(event.values)}
        </code>
      )}

      {event.awakenedProcessIds
        && event.awakenedProcessIds.length > 0 && (
        <span className="message-passing-awakened">
          Reactivated {event.awakenedProcessIds.join(', ')}
        </span>
      )}
    </span>
  )
}

function formatPayload(
  values: NonNullable<MessagePassingExecutionEvent['values']>,
): string {
  return `(${values.map((value) =>
    formatExpression({
      type: 'LITERAL',
      value,
    })).join(', ')})`
}
