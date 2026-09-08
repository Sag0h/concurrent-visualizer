import type { ProgramExample } from '../examples/ProgramExample'

interface ExamplePickerProps {
  readonly examples: readonly ProgramExample[]
  readonly selectedExampleId: string
  readonly onSelect: (exampleId: string) => void
  readonly onRequestLoad: () => void
}

export function ExamplePicker({
  examples,
  selectedExampleId,
  onSelect,
  onRequestLoad,
}: ExamplePickerProps) {
  const selectedExample = examples.find(
    (example) => example.id === selectedExampleId,
  )

  return (
    <section
      className="example-picker"
      aria-label="Educational examples"
    >
      <div className="example-picker-heading">
        <div>
          <span className="example-picker-badge">
            M11 · CATALOGUE
          </span>
          <h3>Educational examples</h3>
        </div>

        <button
          type="button"
          disabled={!selectedExample}
          onClick={onRequestLoad}
        >
          Load example
        </button>
      </div>

      <label htmlFor="program-example">
        Concurrent cases
      </label>
      <select
        id="program-example"
        value={selectedExampleId}
        onChange={(event) => onSelect(event.target.value)}
      >
        <option value="">Choose an example</option>
        <ExampleCategoryOptions
          category="SEMAPHORES"
          label="Semaphores"
          examples={examples}
        />
        <ExampleCategoryOptions
          category="MONITORS"
          label="Monitors"
          examples={examples}
        />
      </select>

      {selectedExample ? (
        <div className="example-picker-description">
          <span className={`example-variant example-variant-${selectedExample.variant.toLowerCase()}`}>
            {selectedExample.variant === 'PROBLEM'
              ? 'WITH PROBLEM'
              : 'CORRECT SOLUTION'}
          </span>
          <strong>{selectedExample.title}</strong>
          <p>{selectedExample.description}</p>
          <span>
            Mechanism: {categoryLabel(selectedExample.category)}
            {' · '}
            Recommended scheduler:{' '}
            {schedulerLabel(
              selectedExample.recommendedScheduler,
            )}
          </span>
        </div>
      ) : (
        <p className="example-picker-empty">
          Select a problem or its corrected solution.
        </p>
      )}
    </section>
  )
}

function ExampleCategoryOptions({
  category,
  label,
  examples,
}: {
  readonly category: ProgramExample['category']
  readonly label: string
  readonly examples: readonly ProgramExample[]
}) {
  const categoryExamples = examples.filter(
    (example) => example.category === category,
  )

  if (categoryExamples.length === 0) {
    return null
  }

  return (
    <>
      <ExampleOptions
        label={`${label} — with problem`}
        examples={categoryExamples.filter(
          (example) => example.variant === 'PROBLEM',
        )}
      />
      <ExampleOptions
        label={`${label} — correct solution`}
        examples={categoryExamples.filter(
          (example) => example.variant === 'SOLUTION',
        )}
      />
    </>
  )
}

function ExampleOptions({
  label,
  examples,
}: {
  readonly label: string
  readonly examples: readonly ProgramExample[]
}) {
  return (
    <optgroup label={label}>
      {examples.map((example) => (
        <option
          key={example.id}
          value={example.id}
        >
          {example.title}
        </option>
      ))}
    </optgroup>
  )
}

function schedulerLabel(
  scheduler: ProgramExample['recommendedScheduler'],
): string {
  switch (scheduler) {
    case 'FIRST_READY':
      return 'First Ready'
    case 'ROUND_ROBIN':
      return 'Round Robin'
    case 'RANDOM':
      return 'Random'
  }
}

function categoryLabel(
  category: ProgramExample['category'],
): string {
  switch (category) {
    case 'SEMAPHORES':
      return 'Semaphores'
    case 'MONITORS':
      return 'Monitors'
  }
}
