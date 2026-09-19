import type { ProgramExample } from './ProgramExample'

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

export const messagePassingExamples = [
  messagePassingClientServerExample,
] as const satisfies readonly ProgramExample[]
