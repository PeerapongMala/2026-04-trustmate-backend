import { IsString, MaxLength } from 'class-validator';

export class AnswerCardDto {
  @IsString()
  @MaxLength(1000, { message: 'คำตอบยาวเกินไป' })
  answer: string;
}
