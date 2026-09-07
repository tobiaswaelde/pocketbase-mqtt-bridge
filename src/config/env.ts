import * as dotenv from 'dotenv';
import { cleanEnv, num, str, url } from 'envalid';
import { normalizeEnvironment } from './environment';

dotenv.config();

const environment = cleanEnv(normalizeEnvironment(process.env), {
  CORS_ORIGIN: str({ default: '*' }),
  HOST: str({ default: '0.0.0.0' }),
  MQTT_CLIENT_ID: str({ default: '' }),
  MQTT_HOST: str(),
  MQTT_PASSWORD: str({ default: undefined }),
  MQTT_PORT: num({ default: 1883 }),
  MQTT_PROTOCOL: str({ choices: ['mqtt', 'mqtts'], default: 'mqtt' }),
  MQTT_USERNAME: str({ default: undefined }),
  POCKETBASE_API_KEY: str(),
  POCKETBASE_URL: url(),
  PORT: num({ default: 3000 }),
});

export const ENV = environment;
