import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GoogleAuthGuard } from '../../common/guards/google-auth.guard';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  validateGoogleUser: jest.fn(),
  validateGoogleToken: jest.fn(),
  createExchangeCode: jest.fn(),
  exchangeCode: jest.fn(),
  getMe: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('http://localhost:3000'),
};

const mockJwtAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };
const mockGoogleAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(GoogleAuthGuard)
      .useValue(mockGoogleAuthGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
    // Reset configService mock to default
    mockConfigService.get.mockReturnValue('http://localhost:3000');
  });

  // ==================== register ====================
  describe('register', () => {
    const registerDto = {
      email: 'test@test.com',
      password: 'password123',
      alias: 'ทดสอบ',
    };

    it('should call authService.register and return token', async () => {
      const expected = { accessToken: 'jwt-token', userId: 'user-1' };
      mockAuthService.register.mockResolvedValue(expected);

      const result = await controller.register(registerDto);

      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(expected);
    });

    it('should propagate errors from authService.register', async () => {
      mockAuthService.register.mockRejectedValue(
        new ConflictException('อีเมลนี้ถูกใช้งานแล้ว'),
      );

      await expect(controller.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ==================== login ====================
  describe('login', () => {
    const loginDto = { email: 'test@test.com', password: 'password123' };

    it('should call authService.login and return token', async () => {
      const expected = { accessToken: 'jwt-token', userId: 'user-1' };
      mockAuthService.login.mockResolvedValue(expected);

      const result = await controller.login(loginDto);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(expected);
    });

    it('should propagate UnauthorizedException from authService.login', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('อีเมลหรือรหัสผ่านไม่ถูกต้อง'),
      );

      await expect(controller.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ==================== forgotPassword ====================
  describe('forgotPassword', () => {
    it('should call authService.forgotPassword with email from dto', async () => {
      const dto = { email: 'user@test.com' };
      const expected = {
        message: 'หากอีเมลนี้มีอยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านไปให้',
      };
      mockAuthService.forgotPassword.mockResolvedValue(expected);

      const result = await controller.forgotPassword(dto);

      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(dto.email);
      expect(result).toEqual(expected);
    });

    it('should return success message regardless of email existence', async () => {
      mockAuthService.forgotPassword.mockResolvedValue({
        message: 'หากอีเมลนี้มีอยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านไปให้',
      });

      const result = await controller.forgotPassword({
        email: 'nobody@test.com',
      });

      expect(result.message).toContain('หากอีเมลนี้มีอยู่ในระบบ');
    });
  });

  // ==================== resetPassword ====================
  describe('resetPassword', () => {
    it('should call authService.resetPassword with token and newPassword', async () => {
      const dto = { token: 'reset-token-123', newPassword: 'newpass456' };
      const expected = {
        message: 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่',
      };
      mockAuthService.resetPassword.mockResolvedValue(expected);

      const result = await controller.resetPassword(dto);

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        dto.token,
        dto.newPassword,
      );
      expect(result).toEqual(expected);
    });

    it('should propagate BadRequestException for invalid token', async () => {
      mockAuthService.resetPassword.mockRejectedValue(
        new BadRequestException('ลิงก์รีเซ็ตไม่ถูกต้องหรือหมดอายุแล้ว'),
      );

      await expect(
        controller.resetPassword({
          token: 'bad-token',
          newPassword: 'newpass',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==================== googleLogin ====================
  describe('googleLogin', () => {
    it('should exist and be callable (redirect handled by guard)', () => {
      // GoogleAuthGuard handles the redirect; this route returns nothing
      const result = controller.googleLogin();
      expect(result).toBeUndefined();
    });
  });

  // ==================== googleCallback ====================
  describe('googleCallback', () => {
    it('should redirect to frontend with short-lived exchange code (not JWT)', async () => {
      const mockResult = { accessToken: 'google-jwt-token', userId: 'user-1' };
      mockAuthService.validateGoogleUser.mockResolvedValue(mockResult);
      mockAuthService.createExchangeCode.mockResolvedValue('short-code-123');
      mockConfigService.get.mockReturnValue('http://localhost:3000');

      const mockReq = {
        user: { email: 'google@test.com', displayName: 'Google User' },
      };
      const mockRes = { redirect: jest.fn() };

      await controller.googleCallback(mockReq as any, mockRes as any);

      expect(mockAuthService.validateGoogleUser).toHaveBeenCalledWith(
        mockReq.user,
      );
      expect(mockAuthService.createExchangeCode).toHaveBeenCalledWith(
        'google-jwt-token',
        'user-1',
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/auth/google/callback?code=short-code-123',
      );
      // Critical: JWT must NOT appear in the redirect URL
      const redirectUrl = mockRes.redirect.mock.calls[0][0];
      expect(redirectUrl).not.toContain('google-jwt-token');
      expect(redirectUrl).not.toContain('token=');
    });

    it('should use fallback frontend URL when config returns undefined', async () => {
      mockAuthService.validateGoogleUser.mockResolvedValue({
        accessToken: 'token-123',
        userId: 'user-2',
      });
      mockAuthService.createExchangeCode.mockResolvedValue('code-abc');
      mockConfigService.get.mockReturnValue(undefined);

      const mockReq = {
        user: { email: 'test@google.com', displayName: 'Test' },
      };
      const mockRes = { redirect: jest.fn() };

      await controller.googleCallback(mockReq as any, mockRes as any);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/auth/google/callback?code=code-abc',
      );
    });
  });

  // ==================== googleExchange ====================
  describe('googleExchange', () => {
    it('should delegate to authService.exchangeCode', async () => {
      mockAuthService.exchangeCode.mockResolvedValue({
        accessToken: 'jwt-out',
        userId: 'u-1',
      });

      const result = await controller.googleExchange({ code: 'c-1' });

      expect(result).toEqual({ accessToken: 'jwt-out', userId: 'u-1' });
      expect(mockAuthService.exchangeCode).toHaveBeenCalledWith('c-1');
    });
  });

  // ==================== getMe ====================
  describe('getMe', () => {
    it('should call authService.getMe with the userId from current user', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'me@test.com',
        alias: 'MyAlias',
        bio: 'Hello',
        avatarColor: '#fff',
        provider: 'local',
        role: 'user',
        createdAt: new Date(),
      };
      mockAuthService.getMe.mockResolvedValue(mockUser);

      const result = await controller.getMe('user-1');

      expect(mockAuthService.getMe).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockUser);
    });

    it('should return null when user is not found', async () => {
      mockAuthService.getMe.mockResolvedValue(null);

      const result = await controller.getMe('nonexistent-user');

      expect(result).toBeNull();
    });
  });
});
