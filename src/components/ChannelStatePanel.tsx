import type { ChannelSnapshot } from '../core/engine/SimulationSnapshot'
import { formatExpression } from '../core/expressions/formatExpression'
import { formatDeclaredValueType } from '../core/language/DeclaredTypeUtils'

interface ChannelStatePanelProps {
  readonly channels: ChannelSnapshot[]
}

export function ChannelStatePanel({
  channels,
}: ChannelStatePanelProps) {
  return (
    <div className="channel-grid">
      {channels.map((channel) => (
        <article
          className="channel-card"
          key={channel.name}
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
                    className="channel-message"
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
      ))}
    </div>
  )
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
