import { Controller, Get } from '@nestjs/common';
import { RegulatorService } from './regulator.service';

@Controller('regulator')
export class RegulatorController {
  constructor(private readonly regulatorService: RegulatorService) {}

  @Get('ward-coverage')
  getWardCoverage() {
    return this.regulatorService.getWardCoverage();
  }
}
