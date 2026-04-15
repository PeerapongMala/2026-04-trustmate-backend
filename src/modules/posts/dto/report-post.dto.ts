import { IsString, MaxLength } from 'class-validator';

export class ReportPostDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}
