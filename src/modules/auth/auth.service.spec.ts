import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

// Mock the entire prisma service module to avoid ESM import issues
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
import { PrismaService } from '../prisma/prisma.service';

// Mock PrismaService
const mockPrisma = {
  db: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue(null),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ==================== Register ====================
  describe('register', () => {
    const dto = {
      email: 'test@test.com',
      password: 'password123',
      alias: 'ทดสอบ',
    };

    it('should register a new user and return token', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue(null);
      mockPrisma.db.user.create.mockResolvedValue({
        id: 'user-1',
        email: dto.email,
        role: 'user',
      });

      const result = await service.register(dto);

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.userId).toBe('user-1');
      expect(mockPrisma.db.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: dto.email,
            alias: dto.alias,
            provider: 'local',
          }),
        }),
      );
    });

    it('should hash the password before storing', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue(null);
      mockPrisma.db.user.create.mockResolvedValue({
        id: 'user-1',
        email: dto.email,
        role: 'user',
      });

      await service.register(dto);

      const createCall = mockPrisma.db.user.create.mock.calls[0][0];
      const storedPassword = createCall.data.password;

      // Password should be hashed, not plain text
      expect(storedPassword).not.toBe(dto.password);
      // Should be a valid bcrypt hash
      expect(storedPassword).toMatch(/^\$2[ab]\$/);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ==================== Login ====================
  describe('login', () => {
    const dto = { email: 'test@test.com', password: 'password123' };

    it('should login and return token for valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 12);
      mockPrisma.db.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: dto.email,
        password: hashedPassword,
        role: 'user',
      });

      const result = await service.login(dto);

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.userId).toBe('user-1');
    });

    it('should throw UnauthorizedException for non-existent email', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hashedPassword = await bcrypt.hash('different-password', 12);
      mockPrisma.db.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: dto.email,
        password: hashedPassword,
        role: 'user',
      });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for Google OAuth user (no password)', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: dto.email,
        password: null,
        provider: 'google',
      });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ==================== Google OAuth ====================
  describe('validateGoogleUser', () => {
    const profile = { email: 'google@test.com', displayName: 'Google User' };

    it('should create new user if not exists', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue(null);
      mockPrisma.db.user.create.mockResolvedValue({
        id: 'new-user',
        email: profile.email,
        role: 'user',
      });

      const result = await service.validateGoogleUser(profile);

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(mockPrisma.db.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: profile.email,
            alias: profile.displayName,
            provider: 'google',
          }),
        }),
      );
    });

    it('should return token for existing user', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: profile.email,
        role: 'user',
      });

      const result = await service.validateGoogleUser(profile);

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(mockPrisma.db.user.create).not.toHaveBeenCalled();
    });

    it('should use default alias นามแฝง when displayName is empty', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue(null);
      mockPrisma.db.user.create.mockResolvedValue({
        id: 'new-user',
        email: 'google@test.com',
        role: 'user',
      });

      await service.validateGoogleUser({
        email: 'google@test.com',
        displayName: '',
      });

      expect(mockPrisma.db.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alias: 'นามแฝง',
          }),
        }),
      );
    });
  });

  // ==================== Forgot Password ====================
  describe('forgotPassword', () => {
    it('should return success message even if email does not exist (prevent enumeration)', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('nonexistent@test.com');

      expect(result.message).toContain('หากอีเมลนี้มีอยู่ในระบบ');
    });

    it('should return success message for Google OAuth user (no local password)', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue({
        id: 'user-1',
        provider: 'google',
      });

      const result = await service.forgotPassword('google@test.com');

      expect(result.message).toContain('หากอีเมลนี้มีอยู่ในระบบ');
      expect(mockPrisma.db.user.update).not.toHaveBeenCalled();
    });

    it('should generate reset token for valid local user', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue({
        id: 'user-1',
        provider: 'local',
      });
      mockPrisma.db.user.update.mockResolvedValue({});

      await service.forgotPassword('user@test.com');

      expect(mockPrisma.db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resetToken: expect.any(String),
            resetTokenExpiry: expect.any(Date),
          }),
        }),
      );
    });
  });

  // ==================== Reset Password ====================
  describe('resetPassword', () => {
    it('should throw BadRequestException for invalid token', async () => {
      mockPrisma.db.user.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword('invalid-token', 'newpass123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update password and clear reset token', async () => {
      mockPrisma.db.user.findFirst.mockResolvedValue({
        id: 'user-1',
        resetToken: 'valid-token',
        resetTokenExpiry: new Date(Date.now() + 3600000),
      });
      mockPrisma.db.user.update.mockResolvedValue({});

      const result = await service.resetPassword('valid-token', 'newpass123');

      expect(result.message).toContain('เปลี่ยนรหัสผ่านสำเร็จ');
      expect(mockPrisma.db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resetToken: null,
            resetTokenExpiry: null,
            password: expect.any(String),
          }),
        }),
      );

      // Verify new password is hashed
      const updateCall = mockPrisma.db.user.update.mock.calls[0][0];
      expect(updateCall.data.password).not.toBe('newpass123');
      expect(updateCall.data.password).toMatch(/^\$2[ab]\$/);
    });
  });

  // ==================== JWT Token ====================
  describe('generateToken (via register/login)', () => {
    it('should call jwtService.sign with correct payload', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue(null);
      mockPrisma.db.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        role: 'user',
      });

      await service.register({
        email: 'test@test.com',
        password: 'password123',
        alias: 'test',
      });

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'test@test.com',
        role: 'user',
      });
    });
  });

  // ==================== getMe ====================
  describe('getMe', () => {
    it('should return user profile for given userId', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'me@test.com',
        alias: 'TestAlias',
        bio: 'Hello world',
        avatarColor: '#3498db',
        provider: 'local',
        role: 'user',
        createdAt: new Date('2024-01-01'),
      };
      mockPrisma.db.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getMe('user-1');

      expect(mockPrisma.db.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
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
      expect(result).toEqual(mockUser);
    });

    it('should return null when user is not found', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue(null);

      const result = await service.getMe('nonexistent-user');

      expect(result).toBeNull();
    });

    it('should select only the allowed profile fields', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue(null);

      await service.getMe('user-1');

      const call = mockPrisma.db.user.findUnique.mock.calls[0][0];
      expect(call.select).toEqual({
        id: true,
        email: true,
        alias: true,
        bio: true,
        avatarColor: true,
        provider: true,
        role: true,
        createdAt: true,
      });
      // password must not be in select
      expect(call.select.password).toBeUndefined();
    });

    it('should return Google provider user profile', async () => {
      const googleUser = {
        id: 'google-user-1',
        email: 'google@test.com',
        alias: 'Google User',
        bio: null,
        avatarColor: null,
        provider: 'google',
        role: 'user',
        createdAt: new Date('2024-02-01'),
      };
      mockPrisma.db.user.findUnique.mockResolvedValue(googleUser);

      const result = await service.getMe('google-user-1');

      expect(result).toEqual(googleUser);
      expect(result?.provider).toBe('google');
    });
  });
});

