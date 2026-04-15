import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';

const VALID_MOODS = [
  'เบื่อหน่าย',
  'สับสน',
  'ประหลาดใจ',
  'กลัว',
  'กังวล',
  'อาย',
  'เศร้าซึม',
  'เปล่าเปลี่ยว',
];

export class CreateMoodDto {
  @IsString()
  @IsIn(VALID_MOODS, { message: 'mood ไม่ถูกต้อง' })
  mood: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
