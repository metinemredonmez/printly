import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

// PrismaModule (@Global) + SettingsModule (@Global) sağlanır.
@Module({
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