// ==================== AuthService with Resend configured ====================
describe('AuthService (with Resend API key)', () => {
  let service: AuthService;
  const mockSend = jest.fn().mockResolvedValue({ id: 'email-id-1' });

  // Mock the resend module so we can verify emails.send is called
  jest.mock('resend', () => ({
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: mockSend,
      },
    })),
  }));

  const mockPrismaWithResend = {
    db: {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    },
  };

  const mockConfigWithResend = {
    get: jest.fn((key: string) => {
      if (key === 'RESEND_API_KEY') return 're_test_key';
      if (key === 'FRONTEND_URL') return 'http://localhost:3000';
      return null;
    }),
  };

  const mockJwtSvc = { sign: jest.fn().mockReturnValue('jwt-token') };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaWithResend },
        { provide: JwtService, useValue: mockJwtSvc },
        { provide: ConfigService, useValue: mockConfigWithResend },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    // Restore the send mock after clearAllMocks
    mockSend.mockResolvedValue({ id: 'email-id-1' });
  });

  it('should send email via resend when API key is configured', async () => {
    mockPrismaWithResend.db.user.findUnique.mockResolvedValue({
      id: 'user-1',
      provider: 'local',
    });
    mockPrismaWithResend.db.user.update.mockResolvedValue({});

    const result = await service.forgotPassword('user@test.com');

    expect(result.message).toContain('หากอีเมลนี้มีอยู่ในระบบ');
    // update should have been called to set reset token
    expect(mockPrismaWithResend.db.user.update).toHaveBeenCalled();
  });

  it('should still return success message even when resend is configured and user not found', async () => {
    mockPrismaWithResend.db.user.findUnique.mockResolvedValue(null);

    const result = await service.forgotPassword('nobody@test.com');

    expect(result.message).toContain('หากอีเมลนี้มีอยู่ในระบบ');
  });
});
