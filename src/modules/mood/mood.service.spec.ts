import { Test, TestingModule } from '@nestjs/testing';
import { MoodService } from './mood.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  db: {
    moodEntry: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
};

describe('MoodService', () => {
  let service: MoodService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoodService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MoodService>(MoodService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a mood entry with userId, mood, and note', async () => {
      mockPrisma.db.moodEntry.create.mockResolvedValue({ id: 'm-1' });

      await service.create('user-1', { mood: 'เศร้าซึม', note: 'เหนื่อยมาก' });

      expect(mockPrisma.db.moodEntry.create).toHaveBeenCalledWith({
        data: { mood: 'เศร้าซึม', note: 'เหนื่อยมาก', userId: 'user-1' },
      });
    });

    it('should allow note to be optional (undefined)', async () => {
      mockPrisma.db.moodEntry.create.mockResolvedValue({ id: 'm-2' });

      await service.create('user-1', { mood: 'ลั๊ลลา' });

      expect(mockPrisma.db.moodEntry.create).toHaveBeenCalledWith({
        data: { mood: 'ลั๊ลลา', note: undefined, userId: 'user-1' },
      });
    });
  });

  describe('getHistory', () => {
    it('should return the last 30 entries by default ordered by newest first', async () => {
      mockPrisma.db.moodEntry.findMany.mockResolvedValue([{ id: 'm-1' }]);

      await service.getHistory('user-1');

      expect(mockPrisma.db.moodEntry.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
    });

    it('should respect a custom limit', async () => {
      mockPrisma.db.moodEntry.findMany.mockResolvedValue([]);

      await service.getHistory('user-1', 7);

      expect(mockPrisma.db.moodEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 7 }),
      );
    });

    it('should scope results to the requesting userId', async () => {
      mockPrisma.db.moodEntry.findMany.mockResolvedValue([]);

      await service.getHistory('user-42');

      expect(mockPrisma.db.moodEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-42' } }),
      );
    });
  });
});
