import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { ChatStoreService } from './chat-store.service';
import { ChatTrackerService } from './chat-tracker.service';
import { LocationService } from './location.service';
import { PollCommandService } from '../commands/poll/poll-command.service';
import { PollSenderService } from '../commands/poll/poll-sender.service';
import { ScheduleCommandService } from '../commands/schedule/schedule-command.service';
import { ScheduleStoreService } from '../commands/schedule/schedule-store.service';
import { SchedulerService } from '../commands/schedule/scheduler.service';
import { TimeService } from './time.service';
import { TelegramService } from './telegram.service';

@Module({
  providers: [
    {
      provide: Bot,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => new Bot(configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN')),
    },
    ChatStoreService,
    ChatTrackerService,
    LocationService,
    TimeService,
    PollSenderService,
    PollCommandService,
    ScheduleStoreService,
    ScheduleCommandService,
    SchedulerService,
    TelegramService,
  ],
})
export class TelegramModule {}
