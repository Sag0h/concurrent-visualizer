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

export const messagePassingExamples = [
  messagePassingEmptyRaceProblemExample,
  messagePassingClientServerExample,
] as const satisfies readonly ProgramExample[]
