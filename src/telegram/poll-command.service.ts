import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CallbackQueryContext, Context, GrammyError } from 'grammy';
import { ChatStoreService } from './chat-store.service';
import { LocationService } from './location.service';
import { TimeService } from './time.service';
import {
  CANCEL_STEP,
  PollMenuData,
  PollTarget,
  SEND_STEP,
  buildPoll,
  describeSteps,
  findLocation,
  findTarget,
  parseSteps,
  renderPollMenu,
} from './poll-menu';

const POLL_SETTINGS = {
  is_anonymous: false,
  allow_adding_options: false,
  allows_revoting: true,
};

@Injectable()
export class PollCommandService {
  private readonly logger = new Logger(PollCommandService.name);

  private readonly ctrlChatId: number;
  private readonly mainChatId: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly chatStore: ChatStoreService,
    private readonly locationService: LocationService,
    private readonly timeService: TimeService,
  ) {
    this.ctrlChatId = Number(this.configService.getOrThrow<string>('CTRL_CHAT_ID'));
    this.mainChatId = Number(this.configService.getOrThrow<string>('MAIN_CHAT_ID'));
  }

  async openMenu(ctx: Context): Promise<void> {
    const { text, keyboard } = renderPollMenu([], this.getMenuData());

    await ctx.reply(text, { reply_markup: keyboard });
  }

  async listChats(ctx: Context): Promise<void> {
    const list = this.getTargets()
      .map(({ title }) => `💬 ${title}`)
      .join('\n');

    await ctx.reply(`Куда я могу отправлять опросы:\n\n${list}`);
  }

  async handleMenuStep(ctx: CallbackQueryContext<Context>): Promise<void> {
    await ctx.answerCallbackQuery();

    const steps = parseSteps(ctx.callbackQuery.data);

    if (steps[0] === CANCEL_STEP) {
      await ctx.editMessageText('Ну и ладно 😝');
      return;
    }

    if (steps.at(-1) === SEND_STEP) {
      await this.publishPoll(ctx, steps.slice(0, -1));
      return;
    }

    const { text, keyboard } = renderPollMenu(steps, this.getMenuData());

    await ctx.editMessageText(text, { reply_markup: keyboard });
  }

  private async publishPoll(ctx: CallbackQueryContext<Context>, steps: string[]): Promise<void> {
    const [target, , , , , location] = steps;
    const data = this.getMenuData();
    const summary = describeSteps(steps, data);
    const pollTarget = findTarget(data.targets, target);
    const pollLocation = findLocation(data.locations, location);

    if (!pollTarget) {
      await ctx.editMessageText(`${summary}\n\nЭтого чата больше нет в списке 🤷`);
      return;
    }

    if (!pollLocation) {
      await ctx.editMessageText(`${summary}\n\nЭтого места больше нет в списке 🤷`);
      return;
    }

    await ctx.editMessageText(`${summary}\n\nОтправляю...`);

    const { question, options } = buildPoll(steps, data);

    try {
      await this.sendPoll(ctx, pollTarget.chatId, question, options);

      await ctx.editMessageText(`${summary}\n\n✅ Опрос отправлен!`);
    } catch (error) {
      this.logger.error('Failed to publish poll', error);

      await ctx.editMessageText(`${summary}\n\nЧто-то пошло не так ..`);
    }
  }

  private async sendPoll(ctx: Context, chatId: number, question: string, options: string[]): Promise<void> {
    try {
      await ctx.api.sendPoll(chatId, question, options, POLL_SETTINGS);
    } catch (error) {
      const newChatId = error instanceof GrammyError ? error.parameters.migrate_to_chat_id : undefined;

      if (!newChatId) {
        throw error;
      }

      this.chatStore.migrate(chatId, newChatId);
      await ctx.api.sendPoll(newChatId, question, options, POLL_SETTINGS);
    }
  }

  private getMenuData(): PollMenuData {
    return { targets: this.getTargets(), times: this.timeService.getAll(), locations: this.locationService.getAll() };
  }

  private getTargets(): PollTarget[] {
    const configured = [this.ctrlChatId, this.mainChatId];

    return [
      { chatId: this.mainChatId, title: 'Главный' },
      ...this.chatStore.getAll().filter(({ chatId }) => !configured.includes(chatId)),
    ];
  }
}
