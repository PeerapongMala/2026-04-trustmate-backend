import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { TodayCardService } from './today-card.service';
import { AnswerCardDto } from './dto/answer-card.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('today-card')
@UseGuards(JwtAuthGuard)
export class TodayCardController {
  constructor(private readonly todayCardService: TodayCardService) {}

  @Get()
  getTodayCard(@CurrentUser('id') userId: string) {
    return this.todayCardService.getTodayCard(userId);
  }

  @Post()
  answerCard(@CurrentUser('id') userId: string, @Body() dto: AnswerCardDto) {
    return this.todayCardService.answerCard(userId, dto);
  }

  @Get('history')
  getHistory(@CurrentUser('id') userId: string) {
    return this.todayCardService.getHistory(userId);
  }
}
