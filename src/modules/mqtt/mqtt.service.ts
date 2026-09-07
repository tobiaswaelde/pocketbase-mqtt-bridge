import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { connect, type IClientOptions, type IPublishPacket, type MqttClient } from 'mqtt';
import { ENV } from '~/config/env';
import { resolveMqttClientId } from './client-id';

export interface MqttPublishOptions {
  retain?: boolean;
}

export type MqttMessageHandler = (topic: string, payload: string, packet: Pick<IPublishPacket, 'retain'>) => void;

export interface MqttBridgeClient {
  publish(topic: string, payload: boolean | number | string | null, options?: MqttPublishOptions): void;
  subscribe(topic: string, handler: MqttMessageHandler): () => void;
}

@Injectable()
export class MqttService implements MqttBridgeClient, OnModuleDestroy {
  private readonly client: MqttClient;
  private readonly logger = new Logger(MqttService.name);
  private readonly subscriptions = new Map<string, Set<MqttMessageHandler>>();

  constructor() {
    const options: IClientOptions = {
      clientId: resolveMqttClientId(ENV.MQTT_CLIENT_ID),
      host: ENV.MQTT_HOST,
      keepalive: 30,
      password: ENV.MQTT_PASSWORD,
      port: ENV.MQTT_PORT,
      protocol: ENV.MQTT_PROTOCOL,
      reconnectPeriod: 5000,
      username: ENV.MQTT_USERNAME,
    };
    this.client = connect(options);
    this.client.on('error', (error) => this.logger.error('MQTT connection failed', error));
    this.client.on('message', (topic, payload, packet) => this.dispatch(topic, payload.toString(), packet));
  }

  publish(topic: string, payload: boolean | number | string | null, options: MqttPublishOptions = {}) {
    this.client.publish(
      topic,
      payload === null ? '' : String(payload),
      { retain: options.retain ?? false },
      (error) => error && this.logger.error(`Failed to publish ${topic}`, error),
    );
  }

  subscribe(topic: string, handler: MqttMessageHandler) {
    let handlers = this.subscriptions.get(topic);
    if (!handlers) {
      handlers = new Set();
      this.subscriptions.set(topic, handlers);
      this.client.subscribe(topic, (error) => error && this.logger.error(`Failed to subscribe ${topic}`, error));
    }
    handlers.add(handler);
    return () => {
      const current = this.subscriptions.get(topic);
      if (!current) return;
      current.delete(handler);
      if (current.size) return;
      this.subscriptions.delete(topic);
      this.client.unsubscribe(topic);
    };
  }

  onModuleDestroy() {
    this.subscriptions.clear();
    this.client.end();
  }

  private dispatch(topic: string, payload: string, packet: Pick<IPublishPacket, 'retain'>) {
    for (const [filter, handlers] of this.subscriptions)
      if (matches(filter, topic))
        for (const handler of handlers)
          try {
            handler(topic, payload, packet);
          } catch (error) {
            this.logger.error(`MQTT handler failed for ${filter}`, error);
          }
  }
}

function matches(filter: string, topic: string) {
  const expected = filter.split('/');
  const received = topic.split('/');
  return (
    expected.every((part, index) =>
      part === '#' ? index === expected.length - 1 : part === '+' || part === received[index],
    ) &&
    (expected.at(-1) === '#' || expected.length === received.length)
  );
}
