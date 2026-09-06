import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export const BOOKING_PRODUCT_TYPES = ['flight', 'hotel'] as const;
export type BookingProductType = (typeof BOOKING_PRODUCT_TYPES)[number];

export class BookingProductDto {
  @IsIn(BOOKING_PRODUCT_TYPES)
  type: BookingProductType;
}

export class FlightProductDto extends BookingProductDto {
  @IsIn(['flight'] as const)
  declare type: 'flight';

  @IsString()
  @IsNotEmpty()
  origin: string;

  @IsString()
  @IsNotEmpty()
  destination: string;

  @IsDateString()
  departureDate: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  passengers?: number;
}

export class HotelProductDto extends BookingProductDto {
  @IsIn(['hotel'] as const)
  declare type: 'hotel';

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsDateString()
  checkIn: string;

  @IsDateString()
  checkOut: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  guests?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  rooms?: number;
}

export class PublishBookingDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BookingProductDto, {
    keepDiscriminatorProperty: true,
    discriminator: {
      property: 'type',
      subTypes: [
        { value: FlightProductDto, name: 'flight' },
        { value: HotelProductDto, name: 'hotel' },
      ],
    },
  })
  products: Array<FlightProductDto | HotelProductDto>;
}
