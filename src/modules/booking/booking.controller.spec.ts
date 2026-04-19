import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';

describe('BookingController', () => {
  let controller: BookingController;
  const mockService = {
    getTherapists: jest.fn(),
    getSlots: jest.fn(),
    getAvailableDates: jest.fn(),
    createReview: jest.fn(),
    createBooking: jest.fn(),
    getMyBookings: jest.fn(),
    cancelBooking: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingController],
      providers: [{ provide: BookingService, useValue: mockService }],
    }).compile();

    controller = module.get<BookingController>(BookingController);
    jest.clearAllMocks();
  });

  it('GET /therapists delegates to service with sort', async () => {
    mockService.getTherapists.mockResolvedValue([]);

    await controller.getTherapists('rating');

    expect(mockService.getTherapists).toHaveBeenCalledWith('rating');
  });

  it('GET /therapists/:id/slots passes through id+date', async () => {
    mockService.getSlots.mockResolvedValue([]);

    await controller.getSlots('t-1', '2026-05-01');

    expect(mockService.getSlots).toHaveBeenCalledWith('t-1', '2026-05-01');
  });

  it('GET /therapists/:id/available-dates delegates to service', async () => {
    mockService.getAvailableDates.mockResolvedValue([]);

    await controller.getAvailableDates('t-1');

    expect(mockService.getAvailableDates).toHaveBeenCalledWith('t-1');
  });

  it('POST /therapists/:id/reviews forwards userId, therapistId and dto', async () => {
    const dto = { rating: 5, comment: 'ok' };
    mockService.createReview.mockResolvedValue({ id: 'r-1' });

    await controller.createReview('user-1', 't-1', dto);

    expect(mockService.createReview).toHaveBeenCalledWith('user-1', 't-1', dto);
  });

  it('POST /bookings forwards userId and dto', async () => {
    const dto = { therapistId: 't-1', slotId: 's-1' };
    mockService.createBooking.mockResolvedValue({ id: 'b-1' });

    await controller.createBooking('user-1', dto);

    expect(mockService.createBooking).toHaveBeenCalledWith('user-1', dto);
  });

  it('GET /bookings/me delegates with userId', async () => {
    mockService.getMyBookings.mockResolvedValue([]);

    await controller.getMyBookings('user-1');

    expect(mockService.getMyBookings).toHaveBeenCalledWith('user-1');
  });

  it('PATCH /bookings/:id/cancel forwards both userId and bookingId', async () => {
    mockService.cancelBooking.mockResolvedValue({ message: 'ok' });

    await controller.cancelBooking('user-1', 'b-1');

    expect(mockService.cancelBooking).toHaveBeenCalledWith('user-1', 'b-1');
  });
});
