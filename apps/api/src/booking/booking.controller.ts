import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BookingService } from '@/booking/booking.service';
import { PublishBookingDto } from '@/booking/dto/publish-booking.dto';
import { ResponseMessage } from '@/common/decorators/response-message.decorator';

@ApiTags('Bookings')
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @ApiOperation({
    summary: 'Initiate and publish a new multi-product booking',
    description:
      'Validates itinerary products, generates the staged execution graph via GraphService, persists the Booking and BookingSteps, and prepares for asynchronous dispatch.',
  })
  @ApiBody({
    type: PublishBookingDto,
    examples: {
      'flight-and-hotels': {
        summary: 'Package Itinerary (1 Flight + 2 Hotels)',
        description:
          'Multi-city travel booking with 1 flight leg and 2 hotel stays matching catalog inventory',
        value: {
          userId: 'user-123',
          products: [
            {
              type: 'flight',
              flightId: 'flight-ba-178',
              flightNumber: 'BA178',
              airlineName: 'British Airways',
              origin: 'JFK',
              destination: 'LHR',
              departureDate: '2026-10-01T10:00:00.000Z',
              passengers: 2,
            },
            {
              type: 'hotel',
              hotelId: 'hotel-london-grand',
              hotelName: 'The Grand London Hotel',
              roomId: 'room-ldn-101',
              roomType: 'Deluxe King',
              city: 'London',
              checkIn: '2026-10-01T15:00:00.000Z',
              checkOut: '2026-10-03T11:00:00.000Z',
              guests: 2,
              rooms: 1,
            },
            {
              type: 'hotel',
              hotelId: 'hotel-edin-castle',
              hotelName: 'The Balmoral Castle View Hotel',
              roomId: 'room-edi-201',
              roomType: 'Classic Double',
              city: 'Edinburgh',
              checkIn: '2026-10-03T15:00:00.000Z',
              checkOut: '2026-10-05T11:00:00.000Z',
              guests: 2,
              rooms: 1,
            },
          ],
        },
      },
      'flight-only': {
        summary: 'Flight-only Itinerary',
        description:
          'Single flight booking generating 5 staged steps (flight + shared steps)',
        value: {
          userId: 'user-456',
          products: [
            {
              type: 'flight',
              flightId: 'flight-nh-105',
              flightNumber: 'NH105',
              airlineName: 'All Nippon Airways',
              origin: 'LAX',
              destination: 'HND',
              departureDate: '2026-11-15T08:30:00.000Z',
              passengers: 1,
            },
          ],
        },
      },
      'hotel-only': {
        summary: 'Hotel-only Itinerary (Seeded Catalog Data)',
        description:
          'Single hotel reservation using the hotel-1 and hotel-1-deluxe records created by the database seed',
        value: {
          userId: 'swagger-test-user',
          products: [
            {
              type: 'hotel',
              hotelId: 'hotel-1',
              hotelName: 'Grand Hyatt',
              roomId: 'hotel-1-deluxe',
              roomType: 'Deluxe',
              city: 'New York',
              checkIn: '2026-10-01T15:00:00.000Z',
              checkOut: '2026-10-03T11:00:00.000Z',
              guests: 2,
              rooms: 1,
            },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Booking successfully created with generated execution steps',
  })
  @ResponseMessage('Booking published successfully')
  publish(@Body() dto: PublishBookingDto) {
    return this.bookingService.publish(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Retrieve booking status, payload, and generated steps by ID',
    description:
      'Fetches the overall booking state along with all associated staged steps ordered by stepIndex.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the booking to retrieve',
    example: 'd3b07384-d113-4a37-b648-9f1e31d45c58',
  })
  @ApiResponse({
    status: 200,
    description: 'The booking details and step lifecycle records',
  })
  @ApiResponse({
    status: 404,
    description: 'Booking not found',
  })
  async findById(@Param('id') id: string) {
    const booking = await this.bookingService.findById(id);
    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }
    return booking;
  }
}
