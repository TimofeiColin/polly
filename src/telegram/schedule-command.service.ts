import { Injectable } from '@nestjs/common';
import { CallbackQueryContext, Context, InlineKeyboard } from 'grammy';
import { PollCommandService } from './poll-command.service';
import {
  CANCEL_STEP,
  SCHEDULE_FLOW,
  SEND_STEP,
  formatStamp,
  getGameAt,
  getPostAt,
  parseSteps,
  renderPollMenu,
} from './poll-menu';
import { ScheduleStoreService, ScheduledPoll } from './schedule-store.service';

const LIST_PREFIX = 'planned';
const CLOSE_STEP = 'close';
const REMOVE_STEP = 'remove';
export const SCHEDULE_LIST_CALLBACK = new RegExp(`^${LIST_PREFIX}(?::.+)?$`);

const listCallback = (...steps: (string | number)[]): string => [LIST_PREFIX, ...steps].join(':');

const describePoll = ({ postAt, chatTitle }: ScheduledPoll): string => `⏰ ${formatStamp(postAt)} → ${chatTitle}`;

@Injectable()
export class ScheduleCommandService {
  constructor(
    private readonly pollCommand: PollCommandService,
    private readonly scheduleStore: ScheduleStoreService,
  ) {}

  async openMenu(ctx: Context): Promise<void> {
    const { text, keyboard } = renderPollMenu([], this.pollCommand.getMenuData(), SCHEDULE_FLOW);

    await ctx.reply(text, { reply_markup: keyboard });
  }

  async handleMenuStep(ctx: CallbackQueryContext<Context>): Promise<void> {
    await ctx.answerCallbackQuery();

    const steps = parseSteps(ctx.callbackQuery.data);

    if (steps[0] === CANCEL_STEP) {
      await ctx.editMessageText('Ну и ладно 😝');
      return;
    }

    if (steps.at(-1) === SEND_STEP) {
      await this.schedulePoll(ctx, steps.slice(0, -2), steps.at(-2) ?? '');
      return;
    }

    const { text, keyboard } = renderPollMenu(steps, this.pollCommand.getMenuData(), SCHEDULE_FLOW);

    await ctx.editMessageText(text, { reply_markup: keyboard });
  }

  async openList(ctx: Context): Promise<void> {
    await ctx.reply(this.listText(), { reply_markup: this.listKeyboard() });
  }

  async handleListStep(ctx: CallbackQueryContext<Context>): Promise<void> {
    const [step, action] = parseSteps(ctx.callbackQuery.data);

    if (step === CLOSE_STEP) {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(this.listText());
      return;
    }

    const poll = this.scheduleStore.getAll().find(({ id }) => String(id) === step);

    await ctx.answerCallbackQuery(step && !poll ? { text: 'Этого опроса уже нет в списке' } : undefined);

    if (poll && !action) {
      await ctx.editMessageText(`${describePoll(poll)}\n\n${poll.question}`, {
        reply_markup: new InlineKeyboard()
          .text('🗑 Удалить', listCallback(poll.id, REMOVE_STEP))
          .text('⬅️ Назад', listCallback()),
      });
      return;
    }

    if (poll) {
      this.scheduleStore.remove(poll.id);
    }

    await ctx.editMessageText(this.listText(), { reply_markup: this.listKeyboard() });
  }

  private async schedulePoll(ctx: CallbackQueryContext<Context>, steps: string[], variant: string): Promise<void> {
    const prepared = await this.pollCommand.preparePoll(ctx, steps, variant);

    if (!prepared) {
      return;
    }

    const { target, poll, summary } = prepared;
    const postAt = getPostAt(steps);
    const gameAt = getGameAt(steps);

    if (postAt <= this.pollCommand.getMenuData().now || postAt >= gameAt) {
      await ctx.editMessageText(`${summary}\n\nЭто время уже не подходит, начни заново: /schedule`);
      return;
    }

    // Removes the buttons first, so a second tap fails here instead of saving a duplicate
    await ctx.editMessageText(`${summary}\n\nСохраняю...`);

    this.scheduleStore.add({ chatId: target.chatId, chatTitle: target.title, ...poll, postAt, gameAt });

    await ctx.editMessageText(`${summary}\n\n⏰ Опрос запланирован! Список: /schedules`);
  }

  private listText(): string {
    const list = this.scheduleStore.getAll().map(describePoll).join('\n');

    return `Запланированные опросы:\n\n${list || 'Пока ничего не запланировано'}\n\nНажми на опрос, чтобы посмотреть или удалить его.`;
  }

  private listKeyboard(): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    this.scheduleStore.getAll().forEach((poll) => {
      keyboard.text(`${formatStamp(poll.postAt)} → ${poll.chatTitle}`, listCallback(poll.id)).row();
    });

    return keyboard.text('✖️ Закрыть', listCallback(CLOSE_STEP));
  }
}
