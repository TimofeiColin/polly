import { Injectable } from '@nestjs/common';
import { dataFilePath, readJsonArray, writeJsonArray } from '../../telegram/json-file';

export interface ScheduledPoll {
  readonly id: number;
  readonly chatId: number;
  readonly chatTitle: string;
  readonly question: string;
  readonly options: string[];
  readonly postAt: string;
  readonly gameAt: string;
}

const SCHEDULES_FILE = dataFilePath('schedules.json');

@Injectable()
export class ScheduleStoreService {
  private polls = readJsonArray<ScheduledPoll>(SCHEDULES_FILE);

  getAll(): readonly ScheduledPoll[] {
    return [...this.polls].sort((first, second) => first.postAt.localeCompare(second.postAt));
  }

  add(poll: Omit<ScheduledPoll, 'id'>): void {
    const id = Math.max(0, ...this.polls.map((saved) => saved.id)) + 1;

    this.polls = [...this.polls, { ...poll, id }];
    this.persist();
  }

  remove(id: number): void {
    this.polls = this.polls.filter((poll) => poll.id !== id);
    this.persist();
  }

  private persist(): void {
    writeJsonArray(SCHEDULES_FILE, this.polls);
  }
}
