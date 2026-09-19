import type { ProgramExample } from './ProgramExample'

export const messagePassingEmptyRaceProblemExample = {
  id: 'message-passing-client-server-empty-problem',
  topicId: 'client-server',
  title: 'Clientes y servidor: respuestas privadas',
  category: 'MESSAGE_PASSING',
  variant: 'PROBLEM',
  description: 'Dos servidores ven el mismo pedido con !empty(requests), pero la observación no lo reserva: uno consume y el otro queda bloqueado.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `chan requests(int, int);
chan replies[1](int);

process Client {
    int response = 0;

    send requests(0, 10);
    receive replies[0](response);
}

process Server[id:0..1] {
    int clientId;
    int value;
    bool sawRequest = !empty(requests);

    if (sawRequest) {
        receive requests(clientId, value);
        send replies[clientId](value * 2);
    }
}`,
} satisfies ProgramExample

export const messagePassingClientServerExample = {
  id: 'message-passing-client-server',
  topicId: 'client-server',
  title: 'Clientes y servidor: respuestas privadas',
  category: 'MESSAGE_PASSING',
  variant: 'SOLUTION',
  description: 'Tres clientes envían pedidos a un canal compartido; el servidor responde por el canal privado indexado de cada cliente.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `chan requests(int, int);
chan replies[3](int);

process Client[id:0..2] {
    int request = (id + 1) * 10;
    int response = 0;

    send requests(id, request);
    receive replies[id](response);
}

process Server {
    int clientId;
    int value;

    receive requests(clientId, value);
    send replies[clientId](value * 2);

    receive requests(clientId, value);
    send replies[clientId](value * 2);

    receive requests(clientId, value);
    send replies[clientId](value * 2);
}`,
} satisfies ProgramExample

export const messagePassingEventSignalingExample = {
  id: 'message-passing-event-signaling',
  topicId: 'event-signaling',
  title: 'Señalización de evento',
  category: 'MESSAGE_PASSING',
  variant: 'SOLUTION',
  description: 'El coordinador envía un mensaje de inicio; el trabajador espera bloqueado sin consultar memoria compartida.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `chan start(bool);

process Worker {
    bool began = false;
    receive start(began);
}

process Coordinator {
    send start(true);
}`,
} satisfies ProgramExample

export const messagePassingMultipleWaitersExample = {
  id: 'message-passing-multiple-waiters',
  topicId: 'multiple-waiters',
  title: 'Múltiples procesos esperando',
  category: 'MESSAGE_PASSING',
  variant: 'SOLUTION',
  description: 'Cada trabajador consume su propio mensaje de inicio; dos receptores requieren dos mensajes.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `chan start(bool);

process Worker[id:0..1] {
    bool began = false;
    receive start(began);
}

process Coordinator {
    send start(true);
    send start(true);
}`,
} satisfies ProgramExample

export const messagePassingUnitBufferExample = {
  id: 'message-passing-unit-buffer',
  topicId: 'unit-buffer',
  title: 'Productor/Consumidor: buffer unitario',
  category: 'MESSAGE_PASSING',
  variant: 'SOLUTION',
  description: 'El mensaje transporta el dato del productor al consumidor y la recepción espera hasta que esté disponible.',
  recommendedScheduler: 'ROUND_ROBIN',
  source: `chan items(int);

process Consumer {
    int consumed = 0;
    receive items(consumed);
}

process Producer {
    send items(42);
}`,
} satisfies ProgramExample

export const messagePassingExamples = [
  messagePassingEmptyRaceProblemExample,
  messagePassingClientServerExample,
  messagePassingEventSignalingExample,
  messagePassingMultipleWaitersExample,
  messagePassingUnitBufferExample,
] as const satisfies readonly ProgramExample[]
