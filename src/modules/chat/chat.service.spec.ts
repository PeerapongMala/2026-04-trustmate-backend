import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';

jest.mock('@mistralai/mistralai', () => ({
  Mistral: jest.fn().mockImplementation(() => ({
    chat: {
      complete: jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'mistral reply' } }],
      }),
    },
  })),
}));

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  db: {
    chatSession: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    chatMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
};

const mockConfig = {
  get: jest.fn(),
};

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    mockConfig.get.mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    jest.clearAllMocks();
  });

  // ==================== sendMessage (no API key — fallback) ====================
  describe('sendMessage (fallback, no API key)', () => {
    beforeEach(() => {
      mockPrisma.db.chatMessage.findMany.mockResolvedValue([]);
      mockPrisma.db.chatMessage.create.mockResolvedValue({
        id: 'msg-2',
        role: 'assistant',
        content: 'reply',
        createdAt: new Date(),
      });
    });

    it('should create a new session when sessionId is missing', async () => {
      mockPrisma.db.chatSession.create.mockResolvedValue({ id: 'new-session' });

      const result = await service.sendMessage('user-1', { message: 'สวัสดี' });

      expect(mockPrisma.db.chatSession.create).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
      });
      expect(result.sessionId).toBe('new-session');
    });

    it('should reuse an existing session when user owns it', async () => {
      mockPrisma.db.chatSession.findUnique.mockResolvedValue({
        userId: 'user-1',
      });

      await service.sendMessage('user-1', {
        sessionId: 'existing-session',
        message: 'ต่อด้วยนะ',
      });

      expect(mockPrisma.db.chatSession.create).not.toHaveBeenCalled();
      expect(mockPrisma.db.chatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionId: 'existing-session',
            role: 'user',
          }),
        }),
      );
    });

    it('should throw ForbiddenException when session belongs to another user', async () => {
      const { ForbiddenException } = await import('@nestjs/common');
      mockPrisma.db.chatSession.findUnique.mockResolvedValue({
        userId: 'user-999',
      });

      await expect(
        service.sendMessage('user-1', {
          sessionId: 'not-mine',
          message: 'hack',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.db.chatMessage.create).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when sessionId does not exist', async () => {
      const { ForbiddenException } = await import('@nestjs/common');
      mockPrisma.db.chatSession.findUnique.mockResolvedValue(null);

      await expect(
        service.sendMessage('user-1', {
          sessionId: 'nope',
          message: 'hi',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should save both user and assistant messages', async () => {
      mockPrisma.db.chatSession.create.mockResolvedValue({ id: 's-1' });

      await service.sendMessage('user-1', { message: 'hi' });

      const createCalls = mockPrisma.db.chatMessage.create.mock.calls;
      expect(createCalls).toHaveLength(2);
      expect(createCalls[0][0].data.role).toBe('user');
      expect(createCalls[1][0].data.role).toBe('assistant');
    });

    it('should detect crisis keyword and set isCrisis=true', async () => {
      mockPrisma.db.chatSession.create.mockResolvedValue({ id: 's-1' });

      const result = await service.sendMessage('user-1', {
        message: 'อยากตายจังเลย',
      });

      expect(result.isCrisis).toBe(true);
    });

    it('should detect English suicide keyword as crisis', async () => {
      mockPrisma.db.chatSession.create.mockResolvedValue({ id: 's-1' });

      const result = await service.sendMessage('user-1', {
        message: 'thinking about SUICIDE',
      });

      expect(result.isCrisis).toBe(true);
    });

    it('should return isCrisis=false for normal messages', async () => {
      mockPrisma.db.chatSession.create.mockResolvedValue({ id: 's-1' });

      const result = await service.sendMessage('user-1', {
        message: 'วันนี้เหนื่อยนิดหน่อย',
      });

      expect(result.isCrisis).toBe(false);
    });

    it('should include 1323 hotline in crisis fallback reply', async () => {
      mockPrisma.db.chatSession.create.mockResolvedValue({ id: 's-1' });

      await service.sendMessage('user-1', { message: 'อยากฆ่าตัวตาย' });

      const assistantCall = mockPrisma.db.chatMessage.create.mock.calls[1][0];
      expect(assistantCall.data.content).toContain('1323');
    });

    it('should limit history query to last 20 messages', async () => {
      mockPrisma.db.chatSession.create.mockResolvedValue({ id: 's-1' });

      await service.sendMessage('user-1', { message: 'hi' });

      expect(mockPrisma.db.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it('should return shape with sessionId, isCrisis, and message', async () => {
      mockPrisma.db.chatSession.create.mockResolvedValue({ id: 's-1' });

      const result = await service.sendMessage('user-1', { message: 'hi' });

      expect(result).toMatchObject({
        sessionId: 's-1',
        isCrisis: false,
        message: expect.objectContaining({
          id: expect.any(String),
          role: 'assistant',
          content: expect.any(String),
        }),
      });
    });
  });

  // ==================== sendMessage with Mistral ====================
  describe('sendMessage (with Mistral API)', () => {
    it('should call Mistral when API key is configured', async () => {
      const { Mistral } = jest.requireMock('@mistralai/mistralai');
      mockConfig.get.mockReturnValue('test-api-key');

      const module = await Test.createTestingModule({
        providers: [
          ChatService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile();
      const svc = module.get<ChatService>(ChatService);

      mockPrisma.db.chatSession.create.mockResolvedValue({ id: 's-1' });
      mockPrisma.db.chatMessage.findMany.mockResolvedValue([]);
      mockPrisma.db.chatMessage.create.mockResolvedValue({
        id: 'msg',
        role: 'assistant',
        content: 'mistral reply',
        createdAt: new Date(),
      });

      await svc.sendMessage('user-1', { message: 'hi' });

      expect(Mistral).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    });
  });

  // ==================== getSessions ====================
  describe('getSessions', () => {
    it('should fetch up to 20 sessions for a user ordered by newest first', async () => {
      mockPrisma.db.chatSession.findMany.mockResolvedValue([
        { id: 's-1' },
        { id: 's-2' },
      ]);

      const result = await service.getSessions('user-1');

      expect(result).toHaveLength(2);
      expect(mockPrisma.db.chatSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    });
  });

  // ==================== getMessages ====================
  describe('getMessages', () => {
    it('should return messages when user owns the session', async () => {
      mockPrisma.db.chatSession.findFirst.mockResolvedValue({ id: 's-1' });
      mockPrisma.db.chatMessage.findMany.mockResolvedValue([
        { id: 'm-1', content: 'hi' },
      ]);

      const result = await service.getMessages('user-1', 's-1');

      expect(result).toHaveLength(1);
      expect(mockPrisma.db.chatSession.findFirst).toHaveBeenCalledWith({
        where: { id: 's-1', userId: 'user-1' },
      });
    });

    it('should throw NotFoundException when session does not belong to user', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockPrisma.db.chatSession.findFirst.mockResolvedValue(null);

      await expect(
        service.getMessages('user-1', 'other-session'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.db.chatMessage.findMany).not.toHaveBeenCalled();
    });

    it('should cap message history at 100 per fetch', async () => {
      mockPrisma.db.chatSession.findFirst.mockResolvedValue({ id: 's-1' });
      mockPrisma.db.chatMessage.findMany.mockResolvedValue([]);

      await service.getMessages('user-1', 's-1');

      expect(mockPrisma.db.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });
});
