import { randomUUID } from 'node:crypto';

export function resolveMqttClientId(clientId: string) {
  return clientId || randomUUID();
}
