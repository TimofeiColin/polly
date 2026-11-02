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

const CALLBACK_PREFIX = 'poll';
export const CANCEL_STEP = 'cancel';
export const SEND_STEP = 'send';
export const POLL_CALLBACK = new RegExp(`^${CALLBACK_PREFIX}(?::.+)?$`);

const DAYS_AHEAD = 6;

export interface PollMenuData {
  readonly targets: readonly PollTarget[];
  readonly times: readonly ListItem[];
  readonly locations: readonly ListItem[];
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
  readonly buttons: (data: PollMenuData) => MenuButton[];
  readonly perRow: number;
  readonly emptyPrompt?: string;
}

const callbackData = (...steps: string[]): string => [CALLBACK_PREFIX, ...steps].join(':');

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

const dayButtons = (): MenuButton[] => {
  const today = new Date();

  return Array.from({ length: DAYS_AHEAD }, (_, offset) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset + 1);

    return { label: formatShortDate(date), value: encodeDay(date) };
  });
};

const timeButtons = ({ times }: PollMenuData): MenuButton[] =>
  times.map(({ name }) => ({ label: name, value: name.replace(':', '') }));

const locationButtons = ({ locations }: PollMenuData): MenuButton[] =>
  locations.map(({ id, name }) => ({ label: name, value: String(id) }));

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

export const findTarget = (targets: readonly PollTarget[], step: string): PollTarget | undefined =>
  targets.find(({ chatId }) => String(chatId) === step);

export const findLocation = (locations: readonly ListItem[], step: string): ListItem | undefined =>
  locations.find(({ id }) => String(id) === step);

export const describeSteps = ([target, size, mood, day, time, location]: string[], data: PollMenuData): string =>
  [
    target && `Чат: ${findTarget(data.targets, target)?.title ?? target}`,
    size && `Формат: ${SIZE_LABELS[size as PollSize]}`,
    mood && `Стиль: ${mood === RANDOM_MOOD ? 'сюрприз' : MOODS[Number(mood)].name}`,
    day && `День: ${formatShortDate(parseDay(day))}`,
    time && `Время: ${formatTime(time)}`,
    location && `Место: ${findLocation(data.locations, location)?.name ?? 'удалено'}`,
  ]
    .filter(Boolean)
    .join('\n');

export const buildPoll = ([, size, , day, time, location, variant]: string[], data: PollMenuData): PollText => {
  const when = createPollWhen(parseDay(day), formatTime(time));
  const { question, options } = buildPollText(MOODS, decodePollVariant(variant), size as PollSize, when);

  return {
    question: `${question}\n📍 Место встречи: ${findLocation(data.locations, location)?.name ?? 'удалено'}`,
    options,
  };
};

const addNavigation = (keyboard: InlineKeyboard, steps: string[]): InlineKeyboard => {
  if (steps.length) {
    keyboard.text('⬅️ Назад', callbackData(...steps.slice(0, -1)));
  }

  return keyboard.text('✖️ Отмена', callbackData(CANCEL_STEP));
};

export const renderPollMenu = (steps: string[], data: PollMenuData): PollMenu => {
  const summary = describeSteps(steps, data);
  const menuStep = MENU_STEPS[steps.length];

  if (!menuStep) {
    const [, size, mood] = steps;
    const moodIndex = mood === RANDOM_MOOD ? undefined : Number(mood);
    const variant = encodePollVariant(createPollVariant(MOODS, moodIndex, size as PollSize));
    const { question, options } = buildPoll([...steps, variant], data);
    const preview = [question, '', ...options.map((option) => `▫️ ${option}`)].join('\n');

    return {
      text: `${summary}\n\nТак будет выглядеть опрос:\n\n${preview}\n\nОтправляем?`,
      keyboard: addNavigation(
        new InlineKeyboard()
          .text('✅ Отправить', callbackData(...steps, variant, SEND_STEP))
          .row()
          .text('🎲 Другой текст', callbackData(...steps))
          .row(),
        steps,
      ),
    };
  }

  const buttons = menuStep.buttons(data);
  const prompt = buttons.length ? menuStep.prompt : (menuStep.emptyPrompt ?? menuStep.prompt);
  const keyboard = new InlineKeyboard();

  buttons.forEach(({ label, value }, index) => {
    if (index > 0 && index % menuStep.perRow === 0) {
      keyboard.row();
    }

    keyboard.text(label, callbackData(...steps, value));
  });

  return {
    text: summary ? `${summary}\n\n${prompt}` : prompt,
    keyboard: addNavigation(buttons.length ? keyboard.row() : keyboard, steps),
  };
};
