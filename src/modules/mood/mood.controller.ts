import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { MoodService } from './mood.service';
import { CreateMoodDto } from './dto/create-mood.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('mood')
@UseGuards(JwtAuthGuard)
export class MoodController {
  constructor(private readonly moodService: MoodService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateMoodDto) {
    return this.moodService.create(userId, dto);
  }

  @Get('history')
  getHistory(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.moodService.getHistory(
      userId,
      limit ? parseInt(limit, 10) : 30,
    );
  }
}
