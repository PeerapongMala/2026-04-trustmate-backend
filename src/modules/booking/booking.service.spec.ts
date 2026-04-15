import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { BookingService } from './booking.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  db: {
    therapist: { findMany: jest.fn(), update: jest.fn() },
    timeSlot: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    booking: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    therapistReview: {
      findUnique: jest.fn(),
      create: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  },
};

describe('BookingService', () => {
  let service: BookingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
    jest.clearAllMocks();
  });

  // ==================== Create Booking ====================
  describe('createBooking', () => {
    it('should throw NotFoundException if slot does not exist', async () => {
      mockPrisma.db.timeSlot.findUnique.mockResolvedValue(null);

      await expect(
        service.createBooking('user-1', {
          therapistId: 't-1',
          slotId: 'invalid',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if slot is already booked', async () => {
      mockPrisma.db.timeSlot.findUnique.mockResolvedValue({
        id: 'slot-1',
        isBooked: true,
      });

      await expect(
        service.createBooking('user-1', {
          therapistId: 't-1',
          slotId: 'slot-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create booking with transaction for available slot', async () => {
      mockPrisma.db.timeSlot.findUnique.mockResolvedValue({
        id: 'slot-1',
        isBooked: false,
      });
      mockPrisma.db.$transaction.mockResolvedValue([
        { id: 'booking-1', userId: 'user-1', slotId: 'slot-1' },
        {},
      ]);

      const result = await service.createBooking('user-1', {
        therapistId: 't-1',
        slotId: 'slot-1',
      });

      expect(result.id).toBe('booking-1');
      expect(mockPrisma.db.$transaction).toHaveBeenCalled();
    });
  });

  // ==================== Cancel Booking ====================
  describe('cancelBooking', () => {
    it('should throw NotFoundException if booking does not exist', async () => {
      mockPrisma.db.booking.findFirst.mockResolvedValue(null);

      await expect(
        service.cancelBooking('user-1', 'invalid-booking'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should cancel booking and release slot via transaction', async () => {
      mockPrisma.db.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        slotId: 'slot-1',
        userId: 'user-1',
      });
      mockPrisma.db.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.cancelBooking('user-1', 'booking-1');

      expect(result.message).toContain('ยกเลิกการจองสำเร็จ');
      expect(mockPrisma.db.$transaction).toHaveBeenCalled();
    });

    it('should not allow canceling another users booking', async () => {
      mockPrisma.db.booking.findFirst.mockResolvedValue(null);

      await expect(
        service.cancelBooking('user-2', 'booking-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== Reviews + Rating ====================
  describe('createReview', () => {
    it('should throw ConflictException if user already reviewed', async () => {
      mockPrisma.db.therapistReview.findUnique.mockResolvedValue({
        id: 'review-1',
      });

      await expect(
        service.createReview('user-1', 'therapist-1', { rating: 5 }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create review and update therapist average rating', async () => {
      mockPrisma.db.therapistReview.findUnique.mockResolvedValue(null);
      mockPrisma.db.therapistReview.create.mockResolvedValue({
        id: 'review-1',
        rating: 4,
      });
      mockPrisma.db.therapistReview.aggregate.mockResolvedValue({
        _avg: { rating: 4.5 },
        _count: { rating: 10 },
      });
      mockPrisma.db.therapist.update.mockResolvedValue({});

      const result = await service.createReview('user-1', 'therapist-1', {
        rating: 4,
        comment: 'ดีมาก',
      });

      expect(result.rating).toBe(4);
      expect(mockPrisma.db.therapist.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { avgRating: 4.5, reviewCount: 10 },
        }),
      );
    });
  });

  // ==================== Get Therapists Sorting ====================
  describe('getTherapists', () => {
    it('should sort by avgRating desc by default', async () => {
      mockPrisma.db.therapist.findMany.mockResolvedValue([]);

      await service.getTherapists();

      expect(mockPrisma.db.therapist.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { avgRating: 'desc' },
        }),
      );
    });

    it('should sort by pricePerSlot asc when sort=price', async () => {
      mockPrisma.db.therapist.findMany.mockResolvedValue([]);

      await service.getTherapists('price');

      expect(mockPrisma.db.therapist.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { pricePerSlot: 'asc' },
        }),
      );
    });
  });
});
