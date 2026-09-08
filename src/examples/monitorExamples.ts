import type { ProgramExample } from './ProgramExample'

export const monitorBoundedBufferProblemExample = {
  id: 'monitor-bounded-buffer-problem',
  topicId: 'counted-buffer',
  title: 'Productor/Consumidor: buffer limitado',
  category: 'MONITORS',
  variant: 'PROBLEM',
  description: 'El consumidor libera espacio pero olvida signal(notFull): el productor nunca sale de su cola aunque ya exista lugar.',
  recommendedScheduler: 'FIRST_READY',
  source: `monitor BoundedBuffer {
    queue<int> items = queue[];
    int capacity = 2;
    int count = 0;
    cond notFull, notEmpty;

    procedure put(in int value) {
        while (count == capacity) {
            wait(notFull);
        }

        items.enqueue(value);
        count = count + 1;
        signal(notEmpty);
    }

    procedure take(out int value) {
        while (count == 0) {
            wait(notEmpty);
        }

        value = items.dequeue();
        count = count - 1;

        // Problema: falta signal(notFull).
    }
}

process Producer {
    BoundedBuffer.put(10);
    BoundedBuffer.put(20);
    BoundedBuffer.put(30);
}

process Consumer {
    int value;
    int[] received = [0, 0, 0];

    BoundedBuffer.take(value);
    received[0] = value;

    BoundedBuffer.take(value);
    received[1] = value;

    BoundedBuffer.take(value);
    received[2] = value;
}`,
} satisfies ProgramExample

export const monitorBoundedBufferExample = {
  id: 'monitor-bounded-buffer',
  topicId: 'counted-buffer',
  title: 'Productor/Consumidor: buffer limitado',
  category: 'MONITORS',
  variant: 'SOLUTION',
  description: 'Un monitor protege una cola de capacidad dos; notFull y notEmpty suspenden sin busy waiting y notifican cada cambio relevante.',
  recommendedScheduler: 'FIRST_READY',
  source: `monitor BoundedBuffer {
    queue<int> items = queue[];
    int capacity = 2;
    int count = 0;
    cond notFull, notEmpty;

    procedure put(in int value) {
        while (count == capacity) {
            wait(notFull);
        }

        items.enqueue(value);
        count = count + 1;
        signal(notEmpty);
    }

    procedure take(out int value) {
        while (count == 0) {
            wait(notEmpty);
        }

        value = items.dequeue();
        count = count - 1;
        signal(notFull);
    }
}

process Producer {
    BoundedBuffer.put(10);
    BoundedBuffer.put(20);
    BoundedBuffer.put(30);
}

process Consumer {
    int value;
    int[] received = [0, 0, 0];

    BoundedBuffer.take(value);
    received[0] = value;

    BoundedBuffer.take(value);
    received[1] = value;

    BoundedBuffer.take(value);
    received[2] = value;
}`,
} satisfies ProgramExample

export const monitorExamples = [
  monitorBoundedBufferProblemExample,
  monitorBoundedBufferExample,
] as const satisfies readonly ProgramExample[]
