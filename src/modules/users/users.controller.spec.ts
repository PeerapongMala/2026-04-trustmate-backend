import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  const mockService = {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    deleteAccount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockService }],
    }).compile();
    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('GET /users/me delegates to getProfile', async () => {
    mockService.getProfile.mockResolvedValue({ id: 'u-1' });

    await controller.getProfile('u-1');

    expect(mockService.getProfile).toHaveBeenCalledWith('u-1');
  });

  it('PATCH /users/me forwards userId and dto', async () => {
    mockService.updateProfile.mockResolvedValue({ id: 'u-1' });

    await controller.updateProfile('u-1', { alias: 'New', bio: 'hi' });

    expect(mockService.updateProfile).toHaveBeenCalledWith('u-1', {
      alias: 'New',
      bio: 'hi',
    });
  });

  it('DELETE /users/me delegates to deleteAccount', async () => {
    mockService.deleteAccount.mockResolvedValue({ message: 'ok' });

    await controller.deleteAccount('u-1');

    expect(mockService.deleteAccount).toHaveBeenCalledWith('u-1');
  });
});
