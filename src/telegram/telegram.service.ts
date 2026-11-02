import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, BotError, Context, GrammyError } from 'grammy';
import { ChatTrackerService } from './chat-tracker.service';
import { LocationService } from './location.service';
import { POLL_CALLBACK } from './poll-menu';
import { PollCommandService } from './poll-command.service';
import { TimeService } from './time.service';

const HELP_TEXT = [
  'Вот что я умею:',
  '',
  '/настолки или /nastolki — создать опрос: чат, формат, стиль, день, время и место',
  '/locations — показать места и удалить ненужные',
  '/addlocation название — добавить место',
  '/times — показать время и удалить ненужное',
  '/addtime время — добавить время',
  '/chats — показать чаты для опросов',
  '/help — показать этот список',
].join('\n');

const isMessageNotModified = ({ error }: BotError): boolean =>
  error instanceof GrammyError && error.description.includes('message is not modified');

const cyrillicCommand = (name: string) => new RegExp(`^/${name}(?:\\s+(.+))?$`, 'is');

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot: Bot;

  private readonly ctrlChatId: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly chatTracker: ChatTrackerService,
    private readonly locationService: LocationService,
    private readonly timeService: TimeService,
    private readonly pollCommand: PollCommandService,
  ) {
    const token = this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    this.ctrlChatId = Number(this.configService.getOrThrow<string>('CTRL_CHAT_ID'));

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
      if (!isMessageNotModified(error)) {
        this.logger.error('Telegram bot error', error);
      }
    });

    this.bot.on('my_chat_member', (ctx) => this.chatTracker.handleMembershipChange(ctx));
    this.bot.on('message:new_chat_title', (ctx) => this.chatTracker.handleRename(ctx));
    this.bot.on('message:migrate_to_chat_id', (ctx) => this.chatTracker.handleMigration(ctx));

    const allowed = this.bot.filter((ctx: Context) => ctx.chat?.id === this.ctrlChatId);

    allowed.command('help', async (ctx) => {
      await ctx.reply(HELP_TEXT);
    });

    allowed.hears(cyrillicCommand('настолки'), (ctx) => this.pollCommand.openMenu(ctx));
    allowed.command('nastolki', (ctx) => this.pollCommand.openMenu(ctx));
    allowed.command('chats', (ctx) => this.pollCommand.listChats(ctx));
    allowed.callbackQuery(POLL_CALLBACK, (ctx) => this.pollCommand.handleMenuStep(ctx));

    allowed.command('locations', (ctx) => this.locationService.openMenu(ctx));
    allowed.callbackQuery(this.locationService.callbackPattern, (ctx) => this.locationService.handleMenuStep(ctx));
    allowed.command('addlocation', (ctx) => this.locationService.addItem(ctx));

    allowed.command('times', (ctx) => this.timeService.openMenu(ctx));
    allowed.callbackQuery(this.timeService.callbackPattern, (ctx) => this.timeService.handleMenuStep(ctx));
    allowed.command('addtime', (ctx) => this.timeService.addItem(ctx));
  }
}
