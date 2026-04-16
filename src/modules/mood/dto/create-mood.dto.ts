import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';

const VALID_MOODS = [
  'ลั๊ลลา',
  'ประหลาดใจ',
  'ว้าวุ่น',
  'วิตกกลัว',
  'ฉุนเฉียว',
  'ขยะแขยง',
  'เศร้าซึม',
  'เบื่อหน่าย',
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
