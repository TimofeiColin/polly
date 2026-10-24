import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MOODS, PollMoodDefinition, generateOptions, generateQuestion, pickRandom } from '../moods';
import { ConfigService } from '@nestjs/config';
import { Bot, Context } from 'grammy';

const POLL_SETTINGS = {
  is_anonymous: false,
  allow_adding_options: false,
  allows_revoting: true,
};

const MOOD_TTL_MS = 60 * 60 * 1000;
const cyrillicCommand = (name: string) => new RegExp(`^/${name}(?:\\s+(.+))?$`, 'is');

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot: Bot;

  private readonly ownerId: number;
  private readonly testChatId?: number;

  private mood?: PollMoodDefinition;
  private moodExpiresAt = 0;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    this.ownerId = Number(this.configService.getOrThrow<string>('TELEGRAM_OWNER_ID'));
    this.testChatId = Number(this.configService.get<string>('TEST_CHAT_ID'));

    this.bot = new Bot(token);
    this.registerHandlers();
  }

  onModuleInit(): void {
    this.logger.log('Starting Telegram bot...');

    this.bot.start().catch((error: unknown) => {
      this.logger.error('Telegram polling stopped unexpectedly', error);
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Stopping Telegram bot...');
    await this.bot.stop();
  }

  private registerHandlers(): void {
    this.bot.catch((error) => {
      this.logger.error('Telegram bot error', error);
    });

    const userIsOwner = (ctx: Context) => ctx.from?.id === this.ownerId;
    const isTestChat = (ctx: Context) => ctx.chat?.id === this.testChatId;

    const allowed = this.bot.filter((ctx) => userIsOwner(ctx) || isTestChat(ctx));

    allowed.hears(cyrillicCommand('настолки'), async (ctx) => {
      const date = ctx.match[1]?.trim();

      if (!date) {
        await ctx.reply('Ты бяка! Не могу создать опросик без даты!!!');
        return;
      }

      const mood = this.getCurrentMood() ?? this.setMood(pickRandom(MOODS));

      try {
        await ctx.replyWithPoll(generateQuestion(mood, date), generateOptions(mood), POLL_SETTINGS);
      } catch (error) {
        this.logger.error('Failed to publish poll', error);

        await ctx.reply('Что-то пошло не так ..');
      }
    });

    allowed.hears(cyrillicCommand('какая Polly'), async (ctx) => {
      const mood = this.getCurrentMood();
      const current = mood ? `Сейчас Polly — ${mood.name} 🎭` : 'Ещё не определилась 😝';

      await ctx.reply(`${current}\n\nДоступно: ${this.availableMoods()}`);
    });

    allowed.hears(cyrillicCommand('Polly'), async (ctx) => {
      const input = ctx.match[1]?.trim().toLowerCase();

      if (!input) {
        await ctx.reply(`Не знаешь что сказать - не зови!`);
        return;
      }

      if (input === 'не определена') {
        this.mood = undefined;
        await ctx.reply('Угадай какая я сейчас 😝');
        return;
      }

      const mood = MOODS.find(({ name }) => name === input);

      if (!mood) {
        await ctx.reply(`Сам ты ${input}!`);
        return;
      }

      this.setMood(mood);
      await ctx.reply(`Теперь Polly — ${input} 🎭`);
    });
  }

  private getCurrentMood(): PollMoodDefinition | undefined {
    if (this.mood && Date.now() >= this.moodExpiresAt) {
      this.mood = undefined;
    }

    return this.mood;
  }

  private setMood(mood: PollMoodDefinition): PollMoodDefinition {
    this.mood = mood;
    this.moodExpiresAt = Date.now() + MOOD_TTL_MS;

    return mood;
  }

  private availableMoods(): string {
    return MOODS.map(({ name }) => name).join(', ');
  }
}
