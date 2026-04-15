import { IsString, IsOptional, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MaxLength(2000, { message: 'ข้อความยาวเกินไป' })
  message: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}
