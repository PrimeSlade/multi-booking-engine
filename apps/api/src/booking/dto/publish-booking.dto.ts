import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
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
  @ApiProperty({
    description: 'Product type discriminator',
    enum: BOOKING_PRODUCT_TYPES,
    example: 'flight',
  })
  @IsIn(BOOKING_PRODUCT_TYPES)
  type: BookingProductType;
}

export class FlightProductDto extends BookingProductDto {
  @ApiProperty({ example: 'flight', enum: ['flight'] })
  @IsIn(['flight'] as const)
  declare type: 'flight';

  @ApiProperty({
    description: 'Unique flight identifier from catalog',
    example: 'flight-ba-178',
  })
  @IsString()
  @IsNotEmpty()
  flightId: string;

  @ApiPropertyOptional({
    description: 'Flight number code',
    example: 'BA178',
  })
  @IsOptional()
  @IsString()
  flightNumber?: string;

  @ApiProperty({
    description: 'Origin IATA airport code or city',
    example: 'JFK',
  })
  @IsString()
  @IsNotEmpty()
  origin: string;

  @ApiProperty({
    description: 'Destination IATA airport code or city',
    example: 'LHR',
  })
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiProperty({
    description: 'ISO departure date string',
    example: '2026-10-01T10:00:00.000Z',
  })
  @IsDateString()
  departureDate: string;

  @ApiPropertyOptional({
    description: 'Number of passengers',
    example: 2,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  passengers?: number;
}

export class HotelProductDto extends BookingProductDto {
  @ApiProperty({ example: 'hotel', enum: ['hotel'] })
  @IsIn(['hotel'] as const)
  declare type: 'hotel';

  @ApiProperty({
    description: 'Unique hotel identifier from catalog',
    example: 'hotel-london-grand',
  })
  @IsString()
  @IsNotEmpty()
  hotelId: string;

  @ApiPropertyOptional({
    description: 'Hotel property name',
    example: 'The Grand London Hotel',
  })
  @IsOptional()
  @IsString()
  hotelName?: string;

  @ApiPropertyOptional({
    description: 'Room identifier from catalog',
    example: 'room-ldn-101',
  })
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiPropertyOptional({
    description: 'Room category / type description',
    example: 'Deluxe King',
  })
  @IsOptional()
  @IsString()
  roomType?: string;

  @ApiProperty({
    description: 'Destination city of the hotel',
    example: 'London',
  })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({
    description: 'ISO check-in date string',
    example: '2026-10-01T15:00:00.000Z',
  })
  @IsDateString()
  checkIn: string;

  @ApiProperty({
    description: 'ISO check-out date string',
    example: '2026-10-05T11:00:00.000Z',
  })
  @IsDateString()
  checkOut: string;

  @ApiPropertyOptional({
    description: 'Number of rooms',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  rooms?: number;
}

@ApiExtraModels(FlightProductDto, HotelProductDto)
export class PublishBookingDto {
  @ApiProperty({
    description: 'Unique user / customer identifier',
    example: 'user-123',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description:
      'Array of products (flight or hotel) in this booking itinerary',
    type: 'array',
    items: {
      oneOf: [
        { $ref: getSchemaPath(FlightProductDto) },
        { $ref: getSchemaPath(HotelProductDto) },
      ],
    },
  })
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
