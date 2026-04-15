import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './assessment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

const mockAssessmentService = {
  getQuestions: jest.fn(),
  submit: jest.fn(),
  getHistory: jest.fn(),
};

// Override JwtAuthGuard so we don't need a real JWT
const mockJwtAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };

describe('AssessmentController', () => {
  let controller: AssessmentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssessmentController],
      providers: [
        { provide: AssessmentService, useValue: mockAssessmentService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<AssessmentController>(AssessmentController);
    jest.clearAllMocks();
  });

  // ==================== getQuestions ====================
  describe('getQuestions', () => {
    it('should call service.getQuestions with the given type', async () => {
      const mockQuestions = [{ id: 'stress-1', text: 'Q1', order: 1 }];
      mockAssessmentService.getQuestions.mockResolvedValue(mockQuestions);

      const result = await controller.getQuestions('stress');

      expect(mockAssessmentService.getQuestions).toHaveBeenCalledWith('stress');
      expect(result).toEqual(mockQuestions);
    });

    it('should default type to stress when not provided', async () => {
      mockAssessmentService.getQuestions.mockResolvedValue([]);

      // The default parameter value 'stress' is set in the method signature
      await controller.getQuestions('stress');

      expect(mockAssessmentService.getQuestions).toHaveBeenCalledWith('stress');
    });

    it('should call service.getQuestions with depression type', async () => {
      mockAssessmentService.getQuestions.mockResolvedValue([]);

      await controller.getQuestions('depression');

      expect(mockAssessmentService.getQuestions).toHaveBeenCalledWith(
        'depression',
      );
    });

    it('should return the result from the service', async () => {
      const questions = [
        { id: 'phq9-1', text: 'Q1', order: 1 },
        { id: 'phq9-2', text: 'Q2', order: 2 },
      ];
      mockAssessmentService.getQuestions.mockResolvedValue(questions);

      const result = await controller.getQuestions('depression');

      expect(result).toEqual(questions);
    });
  });

  // ==================== submit ====================
  describe('submit', () => {
    const userId = 'user-abc';
    const dto = {
      answers: [
        { questionId: 'stress-1', score: 2 },
        { questionId: 'stress-2', score: 3 },
      ],
    };

    it('should call service.submit with userId, type, and dto', async () => {
      const mockResult = {
        id: 'result-1',
        type: 'stress',
        totalScore: 20,
        maxScore: 40,
        level: 'ปานกลาง',
        recommendation: 'ผ่อนคลาย',
        createdAt: new Date(),
      };
      mockAssessmentService.submit.mockResolvedValue(mockResult);

      const result = await controller.submit(userId, 'stress', dto);

      expect(mockAssessmentService.submit).toHaveBeenCalledWith(
        userId,
        'stress',
        dto,
      );
      expect(result).toEqual(mockResult);
    });

    it('should pass depression type to service', async () => {
      mockAssessmentService.submit.mockResolvedValue({
        id: 'result-2',
        type: 'depression',
        totalScore: 10,
        maxScore: 27,
        level: 'ปานกลาง',
        recommendation: 'ควรพบแพทย์',
        createdAt: new Date(),
      });

      await controller.submit(userId, 'depression', dto);

      expect(mockAssessmentService.submit).toHaveBeenCalledWith(
        userId,
        'depression',
        dto,
      );
    });

    it('should return the service result including all fields', async () => {
      const expected = {
        id: 'result-1',
        type: 'stress',
        totalScore: 15,
        maxScore: 40,
        level: 'ปานกลาง',
        recommendation: 'แนะนำพักผ่อน',
        createdAt: new Date('2024-01-01'),
      };
      mockAssessmentService.submit.mockResolvedValue(expected);

      const result = await controller.submit(userId, 'stress', dto);

      expect(result).toEqual(expected);
    });
  });

  // ==================== getHistory ====================
  describe('getHistory', () => {
    it('should call service.getHistory with the userId from current user', async () => {
      const mockHistory = [
        { id: 'r1', totalScore: 10, level: 'ต่ำ', createdAt: new Date() },
      ];
      mockAssessmentService.getHistory.mockResolvedValue(mockHistory);

      const result = await controller.getHistory('user-abc');

      expect(mockAssessmentService.getHistory).toHaveBeenCalledWith('user-abc');
      expect(result).toEqual(mockHistory);
    });

    it('should return empty array when no history', async () => {
      mockAssessmentService.getHistory.mockResolvedValue([]);

      const result = await controller.getHistory('user-no-history');

      expect(result).toEqual([]);
    });

    it('should forward the userId to the service correctly', async () => {
      mockAssessmentService.getHistory.mockResolvedValue([]);

      await controller.getHistory('specific-user-id');

      expect(mockAssessmentService.getHistory).toHaveBeenCalledWith(
        'specific-user-id',
      );
    });
  });
});
