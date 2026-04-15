import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AssessmentService } from './assessment.service';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('assessment')
@UseGuards(JwtAuthGuard)
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Get('questions')
  getQuestions(@Query('type') type: string = 'stress') {
    return this.assessmentService.getQuestions(type);
  }

  @Post('submit')
  submit(
    @CurrentUser('id') userId: string,
    @Query('type') type: string = 'stress',
    @Body() dto: SubmitAssessmentDto,
  ) {
    return this.assessmentService.submit(userId, type, dto);
  }

  @Get('history')
  getHistory(@CurrentUser('id') userId: string) {
    return this.assessmentService.getHistory(userId);
  }
}
