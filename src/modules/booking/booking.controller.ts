import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Get('therapists')
  getTherapists(@Query('sort') sort?: string) {
    return this.bookingService.getTherapists(sort);
  }

  @Get('therapists/:id/slots')
  getSlots(@Param('id') id: string, @Query('date') date: string) {
    return this.bookingService.getSlots(id, date);
  }

  @Get('therapists/:id/available-dates')
  getAvailableDates(@Param('id') id: string) {
    return this.bookingService.getAvailableDates(id);
  }

  @Post('therapists/:id/reviews')
  createReview(
    @CurrentUser('id') userId: string,
    @Param('id') therapistId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.bookingService.createReview(userId, therapistId, dto);
  }

  @Post('bookings')
  createBooking(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingService.createBooking(userId, dto);
  }

  @Get('bookings/me')
  getMyBookings(@CurrentUser('id') userId: string) {
    return this.bookingService.getMyBookings(userId);
  }

  @Patch('bookings/:id/cancel')
  cancelBooking(
    @CurrentUser('id') userId: string,
    @Param('id') bookingId: string,
  ) {
    return this.bookingService.cancelBooking(userId, bookingId);
  }
}
