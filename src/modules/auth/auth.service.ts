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

  async validateGoogleToken(accessToken: string) {
    // Fetch user info from Google using the access token
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new UnauthorizedException('Google token ไม่ถูกต้อง');
    }

    const googleUser = await res.json();
    if (!googleUser.email) {
      throw new UnauthorizedException('ไม่สามารถดึงข้อมูลจาก Google ได้');
    }

    return this.validateGoogleUser({
      email: googleUser.email,
      displayName: googleUser.name || '',
    });
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
    const hashedResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.db.user.update({
      where: { id: user.id },
      data: { resetToken: hashedResetToken, resetTokenExpiry },
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

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password) {
      throw new BadRequestException('บัญชีนี้ไม่สามารถเปลี่ยนรหัสผ่านได้');
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('รหัสผ่านปัจจุบันไม่ถูกต้อง');
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.prisma.db.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    return { message: 'เปลี่ยนรหัสผ่านสำเร็จ' };
  }

  async resetPassword(token: string, newPassword: string) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.prisma.db.user.findFirst({
      where: {
        resetToken: hashedToken,
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

  async createExchangeCode(accessToken: string, userId: string): Promise<string> {
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 1000); // 60 seconds

    await this.prisma.db.oAuthExchangeCode.create({
      data: { code, userId, accessToken, expiresAt },
    });

    return code;
  }

  async exchangeCode(code: string) {
    const record = await this.prisma.db.oAuthExchangeCode.findUnique({
      where: { code },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Exchange code ไม่ถูกต้องหรือหมดอายุแล้ว');
    }

    await this.prisma.db.oAuthExchangeCode.update({
      where: { code },
      data: { usedAt: new Date() },
    });

    return { accessToken: record.accessToken, userId: record.userId };
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
