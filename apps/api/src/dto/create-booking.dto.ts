import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateBookingDto {
  @IsString()
  bookingId?: string;

  @IsEmail()
  customerEmail: string;

  @IsString()
  @IsNotEmpty()
  service: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}
