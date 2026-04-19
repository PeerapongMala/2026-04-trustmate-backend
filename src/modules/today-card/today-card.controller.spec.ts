import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

import { TodayCardController } from './today-card.controller';
import { TodayCardService } from './today-card.service';

describe('TodayCardController', () => {
  let controller: TodayCardController;
  const mockService = {
    getTodayCard: jest.fn(),
    answerCard: jest.fn(),
    getHistory: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TodayCardController],
      providers: [{ provide: TodayCardService, useValue: mockService }],
    }).compile();
    controller = module.get<TodayCardController>(TodayCardController);
    jest.clearAllMocks();
  });

  it('GET /today-card delegates to getTodayCard', async () => {
    mockService.getTodayCard.mockResolvedValue({
      question: null,
      answer: null,
    });

    await controller.getTodayCard('user-1');

    expect(mockService.getTodayCard).toHaveBeenCalledWith('user-1');
  });

  it('POST /today-card forwards dto', async () => {
    mockService.answerCard.mockResolvedValue({ id: 'c-1' });

    await controller.answerCard('user-1', { answer: 'good' });

    expect(mockService.answerCard).toHaveBeenCalledWith('user-1', {
      answer: 'good',
    });
  });

  it('GET /today-card/history delegates to getHistory', async () => {
    mockService.getHistory.mockResolvedValue([]);

    await controller.getHistory('user-1');

    expect(mockService.getHistory).toHaveBeenCalledWith('user-1');
  });
});
