import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PricingModule } from '../pricing/pricing.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [PricingModule, WebhooksModule],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService], // QR scan modülü kullanır
})
export class OrdersModule {}
