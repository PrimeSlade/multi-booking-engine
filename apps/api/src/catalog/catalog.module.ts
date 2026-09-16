import { Module } from '@nestjs/common';
import { CatalogController } from '@/catalog/catalog.controller';
import { CatalogService } from '@/catalog/catalog.service';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
