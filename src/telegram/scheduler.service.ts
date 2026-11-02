import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { formatStamp } from './poll-menu';
import { PollSenderService } from './poll-sender.service';
import { ScheduleStoreService, ScheduledPoll } from './schedule-store.service';
import { wallClockStamp } from './wall-clock';

const HOUR_MS = 60 * 60 * 1000;
const CHECK_DELAY_MS = 1000;

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);

  private readonly ctrlChatId: number;
  private readonly timeZone: string;

  private timer?: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly bot: Bot,
    private readonly pollSender: PollSenderService,
    private readonly scheduleStore: ScheduleStoreService,
  ) {
    this.ctrlChatId = Number(this.configService.getOrThrow<string>('CTRL_CHAT_ID'));
    this.timeZone = this.configService.getOrThrow<string>('TIMEZONE');
  }

  onModuleInit(): void {
    void this.publishDuePolls();
    this.scheduleNextCheck();
  }

  onModuleDestroy(): void {
    clearTimeout(this.timer);
  }

  async publishDuePolls(): Promise<void> {
    const now = wallClockStamp(this.timeZone);
    const duePolls = this.scheduleStore.getAll().filter(({ postAt }) => postAt <= now);

    for (const poll of duePolls) {
      if (now >= poll.gameAt) {
        this.scheduleStore.remove(poll.id);
        await this.report(`⚠️ Опрос для чата «${poll.chatTitle}» пропущен: игра уже началась`);
        continue;
      }

      await this.publish(poll);
    }
  }

  private async publish(poll: ScheduledPoll): Promise<void> {
    try {
      await this.pollSender.send(poll.chatId, poll.question, poll.options);
    } catch (error) {
      this.logger.error('Failed to publish scheduled poll', error);
      await this.report(`⚠️ Не удалось отправить опрос в чат «${poll.chatTitle}», попробую через час`);
      return;
    }

    this.scheduleStore.remove(poll.id);
    await this.report(`✅ Запланированный опрос отправлен в чат «${poll.chatTitle}» (${formatStamp(poll.postAt)})`);
  }

  private async report(text: string): Promise<void> {
    try {
      await this.bot.api.sendMessage(this.ctrlChatId, text);
    } catch (error) {
      this.logger.error('Failed to report to the control chat', error);
    }
  }

  // Runs just after the top of each hour, so a poll set for 10:00 is not posted at 10:59
  private scheduleNextCheck(): void {
    const delay = HOUR_MS - (Date.now() % HOUR_MS) + CHECK_DELAY_MS;

    this.timer = setTimeout(() => {
      void this.publishDuePolls().finally(() => this.scheduleNextCheck());
    }, delay);
  }
}
