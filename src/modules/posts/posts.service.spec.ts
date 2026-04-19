import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../admin/admin.service', () => ({
  AdminService: jest.fn().mockImplementation(() => ({})),
}));
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from '../admin/admin.service';

const mockPrisma = {
  db: {
    post: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    hug: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
    report: { create: jest.fn() },
    $transaction: jest.fn((ops) => Promise.all(ops)),
  },
};

const mockAdminService = {
  moderateContent: jest.fn(),
};

describe('PostsService', () => {
  let service: PostsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AdminService, useValue: mockAdminService },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    jest.clearAllMocks();
  });

  // ==================== AI Moderation on Create ====================
  describe('create (with AI moderation)', () => {
    const dto = { content: 'วันนี้เหนื่อยมาก', tag: '#เศร้า' };

    it('should create post when moderation returns clean', async () => {
      mockAdminService.moderateContent.mockResolvedValue({ status: 'clean' });
      mockPrisma.db.post.create.mockResolvedValue({
        id: 'post-1',
        content: dto.content,
        flagStatus: 'clean',
      });

      const result = await service.create('user-1', dto);

      expect(result.id).toBe('post-1');
      expect(mockPrisma.db.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            flagStatus: 'clean',
          }),
        }),
      );
    });

    it('should create post with flagged status when moderation flags it', async () => {
      mockAdminService.moderateContent.mockResolvedValue({
        status: 'flagged',
        reason: 'suspicious content',
      });
      mockPrisma.db.post.create.mockResolvedValue({
        id: 'post-2',
        flagStatus: 'flagged',
      });

      const result = await service.create('user-1', dto);

      expect(mockPrisma.db.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            flagStatus: 'flagged',
          }),
        }),
      );
    });

    it('should throw ForbiddenException when moderation blocks content', async () => {
      mockAdminService.moderateContent.mockResolvedValue({
        status: 'blocked',
        reason: 'spam detected',
      });

      await expect(service.create('user-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.db.post.create).not.toHaveBeenCalled();
    });
  });

  // ==================== Hug ====================
  describe('hug', () => {
    it('should create hug and increment hugCount', async () => {
      mockPrisma.db.post.findUnique.mockResolvedValue({ id: 'post-1' });
      mockPrisma.db.hug.findUnique.mockResolvedValue(null);
      mockPrisma.db.hug.create.mockResolvedValue({});
      mockPrisma.db.post.update.mockResolvedValue({});

      const result = await service.hug('user-1', 'post-1');

      expect(result.message).toContain('กอดสำเร็จ');
      expect(mockPrisma.db.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { hugCount: { increment: 1 } },
        }),
      );
    });

    it('should not double-hug', async () => {
      mockPrisma.db.post.findUnique.mockResolvedValue({ id: 'post-1' });
      mockPrisma.db.hug.findUnique.mockResolvedValue({ id: 'hug-1' });

      const result = await service.hug('user-1', 'post-1');

      expect(result.message).toContain('กอดแล้ว');
      expect(mockPrisma.db.hug.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent post', async () => {
      mockPrisma.db.post.findUnique.mockResolvedValue(null);

      await expect(service.hug('user-1', 'invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==================== Unhug ====================
  describe('unhug', () => {
    it('should delete hug and decrement hugCount', async () => {
      mockPrisma.db.hug.findUnique.mockResolvedValue({ id: 'hug-1' });
      mockPrisma.db.hug.delete.mockResolvedValue({});
      mockPrisma.db.post.update.mockResolvedValue({});

      const result = await service.unhug('user-1', 'post-1');

      expect(result.message).toContain('ยกเลิกกอดสำเร็จ');
      expect(mockPrisma.db.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { hugCount: { decrement: 1 } },
        }),
      );
    });

    it('should return message if not hugged yet', async () => {
      mockPrisma.db.hug.findUnique.mockResolvedValue(null);

      const result = await service.unhug('user-1', 'post-1');

      expect(result.message).toContain('ยังไม่ได้กอด');
    });
  });

  // ==================== Report ====================
  describe('report', () => {
    it('should create report for existing post', async () => {
      mockPrisma.db.post.findUnique.mockResolvedValue({ id: 'post-1' });
      mockPrisma.db.report.create.mockResolvedValue({});

      const result = await service.report('user-1', 'post-1', 'ไม่เหมาะสม');

      expect(result.message).toContain('แจ้งรายงานสำเร็จ');
      expect(mockPrisma.db.report.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            targetType: 'post',
            targetId: 'post-1',
            reason: 'ไม่เหมาะสม',
          }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent post', async () => {
      mockPrisma.db.post.findUnique.mockResolvedValue(null);

      await expect(
        service.report('user-1', 'invalid', 'reason'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
