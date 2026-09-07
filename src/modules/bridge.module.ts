import { Module } from '@nestjs/common';
import { BridgeService } from './bridge.service';
import { MqttModule } from './mqtt/mqtt.module';
import { PocketBaseModule } from './pocketbase/pocketbase.module';

@Module({ imports: [MqttModule, PocketBaseModule], providers: [BridgeService] })
export class BridgeModule {}
