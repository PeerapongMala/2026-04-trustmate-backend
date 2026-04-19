import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

import { MoodController } from './mood.controller';
import { MoodService } from './mood.service';

describe('MoodController', () => {
  let controller: MoodController;
  const mockService = {
    create: jest.fn(),
    getHistory: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MoodController],
      providers: [{ provide: MoodService, useValue: mockService }],
    }).compile();
    controller = module.get<MoodController>(MoodController);
    jest.clearAllMocks();
  });

  it('POST /mood forwards userId and dto', async () => {
    mockService.create.mockResolvedValue({ id: 'm-1' });

    await controller.create('user-1', { mood: 'เศร้าซึม' });

    expect(mockService.create).toHaveBeenCalledWith('user-1', {
      mood: 'เศร้าซึม',
    });
  });

  it('GET /mood/history defaults to limit=30', async () => {
    mockService.getHistory.mockResolvedValue([]);

    await controller.getHistory('user-1');

    expect(mockService.getHistory).toHaveBeenCalledWith('user-1', 30);
  });

  it('GET /mood/history parses custom limit', async () => {
    mockService.getHistory.mockResolvedValue([]);

    await controller.getHistory('user-1', '7');

    expect(mockService.getHistory).toHaveBeenCalledWith('user-1', 7);
  });
});
