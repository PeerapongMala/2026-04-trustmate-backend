import { Test, TestingModule } from '@nestjs/testing';

jest.mock('@mistralai/mistralai', () => ({
  Mistral: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

describe('AdminController', () => {
  let controller: AdminController;
  const mockService = {
    getDashboardStats: jest.fn(),
    getPosts: jest.fn(),
    updatePostFlag: jest.fn(),
    deletePost: jest.fn(),
    getReports: jest.fn(),
    reviewReport: jest.fn(),
    banUser: jest.fn(),
    unbanUser: jest.fn(),
    createTherapist: jest.fn(),
    updateTherapist: jest.fn(),
    deleteTherapist: jest.fn(),
    createTimeSlots: jest.fn(),
    createAssessmentQuestion: jest.fn(),
    createTodayQuestion: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: mockService }],
    }).compile();
    controller = module.get<AdminController>(AdminController);
    jest.clearAllMocks();
  });

  it('GET /admin/dashboard aggregates stats', async () => {
    mockService.getDashboardStats.mockResolvedValue({ userCount: 1 });

    await controller.getDashboard();

    expect(mockService.getDashboardStats).toHaveBeenCalled();
  });

  it('GET /admin/posts parses page+limit and defaults', async () => {
    mockService.getPosts.mockResolvedValue({ data: [], meta: {} });

    await controller.getPosts('flagged', '2', '50');

    expect(mockService.getPosts).toHaveBeenCalledWith('flagged', 2, 50);
  });

  it('GET /admin/posts uses defaults when query strings missing', async () => {
    mockService.getPosts.mockResolvedValue({ data: [], meta: {} });

    await controller.getPosts();

    expect(mockService.getPosts).toHaveBeenCalledWith(undefined, 1, 20);
  });

  it('PATCH /admin/posts/:id/flag forwards postId and flagStatus', async () => {
    mockService.updatePostFlag.mockResolvedValue({});

    await controller.updatePostFlag('p-1', 'blocked');

    expect(mockService.updatePostFlag).toHaveBeenCalledWith('p-1', 'blocked');
  });

  it('DELETE /admin/posts/:id delegates', async () => {
    mockService.deletePost.mockResolvedValue({ message: 'ok' });

    await controller.deletePost('p-1');

    expect(mockService.deletePost).toHaveBeenCalledWith('p-1');
  });

  it('GET /admin/reports defaults status to pending', async () => {
    mockService.getReports.mockResolvedValue({ data: [], meta: {} });

    await controller.getReports();

    expect(mockService.getReports).toHaveBeenCalledWith('pending', 1, 20);
  });

  it('PATCH /admin/reports/:id forwards action', async () => {
    mockService.reviewReport.mockResolvedValue({});

    await controller.reviewReport('r-1', 'reviewed');

    expect(mockService.reviewReport).toHaveBeenCalledWith('r-1', 'reviewed');
  });

  it('POST /admin/users/:id/ban delegates', async () => {
    mockService.banUser.mockResolvedValue({});

    await controller.banUser('u-1');

    expect(mockService.banUser).toHaveBeenCalledWith('u-1');
  });

  it('POST /admin/users/:id/unban delegates', async () => {
    mockService.unbanUser.mockResolvedValue({});

    await controller.unbanUser('u-1');

    expect(mockService.unbanUser).toHaveBeenCalledWith('u-1');
  });

  it('POST /admin/therapists forwards body', async () => {
    const body = {
      name: 'A',
      title: 'PhD',
      specialties: ['x'],
      location: 'BKK',
      clinic: 'C',
      pricePerSlot: 500,
    };
    mockService.createTherapist.mockResolvedValue({ id: 't-1' });

    await controller.createTherapist(body);

    expect(mockService.createTherapist).toHaveBeenCalledWith(body);
  });

  it('PATCH /admin/therapists/:id forwards partial body', async () => {
    mockService.updateTherapist.mockResolvedValue({});

    await controller.updateTherapist('t-1', { pricePerSlot: 600 });

    expect(mockService.updateTherapist).toHaveBeenCalledWith('t-1', {
      pricePerSlot: 600,
    });
  });

  it('DELETE /admin/therapists/:id soft-deletes', async () => {
    mockService.deleteTherapist.mockResolvedValue({});

    await controller.deleteTherapist('t-1');

    expect(mockService.deleteTherapist).toHaveBeenCalledWith('t-1');
  });

  it('POST /admin/therapists/:id/slots forwards slot list', async () => {
    mockService.createTimeSlots.mockResolvedValue({ count: 1 });

    const slots = [
      { date: '2026-05-01', startTime: '09:00', endTime: '09:30' },
    ];
    await controller.createTimeSlots('t-1', slots);

    expect(mockService.createTimeSlots).toHaveBeenCalledWith('t-1', slots);
  });

  it('POST /admin/assessment-questions forwards text and order', async () => {
    mockService.createAssessmentQuestion.mockResolvedValue({});

    await controller.createAssessmentQuestion('Q?', 1);

    expect(mockService.createAssessmentQuestion).toHaveBeenCalledWith('Q?', 1);
  });

  it('POST /admin/today-questions forwards question and date', async () => {
    mockService.createTodayQuestion.mockResolvedValue({});

    await controller.createTodayQuestion('How are you?', '2026-05-01');

    expect(mockService.createTodayQuestion).toHaveBeenCalledWith(
      'How are you?',
      '2026-05-01',
    );
  });
});
