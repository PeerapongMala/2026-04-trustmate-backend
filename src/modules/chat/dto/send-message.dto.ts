import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MaxLength(2000, { message: 'ข้อความยาวเกินไป' })
  message: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;
}
