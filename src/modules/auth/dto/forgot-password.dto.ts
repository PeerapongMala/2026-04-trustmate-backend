import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'กรุณากรอกอีเมลที่ถูกต้อง' })
  email: string;
}
