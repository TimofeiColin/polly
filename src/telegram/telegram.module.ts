import { Module } from '@nestjs/common';
import { ChatStoreService } from './chat-store.service';
import { ChatTrackerService } from './chat-tracker.service';
import { LocationService } from './location.service';
import { PollCommandService } from './poll-command.service';
import { TimeService } from './time.service';
import { TelegramService } from './telegram.service';

@Module({
  providers: [ChatStoreService, ChatTrackerService, LocationService, TimeService, PollCommandService, TelegramService],
})
export class TelegramModule {}
