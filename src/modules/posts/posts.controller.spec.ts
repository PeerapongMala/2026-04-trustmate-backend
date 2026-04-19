import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../admin/admin.service', () => ({
  AdminService: jest.fn().mockImplementation(() => ({})),
}));

import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

describe('PostsController', () => {
  let controller: PostsController;
  const mockService = {
    create: jest.fn(),
    findByUser: jest.fn(),
    findAll: jest.fn(),
    hug: jest.fn(),
    unhug: jest.fn(),
    report: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [{ provide: PostsService, useValue: mockService }],
    }).compile();

    controller = module.get<PostsController>(PostsController);
    jest.clearAllMocks();
  });

  it('POST /posts forwards userId and dto', async () => {
    const dto = { content: 'hi', tag: '#general' };
    mockService.create.mockResolvedValue({ id: 'p-1' });

    await controller.create('user-1', dto);

    expect(mockService.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('GET /posts/me returns user posts', async () => {
    mockService.findByUser.mockResolvedValue([]);

    await controller.findMyPosts('user-1');

    expect(mockService.findByUser).toHaveBeenCalledWith('user-1');
  });

  it('GET /posts defaults to page=1, limit=20 when query missing', async () => {
    mockService.findAll.mockResolvedValue({ data: [], meta: {} });

    await controller.findAll('user-1');

    expect(mockService.findAll).toHaveBeenCalledWith(
      'user-1',
      undefined,
      1,
      20,
    );
  });

  it('GET /posts parses page and limit query strings as numbers', async () => {
    mockService.findAll.mockResolvedValue({ data: [], meta: {} });

    await controller.findAll('user-1', '#sad', '3', '50');

    expect(mockService.findAll).toHaveBeenCalledWith('user-1', '#sad', 3, 50);
  });

  it('POST /posts/:id/hug forwards userId and postId', async () => {
    mockService.hug.mockResolvedValue({ hugCount: 1 });

    await controller.hug('user-1', 'p-1');

    expect(mockService.hug).toHaveBeenCalledWith('user-1', 'p-1');
  });

  it('DELETE /posts/:id/hug forwards userId and postId', async () => {
    mockService.unhug.mockResolvedValue({ hugCount: 0 });

    await controller.unhug('user-1', 'p-1');

    expect(mockService.unhug).toHaveBeenCalledWith('user-1', 'p-1');
  });

  it('POST /posts/:id/report forwards reason only', async () => {
    mockService.report.mockResolvedValue({});

    await controller.report('user-1', 'p-1', { reason: 'สแปม' });

    expect(mockService.report).toHaveBeenCalledWith('user-1', 'p-1', 'สแปม');
  });
});
