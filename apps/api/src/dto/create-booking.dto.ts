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
  @IsOptional()
  bookingId?: string;

  @IsEmail()
  @IsNotEmpty()
  customerEmail: string;

  @IsString()
  @IsNotEmpty()
  service: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}
