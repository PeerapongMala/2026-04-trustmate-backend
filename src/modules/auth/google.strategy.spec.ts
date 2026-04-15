import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleStrategy } from './google.strategy';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

// Mock passport-google-oauth20 to avoid needing real OAuth credentials
jest.mock('passport-google-oauth20', () => {
  return {
    Strategy: class MockGoogleStrategy {
      constructor(_options: unknown, _verify: unknown) {
        // no-op
      }
    },
    VerifyCallback: jest.fn(),
  };
});

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_CALLBACK_URL: 'http://localhost:3001/auth/google/callback',
    };
    return config[key] ?? '';
  }),
};

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleStrategy,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    strategy = module.get<GoogleStrategy>(GoogleStrategy);
  });

  // ==================== validate ====================
  describe('validate', () => {
    it('should call done with extracted user from Google profile', () => {
      const profile = {
        emails: [{ value: 'google@test.com' }],
        displayName: 'Google User',
      };
      const doneMock = jest.fn();

      strategy.validate('access-token', 'refresh-token', profile, doneMock);

      expect(doneMock).toHaveBeenCalledWith(null, {
        email: 'google@test.com',
        displayName: 'Google User',
      });
    });

    it('should extract first email from profile emails array', () => {
      const profile = {
        emails: [
          { value: 'primary@test.com' },
          { value: 'secondary@test.com' },
        ],
        displayName: 'Test User',
      };
      const doneMock = jest.fn();

      strategy.validate('token', 'refresh', profile, doneMock);

      const calledUser = doneMock.mock.calls[0][1];
      expect(calledUser.email).toBe('primary@test.com');
    });

    it('should pass displayName as-is to done callback', () => {
      const profile = {
        emails: [{ value: 'test@test.com' }],
        displayName: 'John Doe',
      };
      const doneMock = jest.fn();

      strategy.validate('token', 'refresh', profile, doneMock);

      const calledUser = doneMock.mock.calls[0][1];
      expect(calledUser.displayName).toBe('John Doe');
    });

    it('should call done with null error (no error)', () => {
      const profile = {
        emails: [{ value: 'user@test.com' }],
        displayName: 'Normal User',
      };
      const doneMock = jest.fn();

      strategy.validate('token', 'refresh', profile, doneMock);

      expect(doneMock).toHaveBeenCalledWith(null, expect.any(Object));
      expect(doneMock.mock.calls[0][0]).toBeNull();
    });

    it('should handle Thai display names', () => {
      const profile = {
        emails: [{ value: 'thai@test.com' }],
        displayName: 'ผู้ใช้ทดสอบ',
      };
      const doneMock = jest.fn();

      strategy.validate('token', 'refresh', profile, doneMock);

      const calledUser = doneMock.mock.calls[0][1];
      expect(calledUser.displayName).toBe('ผู้ใช้ทดสอบ');
    });
  });
});
