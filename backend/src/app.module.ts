import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ContactModule } from './contact/contact.module';
import { Web3Module } from './web3/web3.module';

@Module({
  imports: [ContactModule, Web3Module],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
