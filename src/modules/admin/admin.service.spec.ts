import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';

const mockMistralComplete = jest.fn();

jest.mock('@mistralai/mistralai', () => ({
  Mistral: jest.fn().mockImplementation(() => ({
    chat: { complete: mockMistralComplete },
  })),
}));

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  db: {
    post: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    report: {
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    user: {
      update: jest.fn(),
      count: jest.fn(),
    },
    therapist: {
      create: jest.fn(),
      update: jest.fn(),
    },
    timeSlot: {
      createMany: jest.fn(),
    },
    assessmentQuestion: {
      create: jest.fn(),
    },
    todayQuestion: {
      create: jest.fn(),
    },
    booking: {
      count: jest.fn(),
    },
  },
};

const mockConfig = {
  get: jest.fn(),
};

async function buildService(apiKey?: string): Promise<AdminService> {
  mockConfig.get.mockReturnValue(apiKey);
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AdminService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: ConfigService, useValue: mockConfig },
    ],
  }).compile();
  return module.get<AdminService>(AdminService);
}

describe('AdminService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== AI Moderation ====================
  describe('moderateContent', () => {
    it('should return clean when no API key configured (bypass)', async () => {
      const service = await buildService();

      const result = await service.moderateContent('anything');

      expect(result).toEqual({ status: 'clean', category: 'none' });
    });

    it('should return Mistral verdict when API returns valid JSON', async () => {
      const service = await buildService('test-key');
      mockMistralComplete.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                status: 'blocked',
                category: 'spam',
                reason: 'link spam',
              }),
            },
          },
        ],
      });

      const result = await service.moderateContent('buy now https://x');

      expect(result).toEqual({
        status: 'blocked',
        category: 'spam',
        reason: 'link spam',
      });
    });

    it('should flag as pending when Mistral throws (fail-safe)', async () => {
      const service = await buildService('test-key');
      mockMistralComplete.mockRejectedValue(new Error('timeout'));

      const result = await service.moderateContent('test');

      expect(result.status).toBe('flagged');
      expect(result.reason).toMatch(/manual review/i);
    });

    it('should flag as pending on invalid JSON response', async () => {
      const service = await buildService('test-key');
      mockMistralComplete.mockResolvedValue({
        choices: [{ message: { content: 'not-json' } }],
      });

      const result = await service.moderateContent('test');

      expect(result.status).toBe('flagged');
    });

    it('should default to clean/none when Mistral returns missing fields', async () => {
      const service = await buildService('test-key');
      mockMistralComplete.mockResolvedValue({
        choices: [{ message: { content: '{}' } }],
      });

      const result = await service.moderateContent('test');

      expect(result.status).toBe('clean');
      expect(result.category).toBe('none');
    });
  });

  // ==================== Posts ====================
  describe('getPosts', () => {
    it('should list posts with pagination meta', async () => {
      const service = await buildService();
      mockPrisma.db.post.findMany.mockResolvedValue([{ id: 'p-1' }]);
      mockPrisma.db.post.count.mockResolvedValue(1);

      const result = await service.getPosts(undefined, 1, 20);

      expect(result).toEqual({
        data: [{ id: 'p-1' }],
        meta: { total: 1, page: 1, limit: 20 },
      });
    });

    it('should filter by flagStatus when provided', async () => {
      const service = await buildService();
      mockPrisma.db.post.findMany.mockResolvedValue([]);
      mockPrisma.db.post.count.mockResolvedValue(0);

      await service.getPosts('flagged');

      expect(mockPrisma.db.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { flagStatus: 'flagged' } }),
      );
    });
  });

  describe('updatePostFlag', () => {
    it('should update flagStatus when post exists', async () => {
      const service = await buildService();
      mockPrisma.db.post.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrisma.db.post.update.mockResolvedValue({
        id: 'p-1',
        flagStatus: 'blocked',
      });

      const result = await service.updatePostFlag('p-1', 'blocked');

      expect(result.flagStatus).toBe('blocked');
    });

    it('should throw NotFoundException when post missing', async () => {
      const service = await buildService();
      mockPrisma.db.post.findUnique.mockResolvedValue(null);

      await expect(service.updatePostFlag('nope', 'clean')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deletePost', () => {
    it('should delete the post and return a confirmation', async () => {
      const service = await buildService();
      mockPrisma.db.post.delete.mockResolvedValue({});

      const result = await service.deletePost('p-1');

      expect(mockPrisma.db.post.delete).toHaveBeenCalledWith({
        where: { id: 'p-1' },
      });
      expect(result).toHaveProperty('message');
    });
  });

  // ==================== Reports ====================
  describe('getReports', () => {
    it('should default to status=pending', async () => {
      const service = await buildService();
      mockPrisma.db.report.findMany.mockResolvedValue([]);
      mockPrisma.db.report.count.mockResolvedValue(0);

      await service.getReports();

      expect(mockPrisma.db.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'pending' } }),
      );
    });
  });

  describe('reviewReport', () => {
    it('should update report status to reviewed', async () => {
      const service = await buildService();
      mockPrisma.db.report.update.mockResolvedValue({});

      await service.reviewReport('r-1', 'reviewed');

      expect(mockPrisma.db.report.update).toHaveBeenCalledWith({
        where: { id: 'r-1' },
        data: { status: 'reviewed' },
      });
    });

    it('should update report status to dismissed', async () => {
      const service = await buildService();
      mockPrisma.db.report.update.mockResolvedValue({});

      await service.reviewReport('r-2', 'dismissed');

      expect(mockPrisma.db.report.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'dismissed' } }),
      );
    });
  });

  // ==================== Users — Ban ====================
  describe('banUser / unbanUser', () => {
    it('banUser should set deletedAt', async () => {
      const service = await buildService();
      mockPrisma.db.user.update.mockResolvedValue({});

      await service.banUser('u-1');

      expect(mockPrisma.db.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('unbanUser should clear deletedAt', async () => {
      const service = await buildService();
      mockPrisma.db.user.update.mockResolvedValue({});

      await service.unbanUser('u-1');

      expect(mockPrisma.db.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { deletedAt: null },
      });
    });
  });

  // ==================== Therapists ====================
  describe('createTherapist / updateTherapist / deleteTherapist', () => {
    it('should create therapist with given payload', async () => {
      const service = await buildService();
      const payload = {
        name: 'Dr A',
        title: 'PhD',
        specialties: ['anxiety'],
        location: 'BKK',
        clinic: 'Clinic X',
        pricePerSlot: 500,
      };
      mockPrisma.db.therapist.create.mockResolvedValue({ id: 't-1' });

      await service.createTherapist(payload);

      expect(mockPrisma.db.therapist.create).toHaveBeenCalledWith({
        data: payload,
      });
    });

    it('should update only provided fields', async () => {
      const service = await buildService();
      mockPrisma.db.therapist.update.mockResolvedValue({});

      await service.updateTherapist('t-1', { pricePerSlot: 600 });

      expect(mockPrisma.db.therapist.update).toHaveBeenCalledWith({
        where: { id: 't-1' },
        data: { pricePerSlot: 600 },
      });
    });

    it('deleteTherapist should soft-delete via isActive=false', async () => {
      const service = await buildService();
      mockPrisma.db.therapist.update.mockResolvedValue({});

      await service.deleteTherapist('t-1');

      expect(mockPrisma.db.therapist.update).toHaveBeenCalledWith({
        where: { id: 't-1' },
        data: { isActive: false },
      });
    });
  });

  // ==================== Time slots ====================
  describe('createTimeSlots', () => {
    it('should bulk create slots with skipDuplicates', async () => {
      const service = await buildService();
      mockPrisma.db.timeSlot.createMany.mockResolvedValue({ count: 2 });

      await service.createTimeSlots('t-1', [
        { date: '2026-05-01', startTime: '09:00', endTime: '09:30' },
        { date: '2026-05-01', startTime: '10:00', endTime: '10:30' },
      ]);

      expect(mockPrisma.db.timeSlot.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ skipDuplicates: true }),
      );
    });
  });

  // ==================== Dashboard ====================
  describe('getDashboardStats', () => {
    it('should aggregate 5 counts in parallel', async () => {
      const service = await buildService();
      mockPrisma.db.user.count.mockResolvedValue(100);
      mockPrisma.db.post.count
        .mockResolvedValueOnce(200)
        .mockResolvedValueOnce(5);
      mockPrisma.db.report.count.mockResolvedValue(3);
      mockPrisma.db.booking.count.mockResolvedValue(10);

      const result = await service.getDashboardStats();

      expect(result).toEqual({
        userCount: 100,
        postCount: 200,
        flaggedCount: 5,
        pendingReports: 3,
        bookingCount: 10,
      });
    });

    it('should exclude soft-deleted users from userCount', async () => {
      const service = await buildService();
      mockPrisma.db.user.count.mockResolvedValue(0);
      mockPrisma.db.post.count.mockResolvedValue(0);
      mockPrisma.db.report.count.mockResolvedValue(0);
      mockPrisma.db.booking.count.mockResolvedValue(0);

      await service.getDashboardStats();

      expect(mockPrisma.db.user.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
    });
  });
});
