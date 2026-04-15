import { IsString } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  therapistId: string;

  @IsString()
  slotId: string;
}
