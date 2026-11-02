import { MOODS, formatShortDate } from '../../moods';
import {
  PollChoices,
  PollMenuData,
  PollStepKey,
  RANDOM_MOOD,
  SIZE_LABELS,
  encodeDay,
  getGameAt,
  getPostDate,
  parseDay,
  postStamp,
} from './poll-choices';

export interface MenuButton {
  readonly label: string;
  readonly value: string;
}

export interface PollStep {
  readonly key: PollStepKey;
  readonly prompt: string;
  readonly buttons: (data: PollMenuData, choices: PollChoices) => MenuButton[];
  readonly perRow: number;
  readonly emptyPrompt?: string;
}

const DAYS_AHEAD = 6;
const DAY_MS = 24 * 60 * 60 * 1000;
const POST_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

const availablePostHours = (now: string, choices: PollChoices, daysBefore: string): string[] =>
  POST_HOURS.map((hour) => String(hour).padStart(2, '0')).filter((hour) => {
    const stamp = postStamp(choices.day, daysBefore, hour);

    return stamp > now && stamp < getGameAt(choices);
  });

const targetStep: PollStep = {
  key: 'target',
  prompt: 'Куда отправить опрос?',
  perRow: 2,
  buttons: ({ targets }) => targets.map(({ chatId, title }) => ({ label: title, value: String(chatId) })),
};

const sizeStep: PollStep = {
  key: 'size',
  prompt: 'Какой формат?',
  perRow: 1,
  buttons: () => Object.entries(SIZE_LABELS).map(([value, label]) => ({ label, value })),
};

const moodStep: PollStep = {
  key: 'mood',
  prompt: 'Какой стиль?',
  perRow: 2,
  buttons: () => [
    ...MOODS.map(({ name }, index) => ({ label: name, value: String(index) })),
    { label: '🎲 Сюрприз', value: RANDOM_MOOD },
  ],
};

const dayStep: PollStep = {
  key: 'day',
  prompt: 'Какой день?',
  perRow: 2,
  buttons: ({ now }) => {
    const today = parseDay(now.slice(0, 8));

    return Array.from({ length: DAYS_AHEAD }, (_, offset) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset + 1);

      return { label: formatShortDate(date), value: encodeDay(date) };
    });
  },
};

const timeStep: PollStep = {
  key: 'time',
  prompt: 'Во сколько?',
  emptyPrompt: 'Пока нет ни одного времени. Добавь его: /addtime 18:30',
  perRow: 3,
  buttons: ({ times }) => times.map(({ name }) => ({ label: name, value: name.replace(':', '') })),
};

const locationStep: PollStep = {
  key: 'location',
  prompt: 'Где играем?',
  emptyPrompt: 'Пока нет ни одного места. Добавь его: /addlocation название',
  perRow: 2,
  buttons: ({ locations }) => locations.map(({ id, name }) => ({ label: name, value: String(id) })),
};

const postDayStep: PollStep = {
  key: 'postDaysBefore',
  prompt: 'В какой день опубликовать опрос?',
  emptyPrompt: 'До игры не осталось подходящего времени для публикации',
  perRow: 2,
  buttons: ({ now }, choices) => {
    const { day } = choices;
    const daysUntilGame = Math.round((parseDay(day).getTime() - parseDay(now.slice(0, 8)).getTime()) / DAY_MS);

    return Array.from({ length: daysUntilGame + 1 }, (_, offset) => String(daysUntilGame - offset))
      .filter((daysBefore) => availablePostHours(now, choices, daysBefore).length)
      .map((daysBefore) => ({ label: formatShortDate(getPostDate(day, daysBefore)), value: daysBefore }));
  },
};

const postHourStep: PollStep = {
  key: 'postHour',
  prompt: 'Во сколько опубликовать опрос?',
  perRow: 4,
  buttons: ({ now }, choices) =>
    availablePostHours(now, choices, choices.postDaysBefore).map((hour) => ({ label: `${hour}:00`, value: hour })),
};

export const POLL_STEPS: readonly PollStep[] = [targetStep, sizeStep, moodStep, dayStep, timeStep, locationStep];

export const SCHEDULE_STEPS: readonly PollStep[] = [...POLL_STEPS, postDayStep, postHourStep];
