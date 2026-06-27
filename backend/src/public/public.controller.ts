import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PublicService } from './public.service';

@Controller('public')
export class PublicController {
  constructor(private readonly publicSvc: PublicService) {}

  // Auth gerektirmez — landing tüm pazarlama verisini buradan çeker.
  @Public()
  @Get('landing')
  landing() {
    return this.publicSvc.landing();
  }
}
