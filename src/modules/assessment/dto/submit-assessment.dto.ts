import {
  IsArray,
  ValidateNested,
  IsString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class AnswerItem {
  @IsString()
  questionId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  score: number;
}

export class SubmitAssessmentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerItem)
  answers: AnswerItem[];
}
