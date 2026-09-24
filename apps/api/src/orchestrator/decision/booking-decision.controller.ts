import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BookingDecisionService } from '@/orchestrator/decision/booking-decision.service';
import { BookingDecisionDto } from '@/orchestrator/decision/dto/booking-decision.dto';
import { ResponseMessage } from '@/common/decorators/response-message.decorator';

@ApiTags('Bookings')
@Controller('bookings')
export class BookingDecisionController {
  constructor(private readonly decisionService: BookingDecisionService) {}

  @Post(':id/decision')
  @ApiOperation({
    summary: 'Resolve a mixed allotment result',
    description:
      'Keeps every successfully allotted product or rejects the entire partial booking.',
  })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiResponse({ status: 201, description: 'Decision accepted' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({ status: 409, description: 'Decision unavailable or expired' })
  @ResponseMessage('Booking decision accepted')
  decide(@Param('id') id: string, @Body() dto: BookingDecisionDto) {
    return this.decisionService.decide(id, dto.decision);
  }
}
