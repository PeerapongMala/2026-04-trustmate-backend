import { Test, TestingModule } from '@nestjs/testing';

jest.mock('@mistralai/mistralai', () => ({
  Mistral: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

describe('ChatController', () => {
  let controller: ChatController;
  const mockService = {
    sendMessage: jest.fn(),
    getSessions: jest.fn(),
    getMessages: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [{ provide: ChatService, useValue: mockService }],
    }).compile();
    controller = module.get<ChatController>(ChatController);
    jest.clearAllMocks();
  });

  it('POST /chat forwards userId and dto to service', async () => {
    mockService.sendMessage.mockResolvedValue({ sessionId: 's-1' });

    await controller.sendMessage('user-1', { message: 'hi' });

    expect(mockService.sendMessage).toHaveBeenCalledWith('user-1', {
      message: 'hi',
    });
  });

  it('GET /chat/sessions delegates with userId', async () => {
    mockService.getSessions.mockResolvedValue([]);

    await controller.getSessions('user-1');

    expect(mockService.getSessions).toHaveBeenCalledWith('user-1');
  });

  it('GET /chat/sessions/:id forwards userId and sessionId', async () => {
    mockService.getMessages.mockResolvedValue([]);

    await controller.getMessages('user-1', 's-1');

    expect(mockService.getMessages).toHaveBeenCalledWith('user-1', 's-1');
  });
});
