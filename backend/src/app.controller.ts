import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth() {
    return this.appService.getHealth();
  }

  @Get('debug/migrations')
  async checkMigrations() {
    return this.appService.checkMigrations();
  }

  @Post('debug/run-migrations')
  async runMigrations() {
    return this.appService.runMigrations();
  }

  @Get('debug/tables')
  async getTables() {
    return this.appService.getTables();
  }
}
