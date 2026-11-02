import { PollSize, formatShortDate } from '../../moods';
import { ListItem } from '../../telegram/editable-list.service';

export type PollStepKey = 'target' | 'size' | 'mood' | 'day' | 'time' | 'location' | 'postDaysBefore' | 'postHour';

// Only the steps already passed are set: a step can rely on the ones before it, describeChoices checks each one
export type PollChoices = Readonly<Record<PollStepKey, string>>;

export interface PollTarget {
  readonly chatId: number;
  readonly title: string;
}

export interface PollMenuData {
  readonly targets: readonly PollTarget[];
  readonly times: readonly ListItem[];
  readonly locations: readonly ListItem[];
  readonly now: string;
}

export const RANDOM_MOOD = 'r';

export const SIZE_LABELS: Record<PollSize, string> = {
  full: 'Полный (5 вариантов)',
  short: 'Короткий (3 варианта)',
  minimal: 'Минимальный (2 варианта)',
};

export const parseDay = (day: string): Date =>
  new Date(Number(day.slice(0, 4)), Number(day.slice(4, 6)) - 1, Number(day.slice(6, 8)));

export const encodeDay = (date: Date): string =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('');

export const formatTime = (time: string): string => `${time.slice(0, 2)}:${time.slice(2)}`;

export const formatStamp = (stamp: string): string =>
  `${formatShortDate(parseDay(stamp.slice(0, 8)))}, ${formatTime(stamp.slice(8, 12))}`;

export const getPostDate = (day: string, daysBefore: string): Date => {
  const game = parseDay(day);

  return new Date(game.getFullYear(), game.getMonth(), game.getDate() - Number(daysBefore));
};

export const postStamp = (day: string, daysBefore: string, hour: string): string =>
  `${encodeDay(getPostDate(day, daysBefore))}${hour}00`;

export const getGameAt = ({ day, time }: PollChoices): string => `${day}${time}`;

export const getPostAt = ({ day, postDaysBefore, postHour }: PollChoices): string =>
  postStamp(day, postDaysBefore, postHour);

export const findTarget = (targets: readonly PollTarget[], value: string): PollTarget | undefined =>
  targets.find(({ chatId }) => String(chatId) === value);

export const findLocation = (locations: readonly ListItem[], value: string): ListItem | undefined =>
  locations.find(({ id }) => String(id) === value);
