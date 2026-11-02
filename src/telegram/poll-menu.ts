import { InlineKeyboard } from 'grammy';
import {
  MOODS,
  PollSize,
  PollText,
  buildPollText,
  createPollVariant,
  createPollWhen,
  decodePollVariant,
  encodePollVariant,
  formatShortDate,
} from '../moods';
import { ListItem } from './editable-list.service';

export interface PollTarget {
  readonly chatId: number;
  readonly title: string;
}

export const RANDOM_MOOD = 'r';

const SIZE_LABELS: Record<PollSize, string> = {
  full: 'Полный (5 вариантов)',
  short: 'Короткий (3 варианта)',
  minimal: 'Минимальный (2 варианта)',
};

export const CANCEL_STEP = 'cancel';
export const SEND_STEP = 's';

const DAYS_AHEAD = 6;
const DAY_MS = 24 * 60 * 60 * 1000;
const POST_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

export interface PollMenuData {
  readonly targets: readonly PollTarget[];
  readonly times: readonly ListItem[];
  readonly locations: readonly ListItem[];
  readonly now: string;
}

export interface PollMenu {
  readonly text: string;
  readonly keyboard: InlineKeyboard;
}

interface MenuButton {
  readonly label: string;
  readonly value: string;
}

interface MenuStep {
  readonly prompt: string;
  readonly buttons: (data: PollMenuData, steps: string[]) => MenuButton[];
  readonly perRow: number;
  readonly emptyPrompt?: string;
}

export interface PollFlow {
  readonly prefix: string;
  readonly steps: readonly MenuStep[];
  readonly confirmPrompt: string;
  readonly confirmLabel: string;
}

const callbackData = ({ prefix }: PollFlow, ...steps: string[]): string => [prefix, ...steps].join(':');

export const flowCallback = ({ prefix }: PollFlow): RegExp => new RegExp(`^${prefix}(?::.+)?$`);

export const parseSteps = (data: string): string[] => data.split(':').slice(1);

export const parseDay = (day: string): Date =>
  new Date(Number(day.slice(0, 4)), Number(day.slice(4, 6)) - 1, Number(day.slice(6, 8)));

export const formatTime = (time: string): string => `${time.slice(0, 2)}:${time.slice(2)}`;

const encodeDay = (date: Date): string =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('');

const targetButtons = ({ targets }: PollMenuData): MenuButton[] =>
  targets.map(({ chatId, title }) => ({ label: title, value: String(chatId) }));

const sizeButtons = (): MenuButton[] => Object.entries(SIZE_LABELS).map(([value, label]) => ({ label, value }));

const moodButtons = (): MenuButton[] => [
  ...MOODS.map(({ name }, index) => ({ label: name, value: String(index) })),
  { label: '🎲 Сюрприз', value: RANDOM_MOOD },
];

const dayButtons = ({ now }: PollMenuData): MenuButton[] => {
  const today = parseDay(now.slice(0, 8));

  return Array.from({ length: DAYS_AHEAD }, (_, offset) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset + 1);

    return { label: formatShortDate(date), value: encodeDay(date) };
  });
};

const timeButtons = ({ times }: PollMenuData): MenuButton[] =>
  times.map(({ name }) => ({ label: name, value: name.replace(':', '') }));

const locationButtons = ({ locations }: PollMenuData): MenuButton[] =>
  locations.map(({ id, name }) => ({ label: name, value: String(id) }));

const postDay = (day: string, daysBefore: string): Date => {
  const game = parseDay(day);

  return new Date(game.getFullYear(), game.getMonth(), game.getDate() - Number(daysBefore));
};

const postStamp = (day: string, daysBefore: string, hour: string): string =>
  `${encodeDay(postDay(day, daysBefore))}${hour}00`;

const availablePostHours = (now: string, [, , , day, time]: string[], daysBefore: string): string[] =>
  POST_HOURS.map((hour) => String(hour).padStart(2, '0')).filter((hour) => {
    const stamp = postStamp(day, daysBefore, hour);

    return stamp > now && stamp < `${day}${time}`;
  });

const postDayButtons = ({ now }: PollMenuData, steps: string[]): MenuButton[] => {
  const day = steps[3];
  const daysUntilGame = Math.round((parseDay(day).getTime() - parseDay(now.slice(0, 8)).getTime()) / DAY_MS);

  return Array.from({ length: daysUntilGame + 1 }, (_, offset) => String(daysUntilGame - offset))
    .filter((daysBefore) => availablePostHours(now, steps, daysBefore).length)
    .map((daysBefore) => ({ label: formatShortDate(postDay(day, daysBefore)), value: daysBefore }));
};

const postHourButtons = ({ now }: PollMenuData, steps: string[]): MenuButton[] =>
  availablePostHours(now, steps, steps[6]).map((hour) => ({ label: `${hour}:00`, value: hour }));

