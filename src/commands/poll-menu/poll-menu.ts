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
} from '../../moods';
import {
  PollChoices,
  PollMenuData,
  PollStepKey,
  RANDOM_MOOD,
  SIZE_LABELS,
  findLocation,
  findTarget,
  formatTime,
  getPostDate,
  parseDay,
} from './poll-choices';
import { POLL_STEPS, PollStep, SCHEDULE_STEPS } from './poll-steps';

export const CANCEL_STEP = 'cancel';
export const SEND_STEP = 's';

export interface PollMenu {
  readonly text: string;
  readonly keyboard: InlineKeyboard;
}

export interface PollFlow {
  readonly prefix: string;
  readonly steps: readonly PollStep[];
  readonly confirmPrompt: string;
  readonly confirmLabel: string;
}

export const POLL_FLOW: PollFlow = {
  prefix: 'poll',
  steps: POLL_STEPS,
  confirmPrompt: 'Отправляем?',
  confirmLabel: '✅ Отправить',
};

export const SCHEDULE_FLOW: PollFlow = {
  prefix: 'sch',
  steps: SCHEDULE_STEPS,
  confirmPrompt: 'Планируем?',
  confirmLabel: '⏰ Запланировать',
};

const callbackData = ({ prefix }: PollFlow, ...values: string[]): string => [prefix, ...values].join(':');

export const flowCallback = ({ prefix }: PollFlow): RegExp => new RegExp(`^${prefix}(?::.+)?$`);

export const parseValues = (data: string): string[] => data.split(':').slice(1);

export const parseChoices = (values: string[], flow: PollFlow): PollChoices => {
  const entries = values.map((value, index): [PollStepKey, string] => [flow.steps[index].key, value]);

  return Object.fromEntries(entries) as PollChoices;
};

export const describeChoices = (
  { target, size, mood, day, time, location, postDaysBefore, postHour }: Partial<PollChoices>,
  data: PollMenuData,
): string =>
  [
    target && `Чат: ${findTarget(data.targets, target)?.title ?? target}`,
    size && `Формат: ${SIZE_LABELS[size as PollSize]}`,
    mood && `Стиль: ${mood === RANDOM_MOOD ? 'сюрприз' : MOODS[Number(mood)].name}`,
    day && `День: ${formatShortDate(parseDay(day))}`,
    time && `Время: ${formatTime(time)}`,
    location && `Место: ${findLocation(data.locations, location)?.name ?? 'удалено'}`,
    day && postDaysBefore && `День публикации: ${formatShortDate(getPostDate(day, postDaysBefore))}`,
    postHour && `Время публикации: ${postHour}:00`,
  ]
    .filter(Boolean)
    .join('\n');

export const buildPoll = (
  { size, day, time, location }: PollChoices,
  variant: string,
  data: PollMenuData,
): PollText => {
  const when = createPollWhen(parseDay(day), formatTime(time));
  const { question, options } = buildPollText(MOODS, decodePollVariant(variant), size as PollSize, when);

  return {
    question: `${question}\n📍 Место встречи: ${findLocation(data.locations, location)?.name ?? 'удалено'}`,
    options,
  };
};

const addNavigation = (keyboard: InlineKeyboard, values: string[], flow: PollFlow): InlineKeyboard => {
  if (values.length) {
    keyboard.text('⬅️ Назад', callbackData(flow, ...values.slice(0, -1)));
  }

  return keyboard.text('✖️ Отмена', callbackData(flow, CANCEL_STEP));
};

const renderConfirmation = (
  values: string[],
  choices: PollChoices,
  summary: string,
  data: PollMenuData,
  flow: PollFlow,
): PollMenu => {
  const moodIndex = choices.mood === RANDOM_MOOD ? undefined : Number(choices.mood);
  const variant = encodePollVariant(createPollVariant(MOODS, moodIndex, choices.size as PollSize));
  const { question, options } = buildPoll(choices, variant, data);
  const preview = [question, '', ...options.map((option) => `▫️ ${option}`)].join('\n');

  return {
    text: `${summary}\n\nТак будет выглядеть опрос:\n\n${preview}\n\n${flow.confirmPrompt}`,
    keyboard: addNavigation(
      new InlineKeyboard()
        .text(flow.confirmLabel, callbackData(flow, ...values, variant, SEND_STEP))
        .row()
        .text('🎲 Другой текст', callbackData(flow, ...values))
        .row(),
      values,
      flow,
    ),
  };
};

const renderStep = (
  step: PollStep,
  values: string[],
  choices: PollChoices,
  summary: string,
  data: PollMenuData,
  flow: PollFlow,
): PollMenu => {
  const buttons = step.buttons(data, choices);
  const prompt = buttons.length ? step.prompt : (step.emptyPrompt ?? step.prompt);
  const keyboard = new InlineKeyboard();

  buttons.forEach(({ label, value }, index) => {
    if (index > 0 && index % step.perRow === 0) {
      keyboard.row();
    }

    keyboard.text(label, callbackData(flow, ...values, value));
  });

  return {
    text: summary ? `${summary}\n\n${prompt}` : prompt,
    keyboard: addNavigation(buttons.length ? keyboard.row() : keyboard, values, flow),
  };
};

export const renderPollMenu = (values: string[], data: PollMenuData, flow: PollFlow): PollMenu => {
  const choices = parseChoices(values, flow);
  const summary = describeChoices(choices, data);
  const step = flow.steps[values.length];

  return step
    ? renderStep(step, values, choices, summary, data, flow)
    : renderConfirmation(values, choices, summary, data, flow);
};
