import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TodayCardService } from './today-card.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  db: {
    todayQuestion: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    todayCard: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
};

describe('TodayCardService', () => {
  let service: TodayCardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodayCardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TodayCardService>(TodayCardService);
    jest.clearAllMocks();
  });

  // ==================== getTodayCard ====================
  describe('getTodayCard', () => {
    it('should return exact-date question when one exists for today', async () => {
      const question = {
        id: 'q-1',
        question: 'วันนี้เป็นอย่างไร?',
        date: new Date(),
      };
      mockPrisma.db.todayQuestion.findUnique.mockResolvedValue(question);
      mockPrisma.db.todayCard.findUnique.mockResolvedValue(null);

      const result = await service.getTodayCard('user-1');

      expect(result.question).toMatchObject({ id: 'q-1' });
      expect(result.answer).toBeNull();
      expect(mockPrisma.db.todayQuestion.findMany).not.toHaveBeenCalled();
    });

    it('should cycle through questions via day-of-year when no exact match', async () => {
      mockPrisma.db.todayQuestion.findUnique.mockResolvedValue(null);
      const questions = [
        { id: 'q-a', question: 'A', date: new Date('2026-01-01') },
        { id: 'q-b', question: 'B', date: new Date('2026-01-02') },
        { id: 'q-c', question: 'C', date: new Date('2026-01-03') },
      ];
      mockPrisma.db.todayQuestion.findMany.mockResolvedValue(questions);
      mockPrisma.db.todayCard.findUnique.mockResolvedValue(null);

      const result = await service.getTodayCard('user-1');

      expect(result.question).not.toBeNull();
      expect(['q-a', 'q-b', 'q-c']).toContain(result.question?.id);
    });

    it('should return nulls when no questions exist at all', async () => {
      mockPrisma.db.todayQuestion.findUnique.mockResolvedValue(null);
      mockPrisma.db.todayQuestion.findMany.mockResolvedValue([]);

      const result = await service.getTodayCard('user-1');

      expect(result).toEqual({ question: null, answer: null });
    });

    it('should include existing answer when user already answered today', async () => {
      const question = { id: 'q-1', question: 'hi', date: new Date() };
      mockPrisma.db.todayQuestion.findUnique.mockResolvedValue(question);
      mockPrisma.db.todayCard.findUnique.mockResolvedValue({
        id: 'card-1',
        answer: 'ดีครับ',
        createdAt: new Date('2026-01-05'),
      });

      const result = await service.getTodayCard('user-1');

      expect(result.answer).toMatchObject({ id: 'card-1', answer: 'ดีครับ' });
    });
  });

  // ==================== answerCard ====================
  describe('answerCard', () => {
    it('should create a new card when none exists', async () => {
      const question = { id: 'q-1', question: 'hi', date: new Date() };
      mockPrisma.db.todayQuestion.findUnique.mockResolvedValue(question);
      mockPrisma.db.todayCard.findUnique.mockResolvedValue(null);
      mockPrisma.db.todayCard.create.mockResolvedValue({ id: 'card-new' });

      const result = await service.answerCard('user-1', { answer: 'สบายดี' });

      expect(mockPrisma.db.todayCard.create).toHaveBeenCalledWith({
        data: { answer: 'สบายดี', questionId: 'q-1', userId: 'user-1' },
      });
      expect(result).toMatchObject({ id: 'card-new' });
    });

    it('should throw ConflictException when user already answered', async () => {
      mockPrisma.db.todayQuestion.findUnique.mockResolvedValue({ id: 'q-1' });
      mockPrisma.db.todayCard.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.answerCard('user-1', { answer: 'x' }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.db.todayCard.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when no questions at all', async () => {
      mockPrisma.db.todayQuestion.findUnique.mockResolvedValue(null);
      mockPrisma.db.todayQuestion.findMany.mockResolvedValue([]);

      await expect(
        service.answerCard('user-1', { answer: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use cycling question when no exact date match', async () => {
      mockPrisma.db.todayQuestion.findUnique.mockResolvedValue(null);
      mockPrisma.db.todayQuestion.findMany.mockResolvedValue([
        { id: 'q-x', date: new Date() },
      ]);
      mockPrisma.db.todayCard.findUnique.mockResolvedValue(null);
      mockPrisma.db.todayCard.create.mockResolvedValue({ id: 'c' });

      await service.answerCard('user-1', { answer: 'ok' });

      expect(mockPrisma.db.todayCard.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ questionId: 'q-x' }),
        }),
      );
    });
  });

  // ==================== getHistory ====================
  describe('getHistory', () => {
    it('should include question relation and order by newest', async () => {
      mockPrisma.db.todayCard.findMany.mockResolvedValue([]);

      await service.getHistory('user-1');

      expect(mockPrisma.db.todayCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          orderBy: { createdAt: 'desc' },
          include: expect.objectContaining({
            question: expect.any(Object),
          }),
        }),
      );
    });
  });
});
