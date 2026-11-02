import { Injectable } from '@nestjs/common';
import { Bot, GrammyError } from 'grammy';
import { ChatStoreService } from './chat-store.service';

const POLL_SETTINGS = {
  is_anonymous: false,
  allow_adding_options: false,
  allows_revoting: true,
};

@Injectable()
export class PollSenderService {
  constructor(
    private readonly bot: Bot,
    private readonly chatStore: ChatStoreService,
  ) {}

  async send(chatId: number, question: string, options: string[]): Promise<void> {
    try {
      await this.bot.api.sendPoll(chatId, question, options, POLL_SETTINGS);
    } catch (error) {
      const newChatId = error instanceof GrammyError ? error.parameters.migrate_to_chat_id : undefined;

      if (!newChatId) {
        throw error;
      }

      this.chatStore.migrate(chatId, newChatId);
      await this.bot.api.sendPoll(newChatId, question, options, POLL_SETTINGS);
    }
  }
}
