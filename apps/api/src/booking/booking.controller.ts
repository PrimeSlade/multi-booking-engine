import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { BookingService } from '@/booking/booking.service';
import { PublishBookingDto } from '@/booking/dto/publish-booking.dto';
import { ResponseMessage } from '@/common/decorators/response-message.decorator';

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @ResponseMessage('Booking published successfully')
  publish(@Body() dto: PublishBookingDto) {
    // NOTE: RabbitMQ dispatch (booking.requested + step fan-out) lands here
    // once the messaging module is built. For now this only persists the
    // Booking in `in_progress` status.
    return this.bookingService.publish(dto);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const booking = await this.bookingService.findById(id);
    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }
    return booking;
  }
}
