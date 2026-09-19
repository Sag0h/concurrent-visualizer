import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  MessagePassingEventDetail,
  MessagePassingEventStatus,
} from '../MessagePassingEventDetail'

describe('MessagePassingEventDetail', () => {
  it.each(['SUCCEEDED', 'BLOCKED'] as const)(
    'renders the structured %s status',
    (status) => {
      const markup = renderToStaticMarkup(
        <MessagePassingEventStatus
          event={{
            operation: 'RECEIVE',
            channelName: 'jobs',
            status,
            messageCountBefore: 0,
            messageCountAfter: 0,
          }}
        />,
      )

      expect(markup).toContain(`message-passing-status-${status.toLowerCase()}`)
      expect(markup).toContain(status)
    },
  )

  it('renders a successful send, its payload and reactivated receivers', () => {
    const markup = renderToStaticMarkup(
      <MessagePassingEventDetail
        event={{
          operation: 'SEND',
          channelName: 'requests',
          status: 'SUCCEEDED',
          messageCountBefore: 0,
          messageCountAfter: 1,
          values: [7, 'work'],
          awakenedProcessIds: ['Server[0]', 'Server[1]'],
        }}
      />,
    )

    expect(markup).toContain('send(requests)')
    expect(markup).toContain('0 → 1 message')
    expect(markup).toContain('(7, &quot;work&quot;)')
    expect(markup).toContain('Reactivated Server[0], Server[1]')
  })

  it('renders a blocked receive without inventing a payload', () => {
    const markup = renderToStaticMarkup(
      <MessagePassingEventDetail
        event={{
          operation: 'RECEIVE',
          channelName: 'replies[2]',
          status: 'BLOCKED',
          messageCountBefore: 0,
          messageCountAfter: 0,
        }}
      />,
    )

    expect(markup).toContain('receive(replies[2])')
    expect(markup).toContain('0 → 0 messages')
    expect(markup).not.toContain('Message payload')
    expect(markup).not.toContain('Reactivated')
  })

  it('renders the consumed payload and mailbox transition of a receive', () => {
    const markup = renderToStaticMarkup(
      <MessagePassingEventDetail
        event={{
          operation: 'RECEIVE',
          channelName: 'results',
          status: 'SUCCEEDED',
          messageCountBefore: 2,
          messageCountAfter: 1,
          values: [true],
        }}
      />,
    )

    expect(markup).toContain('receive(results)')
    expect(markup).toContain('2 → 1 message')
    expect(markup).toContain('(true)')
  })
})
