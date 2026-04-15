import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';

const VALID_TAGS = [
  '#เศร้า',
  '#สุขใจ',
  '#หวาดกลัว',
  '#หงุดหงิด',
  '#ประหลาดใจ',
  '#ตื่นเต้น',
  '#โกรธ',
  '#อื่นๆ',
];

export class CreatePostDto {
  @IsString()
  @MaxLength(2000, { message: 'โพสต์ยาวเกินไป (สูงสุด 2000 ตัวอักษร)' })
  content: string;

  @IsString()
  @IsIn(VALID_TAGS, { message: 'tag ไม่ถูกต้อง' })
  tag: string;

  @IsOptional()
  @IsString()
  @IsIn(['public', 'anonymous'], { message: 'visibility ไม่ถูกต้อง' })
  visibility?: string;
}
