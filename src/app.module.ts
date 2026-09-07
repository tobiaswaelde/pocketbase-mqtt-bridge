import { Module } from '@nestjs/common';
import { BridgeModule } from './modules/bridge.module';
import { HealthModule } from './modules/health/health.module';

@Module({ imports: [BridgeModule, HealthModule] })
export class AppModule {}
