import type { ChannelSnapshot } from '../core/engine/SimulationSnapshot'
import type { MessagePassingExecutionEvent } from '../core/engine/ExecutionEvent'
import { formatExpression } from '../core/expressions/formatExpression'
import { formatDeclaredValueType } from '../core/language/DeclaredTypeUtils'
import type { ProcessId } from '../core/process/ProcessId'

export interface ChannelActivity {
  readonly step: number
  readonly processId: ProcessId
  readonly event: MessagePassingExecutionEvent
}

interface ChannelStatePanelProps {
  readonly channels: ChannelSnapshot[]
  readonly activity?: ChannelActivity
}

export function ChannelStatePanel({
  channels,
  activity,
}: ChannelStatePanelProps) {
  return (
    <div className="channel-grid">
      {channels.map((channel) => {
        const currentActivity =
          activity?.event.channelName === channel.name
            ? activity
            : undefined

        return (
          <article
            className={channelCardClassName(currentActivity)}
            key={
              `${channel.name}-${currentActivity?.step ?? 'idle'}`
            }
          >
          <div className="channel-header">
            <div>
              <code>{channel.name}</code>
              <div className="channel-schema">
                {'chan('}
                {channel.payloadTypes
                  .map(formatDeclaredValueType)
                  .join(', ')}
                {')'}
              </div>
            </div>

            <strong
              className="channel-count"
              aria-label={`${channel.messages.length} pending messages`}
            >
              {channel.messages.length}
            </strong>
          </div>

          {currentActivity && (
            <ChannelActivityIndicator
              activity={currentActivity}
            />
          )}

          <div className="channel-mailbox">
            <div className="channel-section-heading">
              <span>Mailbox</span>
              <small>FIFO</small>
            </div>

            {channel.messages.length === 0 ? (
              <p className="empty channel-empty">
                No pending messages
              </p>
            ) : (
              <ol
                className="channel-message-list"
                aria-label={`${channel.name} messages, front to back`}
              >
                {channel.messages.map((message, index) => (
                  <li
                    className={
                      messageClassName(
                        index,
                        channel.messages.length,
                        currentActivity,
                      )
                    }
                    key={`${channel.name}-${index}`}
                  >
                    <span className="channel-message-position">
                      {index === 0 ? 'Front' : `#${index + 1}`}
                    </span>

                    <code>
                      {formatMessage(message.values)}
                    </code>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="channel-waiters">
            <span>Pending receivers</span>

            {channel.waitingProcessIds.length === 0 ? (
              <span className="empty">None</span>
            ) : (
              <div className="semaphore-waiter-list">
                {channel.waitingProcessIds.map((processId) => (
                  <span
                    className="channel-waiter"
                    key={processId}
                  >
                    {processId}
                  </span>
                ))}
              </div>
            )}
          </div>

          <small>
            Asynchronous · send never blocks · receive waits when empty
          </small>
          </article>
        )
      })}
    </div>
  )
}

function ChannelActivityIndicator({
  activity,
}: {
  readonly activity: ChannelActivity
}) {
  const { event, processId } = activity
  const succeeded = event.status === 'SUCCEEDED'
  const label = event.operation === 'SEND'
    ? 'Message sent'
    : succeeded
      ? 'Message received'
      : 'Receive blocked'
  const movement = event.operation === 'SEND'
    ? `${processId} → mailbox`
    : succeeded
      ? `mailbox → ${processId}`
      : `${processId} waiting for a message`

  return (
    <div
      className="channel-activity"
      aria-label={`${label}: ${movement}`}
    >
      <strong>{label}</strong>
      <span>{movement}</span>
    </div>
  )
}

function channelCardClassName(
  activity: ChannelActivity | undefined,
): string {
  if (!activity) {
    return 'channel-card'
  }

  return [
    'channel-card',
    'channel-card-active',
    `channel-card-active-${activity.event.operation.toLowerCase()}`,
    `channel-card-active-${activity.event.status.toLowerCase()}`,
  ].join(' ')
}

function messageClassName(
  index: number,
  messageCount: number,
  activity: ChannelActivity | undefined,
): string {
  const isJustSent = activity?.event.operation === 'SEND'
    && activity.event.status === 'SUCCEEDED'
    && index === messageCount - 1

  return isJustSent
    ? 'channel-message channel-message-just-sent'
    : 'channel-message'
}

function formatMessage(
  values: ChannelSnapshot['messages'][number]['values'],
): string {
  return `(${values.map((value) =>
    formatExpression({
      type: 'LITERAL',
      value,
    })).join(', ')})`
}
