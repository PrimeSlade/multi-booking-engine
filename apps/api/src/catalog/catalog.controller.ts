import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogService } from '@/catalog/catalog.service';

@ApiTags('Catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('flights')
  @ApiOperation({ summary: 'List flights with seats available' })
  findAvailableFlights() {
    return this.catalogService.findAvailableFlights();
  }

  @Get('hotels')
  @ApiOperation({ summary: 'List hotels with available rooms' })
  findAvailableHotels() {
    return this.catalogService.findAvailableHotels();
  }
}
