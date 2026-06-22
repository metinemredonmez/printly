import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { R2_CLIENT, createR2Client } from './r2.client';

@Module({
  providers: [
    FilesService,
    {
      provide: R2_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createR2Client(config),
    },
  ],
  controllers: [FilesController],
  exports: [FilesService],
})
export class FilesModule {}