const MENU_STEPS: MenuStep[] = [
  { prompt: 'Куда отправить опрос?', buttons: targetButtons, perRow: 2 },
  { prompt: 'Какой формат?', buttons: sizeButtons, perRow: 1 },
  { prompt: 'Какой стиль?', buttons: moodButtons, perRow: 2 },
  { prompt: 'Какой день?', buttons: dayButtons, perRow: 2 },
  {
    prompt: 'Во сколько?',
    buttons: timeButtons,
    perRow: 3,
    emptyPrompt: 'Пока нет ни одного времени. Добавь его: /addtime 18:30',
  },
  {
    prompt: 'Где играем?',
    buttons: locationButtons,
    perRow: 2,
    emptyPrompt: 'Пока нет ни одного места. Добавь его: /addlocation название',
  },
];

export const POLL_FLOW: PollFlow = {
  prefix: 'poll',
  steps: MENU_STEPS,
  confirmPrompt: 'Отправляем?',
  confirmLabel: '✅ Отправить',
};

export const SCHEDULE_FLOW: PollFlow = {
  prefix: 'sch',
  steps: [
    ...MENU_STEPS,
    {
      prompt: 'В какой день опубликовать опрос?',
      buttons: postDayButtons,
      perRow: 2,
      emptyPrompt: 'До игры не осталось подходящего времени для публикации',
    },
    { prompt: 'Во сколько опубликовать опрос?', buttons: postHourButtons, perRow: 4 },
  ],
  confirmPrompt: 'Планируем?',
  confirmLabel: '⏰ Запланировать',
};

export const formatStamp = (stamp: string): string =>
  `${formatShortDate(parseDay(stamp.slice(0, 8)))}, ${formatTime(stamp.slice(8, 12))}`;

export const getGameAt = ([, , , day, time]: string[]): string => `${day}${time}`;

export const getPostAt = ([, , , day, , , daysBefore, hour]: string[]): string => postStamp(day, daysBefore, hour);

export const findTarget = (targets: readonly PollTarget[], step: string): PollTarget | undefined =>
  targets.find(({ chatId }) => String(chatId) === step);

export const findLocation = (locations: readonly ListItem[], step: string): ListItem | undefined =>
  locations.find(({ id }) => String(id) === step);

export const describeSteps = (
  [target, size, mood, day, time, location, daysBefore, hour]: string[],
  data: PollMenuData,
): string =>
  [
    target && `Чат: ${findTarget(data.targets, target)?.title ?? target}`,
    size && `Формат: ${SIZE_LABELS[size as PollSize]}`,
    mood && `Стиль: ${mood === RANDOM_MOOD ? 'сюрприз' : MOODS[Number(mood)].name}`,
    day && `День: ${formatShortDate(parseDay(day))}`,
    time && `Время: ${formatTime(time)}`,
    location && `Место: ${findLocation(data.locations, location)?.name ?? 'удалено'}`,
    daysBefore && `День публикации: ${formatShortDate(postDay(day, daysBefore))}`,
    hour && `Время публикации: ${hour}:00`,
  ]
    .filter(Boolean)
    .join('\n');

export const buildPoll = ([, size, , day, time, location]: string[], variant: string, data: PollMenuData): PollText => {
  const when = createPollWhen(parseDay(day), formatTime(time));
  const { question, options } = buildPollText(MOODS, decodePollVariant(variant), size as PollSize, when);

  return {
    question: `${question}\n📍 Место встречи: ${findLocation(data.locations, location)?.name ?? 'удалено'}`,
    options,
  };
};

const addNavigation = (keyboard: InlineKeyboard, steps: string[], flow: PollFlow): InlineKeyboard => {
  if (steps.length) {
    keyboard.text('⬅️ Назад', callbackData(flow, ...steps.slice(0, -1)));
  }

  return keyboard.text('✖️ Отмена', callbackData(flow, CANCEL_STEP));
};

export const renderPollMenu = (steps: string[], data: PollMenuData, flow: PollFlow): PollMenu => {
  const summary = describeSteps(steps, data);
  const menuStep = flow.steps[steps.length];

  if (!menuStep) {
    const [, size, mood] = steps;
    const moodIndex = mood === RANDOM_MOOD ? undefined : Number(mood);
    const variant = encodePollVariant(createPollVariant(MOODS, moodIndex, size as PollSize));
    const { question, options } = buildPoll(steps, variant, data);
    const preview = [question, '', ...options.map((option) => `▫️ ${option}`)].join('\n');

    return {
      text: `${summary}\n\nТак будет выглядеть опрос:\n\n${preview}\n\n${flow.confirmPrompt}`,
      keyboard: addNavigation(
        new InlineKeyboard()
          .text(flow.confirmLabel, callbackData(flow, ...steps, variant, SEND_STEP))
          .row()
          .text('🎲 Другой текст', callbackData(flow, ...steps))
          .row(),
        steps,
        flow,
      ),
    };
  }

  const buttons = menuStep.buttons(data, steps);
  const prompt = buttons.length ? menuStep.prompt : (menuStep.emptyPrompt ?? menuStep.prompt);
  const keyboard = new InlineKeyboard();

  buttons.forEach(({ label, value }, index) => {
    if (index > 0 && index % menuStep.perRow === 0) {
      keyboard.row();
    }

    keyboard.text(label, callbackData(flow, ...steps, value));
  });

  return {
    text: summary ? `${summary}\n\n${prompt}` : prompt,
    keyboard: addNavigation(buttons.length ? keyboard.row() : keyboard, steps, flow),
  };
};
