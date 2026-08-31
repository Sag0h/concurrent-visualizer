import {
  useEffect,
  useRef,
  type ChangeEventHandler,
  type KeyboardEventHandler,
  type UIEventHandler,
} from 'react'

interface CodeEditorProps {
  readonly value: string
  readonly activeLine?: number
  readonly onChange: ChangeEventHandler<HTMLTextAreaElement>
  readonly onKeyDown: KeyboardEventHandler<HTMLTextAreaElement>
}

export function CodeEditor({
  value,
  activeLine,
  onChange,
  onKeyDown,
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLPreElement>(null)
  const lines = value.split('\n')

  function synchronizeScroll(): void {
    const textarea = textareaRef.current
    const highlight = highlightRef.current

    if (!textarea || !highlight) {
      return
    }

    highlight.scrollTop = textarea.scrollTop
    highlight.scrollLeft = textarea.scrollLeft
  }

  const handleScroll: UIEventHandler<HTMLTextAreaElement> = () => {
    synchronizeScroll()
  }

  useEffect(() => {
    const textarea = textareaRef.current

    if (!textarea || activeLine === undefined) {
      return
    }

    const style = window.getComputedStyle(textarea)
    const parsedLineHeight = Number.parseFloat(style.lineHeight)
    const parsedPaddingTop = Number.parseFloat(style.paddingTop)
    const lineHeight = Number.isFinite(parsedLineHeight)
      ? parsedLineHeight
      : 21
    const paddingTop = Number.isFinite(parsedPaddingTop)
      ? parsedPaddingTop
      : 0
    const lineTop = paddingTop + (activeLine - 1) * lineHeight
    const lineBottom = lineTop + lineHeight
    const visibleTop = textarea.scrollTop
    const visibleBottom = visibleTop + textarea.clientHeight

    if (
      lineTop < visibleTop
      || lineBottom > visibleBottom
    ) {
      textarea.scrollTop = Math.max(
        0,
        lineTop - textarea.clientHeight / 2 + lineHeight / 2,
      )
    }

    synchronizeScroll()
  }, [activeLine])

  return (
    <div className="code-editor-shell">
      <pre
        ref={highlightRef}
        className="code-editor-highlight"
        aria-hidden="true"
      >
        <code>
          {lines.map((line, index) => {
            const lineNumber = index + 1

            return (
              <span
                className={
                  lineNumber === activeLine
                    ? 'code-editor-line code-editor-line-active'
                    : 'code-editor-line'
                }
                key={lineNumber}
              >
                {line || '\u200b'}
              </span>
            )
          })}
        </code>
      </pre>

      <textarea
        ref={textareaRef}
        className="code-editor"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onScroll={handleScroll}
        aria-label="Program source code"
        wrap="off"
        spellCheck={false}
      />
    </div>
  )
}
