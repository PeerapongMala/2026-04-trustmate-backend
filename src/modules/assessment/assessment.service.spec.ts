import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentService } from './assessment.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  db: {
    assessmentQuestion: {
      findMany: jest.fn(),
    },
    assessmentResult: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
};

describe('AssessmentService', () => {
  let service: AssessmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AssessmentService>(AssessmentService);
    jest.clearAllMocks();
  });

  // ==================== getQuestions ====================
  describe('getQuestions', () => {
    it('should query stress questions with stress- prefix', async () => {
      const mockQuestions = [
        { id: 'stress-1', text: 'Q1', order: 1 },
        { id: 'stress-2', text: 'Q2', order: 2 },
      ];
      mockPrisma.db.assessmentQuestion.findMany.mockResolvedValue(
        mockQuestions,
      );

      const result = await service.getQuestions('stress');

      expect(mockPrisma.db.assessmentQuestion.findMany).toHaveBeenCalledWith({
        where: { id: { startsWith: 'stress-' } },
        orderBy: { order: 'asc' },
      });
      expect(result).toEqual(mockQuestions);
    });

    it('should query depression questions with phq9- prefix', async () => {
      const mockQuestions = [{ id: 'phq9-1', text: 'Q1', order: 1 }];
      mockPrisma.db.assessmentQuestion.findMany.mockResolvedValue(
        mockQuestions,
      );

      const result = await service.getQuestions('depression');

      expect(mockPrisma.db.assessmentQuestion.findMany).toHaveBeenCalledWith({
        where: { id: { startsWith: 'phq9-' } },
        orderBy: { order: 'asc' },
      });
      expect(result).toEqual(mockQuestions);
    });

    it('should default to stress- prefix for unknown type', async () => {
      mockPrisma.db.assessmentQuestion.findMany.mockResolvedValue([]);

      await service.getQuestions('unknown');

      expect(mockPrisma.db.assessmentQuestion.findMany).toHaveBeenCalledWith({
        where: { id: { startsWith: 'stress-' } },
        orderBy: { order: 'asc' },
      });
    });

    it('should return empty array when no questions found', async () => {
      mockPrisma.db.assessmentQuestion.findMany.mockResolvedValue([]);

      const result = await service.getQuestions('stress');

      expect(result).toEqual([]);
    });
  });

  // ==================== submit stress ====================
  describe('submit - stress type', () => {
    const userId = 'user-123';
    const stressAnswers = {
      answers: Array.from({ length: 10 }, (_, i) => ({
        questionId: `stress-${i + 1}`,
        score: 2,
      })),
    };

    it('should calculate stress score and save result', async () => {
      const mockResult = {
        id: 'result-1',
        createdAt: new Date('2024-01-01'),
      };
      mockPrisma.db.assessmentResult.create.mockResolvedValue(mockResult);

      const result = await service.submit(userId, 'stress', stressAnswers);

      expect(mockPrisma.db.assessmentResult.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            totalScore: expect.any(Number),
            level: expect.any(String),
          }),
        }),
      );
      expect(result.id).toBe('result-1');
      expect(result.type).toBe('stress');
      expect(result.maxScore).toBe(40);
      expect(result.totalScore).toBeDefined();
      expect(result.level).toBeDefined();
      expect(result.recommendation).toBeDefined();
      expect(result.createdAt).toBe(mockResult.createdAt);
    });

    it('should store answers mapped to questionId and score', async () => {
      const mockResult = { id: 'result-1', createdAt: new Date() };
      mockPrisma.db.assessmentResult.create.mockResolvedValue(mockResult);

      await service.submit(userId, 'stress', stressAnswers);

      const createCall = mockPrisma.db.assessmentResult.create.mock.calls[0][0];
      expect(createCall.data.answers).toEqual(
        stressAnswers.answers.map((a) => ({
          questionId: a.questionId,
          score: a.score,
        })),
      );
    });

    it('should return maxScore of 40 for stress', async () => {
      mockPrisma.db.assessmentResult.create.mockResolvedValue({
        id: 'result-1',
        createdAt: new Date(),
      });

      const result = await service.submit(userId, 'stress', stressAnswers);

      expect(result.maxScore).toBe(40);
    });

    it('should return level and recommendation for stress', async () => {
      mockPrisma.db.assessmentResult.create.mockResolvedValue({
        id: 'result-1',
        createdAt: new Date(),
      });

      const result = await service.submit(userId, 'stress', stressAnswers);

      expect(result.level).toBeTruthy();
      expect(result.recommendation).toBeTruthy();
    });
  });

  // ==================== submit depression ====================
  describe('submit - depression type', () => {
    const userId = 'user-123';
    const depressionAnswers = {
      answers: Array.from({ length: 9 }, (_, i) => ({
        questionId: `phq9-${i + 1}`,
        score: 2,
      })),
    };

    it('should calculate depression score and save result', async () => {
      const mockResult = {
        id: 'result-2',
        createdAt: new Date('2024-01-02'),
      };
      mockPrisma.db.assessmentResult.create.mockResolvedValue(mockResult);

      const result = await service.submit(
        userId,
        'depression',
        depressionAnswers,
      );

      expect(result.id).toBe('result-2');
      expect(result.type).toBe('depression');
      expect(result.maxScore).toBe(27);
    });

    it('should return maxScore of 27 for depression', async () => {
      mockPrisma.db.assessmentResult.create.mockResolvedValue({
        id: 'result-2',
        createdAt: new Date(),
      });

      const result = await service.submit(
        userId,
        'depression',
        depressionAnswers,
      );

      expect(result.maxScore).toBe(27);
    });

    it('should use depression scoring functions for depression type', async () => {
      mockPrisma.db.assessmentResult.create.mockResolvedValue({
        id: 'result-2',
        createdAt: new Date(),
      });

      // All answers = 3 → totalScore should be 27 (9 * 3)
      const maxAnswers = {
        answers: Array.from({ length: 9 }, (_, i) => ({
          questionId: `phq9-${i + 1}`,
          score: 3,
        })),
      };

      const result = await service.submit(userId, 'depression', maxAnswers);

      expect(result.totalScore).toBe(27);
      expect(result.level).toBe('รุนแรงสูง');
    });

    it('should return level and recommendation for depression', async () => {
      mockPrisma.db.assessmentResult.create.mockResolvedValue({
        id: 'result-2',
        createdAt: new Date(),
      });

      const result = await service.submit(
        userId,
        'depression',
        depressionAnswers,
      );

      expect(result.level).toBeTruthy();
      expect(result.recommendation).toBeTruthy();
    });
  });

  // ==================== submit with zero scores ====================
  describe('submit - edge cases', () => {
    it('should handle empty answers array', async () => {
      mockPrisma.db.assessmentResult.create.mockResolvedValue({
        id: 'result-3',
        createdAt: new Date(),
      });

      const result = await service.submit('user-1', 'stress', { answers: [] });

      expect(result.totalScore).toBe(0);
    });

    it('should handle minimum depression score of 0', async () => {
      mockPrisma.db.assessmentResult.create.mockResolvedValue({
        id: 'result-4',
        createdAt: new Date(),
      });

      const result = await service.submit('user-1', 'depression', {
        answers: Array.from({ length: 9 }, (_, i) => ({
          questionId: `phq9-${i + 1}`,
          score: 0,
        })),
      });

      expect(result.totalScore).toBe(0);
      expect(result.level).toBe('ไม่มีหรือน้อยมาก');
    });
  });

  // ==================== getHistory ====================
  describe('getHistory', () => {
    it('should return history for a user ordered by createdAt desc', async () => {
      const mockHistory = [
        {
          id: 'r2',
          userId: 'user-1',
          totalScore: 15,
          level: 'ปานกลาง',
          createdAt: new Date(),
        },
        {
          id: 'r1',
          userId: 'user-1',
          totalScore: 5,
          level: 'ต่ำ',
          createdAt: new Date(),
        },
      ];
      mockPrisma.db.assessmentResult.findMany.mockResolvedValue(mockHistory);

      const result = await service.getHistory('user-1');

      expect(mockPrisma.db.assessmentResult.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      expect(result).toEqual(mockHistory);
    });

    it('should limit results to 10', async () => {
      mockPrisma.db.assessmentResult.findMany.mockResolvedValue([]);

      await service.getHistory('user-1');

      const call = mockPrisma.db.assessmentResult.findMany.mock.calls[0][0];
      expect(call.take).toBe(10);
    });

    it('should return empty array when no history', async () => {
      mockPrisma.db.assessmentResult.findMany.mockResolvedValue([]);

      const result = await service.getHistory('user-no-history');

      expect(result).toEqual([]);
    });

    it('should filter by the correct userId', async () => {
      mockPrisma.db.assessmentResult.findMany.mockResolvedValue([]);

      await service.getHistory('specific-user-id');

      const call = mockPrisma.db.assessmentResult.findMany.mock.calls[0][0];
      expect(call.where.userId).toBe('specific-user-id');
    });
  });
});
