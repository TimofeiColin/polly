import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CallbackQueryContext, Context } from 'grammy';
import { PollText } from '../moods';
import { ChatStoreService } from './chat-store.service';
import { LocationService } from './location.service';
import { PollSenderService } from './poll-sender.service';
import { TimeService } from './time.service';
import { wallClockStamp } from './wall-clock';
import {
  CANCEL_STEP,
  POLL_FLOW,
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

export interface PreparedPoll {
  readonly target: PollTarget;
  readonly poll: PollText;
  readonly summary: string;
}

@Injectable()
export class PollCommandService {
  private readonly logger = new Logger(PollCommandService.name);

  private readonly ctrlChatId: number;
  private readonly mainChatId: number;
  private readonly timeZone: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly chatStore: ChatStoreService,
    private readonly locationService: LocationService,
    private readonly timeService: TimeService,
    private readonly pollSender: PollSenderService,
  ) {
    this.ctrlChatId = Number(this.configService.getOrThrow<string>('CTRL_CHAT_ID'));
    this.mainChatId = Number(this.configService.getOrThrow<string>('MAIN_CHAT_ID'));
    this.timeZone = this.configService.getOrThrow<string>('TIMEZONE');
  }

  async openMenu(ctx: Context): Promise<void> {
    const { text, keyboard } = renderPollMenu([], this.getMenuData(), POLL_FLOW);

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
      await this.publishPoll(ctx, steps.slice(0, -2), steps.at(-2) ?? '');
      return;
    }

    const { text, keyboard } = renderPollMenu(steps, this.getMenuData(), POLL_FLOW);

    await ctx.editMessageText(text, { reply_markup: keyboard });
  }

  async preparePoll(
    ctx: CallbackQueryContext<Context>,
    steps: string[],
    variant: string,
  ): Promise<PreparedPoll | undefined> {
    const [target, , , , , location] = steps;
    const data = this.getMenuData();
    const summary = describeSteps(steps, data);
    const pollTarget = findTarget(data.targets, target);

    if (!pollTarget) {
      await ctx.editMessageText(`${summary}\n\nЭтого чата больше нет в списке 🤷`);
      return undefined;
    }

    if (!findLocation(data.locations, location)) {
      await ctx.editMessageText(`${summary}\n\nЭтого места больше нет в списке 🤷`);
      return undefined;
    }

    return { target: pollTarget, poll: buildPoll(steps, variant, data), summary };
  }

  getMenuData(): PollMenuData {
    return {
      targets: this.getTargets(),
      times: this.timeService.getAll(),
      locations: this.locationService.getAll(),
      now: wallClockStamp(this.timeZone),
    };
  }

  private async publishPoll(ctx: CallbackQueryContext<Context>, steps: string[], variant: string): Promise<void> {
    const prepared = await this.preparePoll(ctx, steps, variant);

    if (!prepared) {
      return;
    }

    const { target, poll, summary } = prepared;

    await ctx.editMessageText(`${summary}\n\nОтправляю...`);

    try {
      await this.pollSender.send(target.chatId, poll.question, poll.options);

      await ctx.editMessageText(`${summary}\n\n✅ Опрос отправлен!`);
    } catch (error) {
      this.logger.error('Failed to publish poll', error);

      await ctx.editMessageText(`${summary}\n\nЧто-то пошло не так ..`);
    }
  }

  private getTargets(): PollTarget[] {
    const configured = [this.ctrlChatId, this.mainChatId];

    return [
      { chatId: this.mainChatId, title: 'Главный' },
      ...this.chatStore.getAll().filter(({ chatId }) => !configured.includes(chatId)),
    ];
  }
}
