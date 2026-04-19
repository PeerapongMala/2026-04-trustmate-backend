import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class BookingService {
  constructor(private readonly prisma: PrismaService) {}

  async getTherapists(sort: string = 'rating') {
    const orderBy =
      sort === 'price'
        ? { pricePerSlot: 'asc' as const }
        : { avgRating: 'desc' as const };

    return this.prisma.db.therapist.findMany({
      where: { isActive: true },
      orderBy,
    });
  }

  async getSlots(therapistId: string, date: string) {
    if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) {
      throw new BadRequestException('รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)');
    }
    const targetDate = new Date(date);
    if (Number.isNaN(targetDate.getTime())) {
      throw new BadRequestException('วันที่ไม่ถูกต้อง');
    }
    targetDate.setHours(0, 0, 0, 0);

    return this.prisma.db.timeSlot.findMany({
      where: {
        therapistId,
        date: targetDate,
        isBooked: false,
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async getAvailableDates(therapistId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const slots = await this.prisma.db.timeSlot.findMany({
      where: {
        therapistId,
        isBooked: false,
        date: { gte: today },
      },
      select: { date: true },
      distinct: ['date'],
      orderBy: { date: 'asc' },
    });

    return slots.map((s) => s.date);
  }

  async createBooking(userId: string, dto: CreateBookingDto) {
    // Interactive transaction — re-check slot inside the tx to avoid TOCTOU race.
    // Guarding with where: { isBooked: false } makes the update a no-op if another
    // request won the race, so we detect it by inspecting updated row count.
    return this.prisma.db.$transaction(async (tx) => {
      const slot = await tx.timeSlot.findUnique({
        where: { id: dto.slotId },
      });

      if (!slot) {
        throw new NotFoundException('ไม่พบช่วงเวลาที่เลือก');
      }

      const updated = await tx.timeSlot.updateMany({
        where: { id: dto.slotId, isBooked: false },
        data: { isBooked: true },
      });

      if (updated.count === 0) {
        throw new ConflictException('ช่วงเวลานี้ถูกจองแล้ว');
      }

      return tx.booking.create({
        data: {
          userId,
          therapistId: dto.therapistId,
          slotId: dto.slotId,
        },
      });
    });
  }

  async getMyBookings(userId: string, limit = 50) {
    return this.prisma.db.booking.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      include: {
        therapist: {
          select: { name: true, title: true, clinic: true, location: true },
        },
        slot: {
          select: { date: true, startTime: true, endTime: true },
        },
      },
    });
  }

  async cancelBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.db.booking.findFirst({
      where: { id: bookingId, userId },
    });

    if (!booking) {
      throw new NotFoundException('ไม่พบการจอง');
    }

    await this.prisma.db.$transaction([
      this.prisma.db.booking.update({
        where: { id: bookingId },
        data: { status: 'cancelled' },
      }),
      this.prisma.db.timeSlot.update({
        where: { id: booking.slotId },
        data: { isBooked: false },
      }),
    ]);

    return { message: 'ยกเลิกการจองสำเร็จ' };
  }

  async createReview(
    userId: string,
    therapistId: string,
    dto: CreateReviewDto,
  ) {
    const existing = await this.prisma.db.therapistReview.findUnique({
      where: { therapistId_userId: { therapistId, userId } },
    });

    if (existing) {
      throw new ConflictException('คุณรีวิวผู้ให้คำปรึกษาท่านนี้แล้ว');
    }

    return this.prisma.db.$transaction(async (tx) => {
      const review = await tx.therapistReview.create({
        data: { therapistId, userId, rating: dto.rating, comment: dto.comment },
      });

      const agg = await tx.therapistReview.aggregate({
        where: { therapistId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.therapist.update({
        where: { id: therapistId },
        data: {
          avgRating: agg._avg.rating || 0,
          reviewCount: agg._count.rating,
        },
      });

      return review;
    });
  }
}
