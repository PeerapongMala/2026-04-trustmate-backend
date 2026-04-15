import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'กรุณากรอกอีเมลที่ถูกต้อง' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' })
  @MaxLength(100)
  password: string;

  @IsString()
  @MinLength(1, { message: 'กรุณากรอกนามแฝง' })
  @MaxLength(50)
  alias: string;
}
