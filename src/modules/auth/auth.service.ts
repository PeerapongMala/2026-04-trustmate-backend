import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private resend: Resend | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    const resendKey = this.config.get<string>('RESEND_API_KEY');
    if (resendKey) {
      this.resend = new Resend(resendKey);
    }
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.db.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('อีเมลนี้ถูกใช้งานแล้ว');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.db.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        alias: dto.alias,
        provider: 'local',
      },
    });

    return this.generateToken(user.id, user.email, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.db.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    return this.generateToken(user.id, user.email, user.role);
  }

  async validateGoogleUser(profile: { email: string; displayName: string }) {
    let user = await this.prisma.db.user.findUnique({
      where: { email: profile.email },
    });

    if (!user) {
      user = await this.prisma.db.user.create({
        data: {
          email: profile.email,
          alias: profile.displayName || 'นามแฝง',
          provider: 'google',
        },
      });
    }

    return this.generateToken(user.id, user.email, user.role);
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.db.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!user || user.provider !== 'local') {
      return {
        message: 'หากอีเมลนี้มีอยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านไปให้',
      };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.db.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    if (this.resend) {
      await this.resend.emails.send({
        from: 'TrustMate <onboarding@resend.dev>',
        to: email,
        subject: 'รีเซ็ตรหัสผ่าน TrustMate',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #31356E;">TrustMate — รีเซ็ตรหัสผ่าน</h2>
            <p style="color: #494F56;">คุณได้ขอรีเซ็ตรหัสผ่าน คลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่</p>
            <a href="${resetLink}" style="display: inline-block; background: #E47B18; color: white; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: bold; margin: 16px 0;">ตั้งรหัสผ่านใหม่</a>
            <p style="color: #494F56; font-size: 14px;">ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง</p>
            <p style="color: #494F56; font-size: 12px;">หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยอีเมลนี้</p>
          </div>
        `,
      });
    }

    return {
      message: 'หากอีเมลนี้มีอยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านไปให้',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.db.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('ลิงก์รีเซ็ตไม่ถูกต้องหรือหมดอายุแล้ว');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return { message: 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        alias: true,
        bio: true,
        avatarColor: true,
        provider: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }

  private generateToken(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    const accessToken = this.jwtService.sign(payload);
    return { accessToken, userId };
  }
}
