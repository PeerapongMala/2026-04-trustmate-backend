import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'กรุณากรอกรหัสผ่านปัจจุบัน' })
  @MaxLength(100)
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' })
  @MaxLength(100)
  newPassword: string;
}
