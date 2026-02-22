import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

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

interface RecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

@Injectable()
export class ContactService {
  async verifyRecaptcha(token: string): Promise<boolean> {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      throw new HttpException(
        'reCAPTCHA not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const response = await fetch(
        'https://www.google.com/recaptcha/api/siteverify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            secret: secretKey,
            response: token,
          }).toString(),
        },
      );

      const result: RecaptchaResponse = await response.json();

      if (!result.success) {
        console.error('reCAPTCHA verification failed:', result['error-codes']);
        return false;
      }

      // For reCAPTCHA v3, check the score
      const scoreThreshold = 0.5;
      if (result.score !== undefined && result.score < scoreThreshold) {
        console.error(`reCAPTCHA score too low: ${result.score}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('reCAPTCHA verification error:', error);
      return false;
    }
  }

  async submitInterest(data: InterestFormData): Promise<{ success: boolean }> {
    // Validate required fields
    const errors: Record<string, string> = {};

    if (!data.name || data.name.trim().length < 2) {
      errors.name = 'Full name must be at least 2 characters.';
    }

    if (!data.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
      errors.email = 'Enter a valid email address.';
    }

    if (!['Yes', 'No'].includes(data.pitchedBefore)) {
      errors.pitchedBefore = 'Please select if you have pitched before.';
    }

    const allowedInterests = [
      'Attending',
      'Pitching my business',
      'Investing / Partnering',
    ];
    if (!allowedInterests.includes(data.interest)) {
      errors.interest = 'Select a valid interest option.';
    }

    if (!data.consent) {
      errors.consent = 'Consent is required.';
    }

    if (Object.keys(errors).length > 0) {
      throw new HttpException(
        { error: 'validation_failed', errors },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Verify reCAPTCHA
    if (!data.recaptchaToken) {
      throw new HttpException(
        'reCAPTCHA token is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const recaptchaValid = await this.verifyRecaptcha(data.recaptchaToken);
    if (!recaptchaValid) {
      throw new HttpException(
        'reCAPTCHA verification failed',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Submit to Web3Forms
    const accessKey = process.env.WEB3FORMS_ACCESS_KEY;
    if (!accessKey) {
      throw new HttpException(
        'Email service not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const payload = {
        access_key: accessKey,
        to: 'info@liffeyfoundersclub.com',
        subject: `New Interest Form Submission from ${data.name}`,
        from_name: data.name,
        from_email: data.email,
        name: data.name,
        email: data.email,
        pitchedBefore: data.pitchedBefore,
        interest: data.interest,
        message: data.message || '',
        event_year: data.event_year,
        event_quarter: data.event_quarter,
        consent: data.consent,
      };

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error('Web3Forms submission failed:', result);
        throw new HttpException(
          'Email submission failed',
          HttpStatus.BAD_GATEWAY,
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Web3Forms error:', error);
      throw new HttpException('Email service error', HttpStatus.BAD_GATEWAY);
    }
  }
}
