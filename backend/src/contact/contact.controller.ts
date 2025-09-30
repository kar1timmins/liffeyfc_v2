import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ContactService } from './contact.service';

interface InterestFormData {
  name: string;
  email: string;
  pitchedBefore: 'Yes' | 'No';
  interest: string;
  message?: string;
  event_year: number;
  event_quarter: string;
  consent: boolean;
  recaptchaToken: string;
}

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post('interest')
  @HttpCode(HttpStatus.OK)
  async submitInterest(@Body() data: InterestFormData) {
    return await this.contactService.submitInterest(data);
  }
}