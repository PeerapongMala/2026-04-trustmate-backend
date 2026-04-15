import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  sendMessage(@CurrentUser('id') userId: string, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(userId, dto);
  }

  @Get('sessions')
  getSessions(@CurrentUser('id') userId: string) {
    return this.chatService.getSessions(userId);
  }

  @Get('sessions/:id')
  getMessages(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
  ) {
    return this.chatService.getMessages(userId, sessionId);
  }
}
