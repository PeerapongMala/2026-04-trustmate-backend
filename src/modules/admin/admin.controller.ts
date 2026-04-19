import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboardStats();
  }

  // Posts
  @Get('posts')
  getPosts(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getPosts(
      status,
      page ? Math.max(parseInt(page, 10) || 1, 1) : 1,
      limit ? Math.min(parseInt(limit, 10) || 20, 100) : 20,
    );
  }

  @Patch('posts/:id/flag')
  updatePostFlag(
    @Param('id') id: string,
    @Body('flagStatus') flagStatus: 'clean' | 'flagged' | 'blocked',
  ) {
    return this.adminService.updatePostFlag(id, flagStatus);
  }

  @Delete('posts/:id')
  deletePost(@Param('id') id: string) {
    return this.adminService.deletePost(id);
  }

  // Reports
  @Get('reports')
  getReports(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getReports(
      status || 'pending',
      page ? Math.max(parseInt(page, 10) || 1, 1) : 1,
      limit ? Math.min(parseInt(limit, 10) || 20, 100) : 20,
    );
  }

  @Patch('reports/:id')
  reviewReport(
    @Param('id') id: string,
    @Body('action') action: 'reviewed' | 'dismissed',
  ) {
    return this.adminService.reviewReport(id, action);
  }

  // Users
  @Post('users/:id/ban')
  banUser(@Param('id') id: string) {
    return this.adminService.banUser(id);
  }

  @Post('users/:id/unban')
  unbanUser(@Param('id') id: string) {
    return this.adminService.unbanUser(id);
  }

  // Therapists
  @Post('therapists')
  createTherapist(
    @Body()
    body: {
      name: string;
      title: string;
      specialties: string[];
      location: string;
      clinic: string;
      pricePerSlot: number;
    },
  ) {
    return this.adminService.createTherapist(body);
  }

  @Patch('therapists/:id')
  updateTherapist(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.updateTherapist(
      id,
      body as Parameters<AdminService['updateTherapist']>[1],
    );
  }

  @Delete('therapists/:id')
  deleteTherapist(@Param('id') id: string) {
    return this.adminService.deleteTherapist(id);
  }

  // Time Slots
  @Post('therapists/:id/slots')
  createTimeSlots(
    @Param('id') therapistId: string,
    @Body('slots')
    slots: { date: string; startTime: string; endTime: string }[],
  ) {
    return this.adminService.createTimeSlots(therapistId, slots);
  }

  // Assessment Questions
  @Post('assessment-questions')
  createAssessmentQuestion(
    @Body('text') text: string,
    @Body('order') order: number,
  ) {
    return this.adminService.createAssessmentQuestion(text, order);
  }

  // Today Questions
  @Post('today-questions')
  createTodayQuestion(
    @Body('question') question: string,
    @Body('date') date: string,
  ) {
    return this.adminService.createTodayQuestion(question, date);
  }
}
