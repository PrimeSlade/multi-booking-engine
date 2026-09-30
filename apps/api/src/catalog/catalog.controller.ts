import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogService } from '@/catalog/catalog.service';

@ApiTags('Catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('flights')
  @ApiOperation({
    summary: 'List flights, including sold-out ones (seatsLeft 0)',
  })
  findAvailableFlights() {
    return this.catalogService.findAvailableFlights();
  }

  @Get('hotels')
  @ApiOperation({
    summary: 'List hotels and rooms, including sold-out rooms (roomsLeft 0)',
  })
  findAvailableHotels() {
    return this.catalogService.findAvailableHotels();
  }
}
