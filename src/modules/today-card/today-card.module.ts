import { Module } from '@nestjs/common';
import { TodayCardController } from './today-card.controller';
import { TodayCardService } from './today-card.service';

@Module({
  controllers: [TodayCardController],
  providers: [TodayCardService],
})
export class TodayCardModule {}
