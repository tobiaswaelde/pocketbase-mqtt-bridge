import { Global, Module } from '@nestjs/common';
import { PocketBaseService } from './pocketbase.service';

@Global()
@Module({ exports: [PocketBaseService], providers: [PocketBaseService] })
export class PocketBaseModule {}
