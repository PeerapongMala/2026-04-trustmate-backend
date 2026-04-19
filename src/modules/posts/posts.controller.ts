import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { ReportPostDto } from './dto/report-post.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreatePostDto) {
    return this.postsService.create(userId, dto);
  }

  @Get('me')
  findMyPosts(@CurrentUser('id') userId: string) {
    return this.postsService.findByUser(userId);
  }

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Query('tag') tag?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.postsService.findAll(
      userId,
      tag,
      page ? Math.max(parseInt(page, 10) || 1, 1) : 1,
      limit ? Math.min(parseInt(limit, 10) || 20, 100) : 20,
    );
  }

  @Post(':id/hug')
  hug(@CurrentUser('id') userId: string, @Param('id') postId: string) {
    return this.postsService.hug(userId, postId);
  }

  @Delete(':id/hug')
  unhug(@CurrentUser('id') userId: string, @Param('id') postId: string) {
    return this.postsService.unhug(userId, postId);
  }

  @Post(':id/report')
  report(
    @CurrentUser('id') userId: string,
    @Param('id') postId: string,
    @Body() dto: ReportPostDto,
  ) {
    return this.postsService.report(userId, postId, dto.reason);
  }
}
