import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  db: {
    user: {
      findUnique: jest.fn(),
    },
  },
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('test-jwt-secret'),
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    jest.clearAllMocks();
  });

  // ==================== validate ====================
  describe('validate', () => {
    const payload = { sub: 'user-1', email: 'user@test.com', role: 'user' };

    it('should return user when found and not deleted', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@test.com',
        role: 'user',
        alias: 'TestUser',
        deletedAt: null,
      };
      mockPrisma.db.user.findUnique.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(mockPrisma.db.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: {
          id: true,
          email: true,
          role: true,
          alias: true,
          deletedAt: true,
        },
      });
      expect(result).toEqual({
        id: 'user-1',
        email: 'user@test.com',
        role: 'user',
        alias: 'TestUser',
      });
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is soft-deleted (deletedAt set)', async () => {
      const deletedUser = {
        id: 'user-1',
        email: 'user@test.com',
        role: 'user',
        alias: 'Deleted',
        deletedAt: new Date('2024-01-01'),
      };
      mockPrisma.db.user.findUnique.mockResolvedValue(deletedUser);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should not include deletedAt in the returned user object', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@test.com',
        role: 'user',
        alias: 'TestUser',
        deletedAt: null,
      };
      mockPrisma.db.user.findUnique.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).not.toHaveProperty('deletedAt');
    });

    it('should use sub field from payload as user id for lookup', async () => {
      const mockUser = {
        id: 'user-42',
        email: 'another@test.com',
        role: 'admin',
        alias: 'Admin',
        deletedAt: null,
      };
      mockPrisma.db.user.findUnique.mockResolvedValue(mockUser);

      const adminPayload = {
        sub: 'user-42',
        email: 'another@test.com',
        role: 'admin',
      };
      await strategy.validate(adminPayload);

      expect(mockPrisma.db.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-42' } }),
      );
    });

    it('should return admin role when user has admin role', async () => {
      const adminUser = {
        id: 'admin-1',
        email: 'admin@test.com',
        role: 'admin',
        alias: 'SuperAdmin',
        deletedAt: null,
      };
      mockPrisma.db.user.findUnique.mockResolvedValue(adminUser);

      const result = await strategy.validate({
        sub: 'admin-1',
        email: 'admin@test.com',
        role: 'admin',
      });

      expect(result.role).toBe('admin');
    });
  });
});
