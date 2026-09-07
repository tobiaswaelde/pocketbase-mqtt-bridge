import { Global, Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';

@Global()
@Module({ exports: [MqttService], providers: [MqttService] })
export class MqttModule {}
