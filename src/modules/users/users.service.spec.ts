import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  db: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return user with safe public fields when found', async () => {
      const user = {
        id: 'u-1',
        email: 'a@b.com',
        alias: 'Anon',
        bio: 'hi',
        avatarColor: '#D8E1ED',
        provider: 'local',
        role: 'user',
        createdAt: new Date(),
      };
      mockPrisma.db.user.findUnique.mockResolvedValue(user);

      const result = await service.getProfile('u-1');

      expect(result).toEqual(user);
    });

    it('should never select password/resetToken fields', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue({ id: 'u-1' });

      await service.getProfile('u-1');

      const call = mockPrisma.db.user.findUnique.mock.calls[0][0];
      expect(call.select).not.toHaveProperty('password');
      expect(call.select).not.toHaveProperty('resetToken');
    });

    it('should throw NotFoundException when user missing', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteAccount', () => {
    it('should soft-delete by setting deletedAt', async () => {
      mockPrisma.db.user.update.mockResolvedValue({});

      const result = await service.deleteAccount('u-1');

      expect(mockPrisma.db.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result).toHaveProperty('message');
    });
  });

  describe('updateProfile', () => {
    it('should update mutable fields and return fresh profile', async () => {
      const updated = {
        id: 'u-1',
        email: 'a@b.com',
        alias: 'NewAlias',
        bio: 'hello',
        avatarColor: '#31356E',
        provider: 'local',
        role: 'user',
        createdAt: new Date(),
      };
      mockPrisma.db.user.update.mockResolvedValue(updated);

      const result = await service.updateProfile('u-1', {
        alias: 'NewAlias',
        bio: 'hello',
        avatarColor: '#31356E',
      });

      expect(result).toEqual(updated);
      expect(mockPrisma.db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u-1' } }),
      );
    });

    it('should allow-list only alias/bio/avatarColor (reject arbitrary fields)', async () => {
      mockPrisma.db.user.update.mockResolvedValue({});

      // Attacker-style payload: DTO augmented with fields that must never
      // reach Prisma (role escalation, password reset, undelete).
      const maliciousDto = {
        alias: 'New',
        role: 'admin',
        password: 'evil',
        deletedAt: null,
      } as unknown as Parameters<typeof service.updateProfile>[1];

      await service.updateProfile('u-1', maliciousDto);

      const data = mockPrisma.db.user.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('role');
      expect(data).not.toHaveProperty('password');
      expect(data).not.toHaveProperty('deletedAt');
      expect(data.alias).toBe('New');
    });
  });
});
