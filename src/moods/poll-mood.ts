import { PollWhen } from './poll-when';

export const POLL_REPLY_CATEGORIES = ['YES', 'YES_WITH_FRIEND', 'MAYBE', 'NO', 'CHAOTIC'] as const;

export type PollReplyCategory = (typeof POLL_REPLY_CATEGORIES)[number];

export type PollSize = 'full' | 'short' | 'minimal';

export const POLL_SIZES: Record<PollSize, readonly PollReplyCategory[]> = {
  full: POLL_REPLY_CATEGORIES,
  short: ['YES', 'MAYBE', 'NO'],
  minimal: ['YES', 'NO'],
};

export type PollQuestionTemplate = (when: PollWhen) => string;
export type PollMoodOptions = Record<PollReplyCategory, string[]>;

export interface PollMoodDefinition {
  readonly name: string;
  readonly questions: PollQuestionTemplate[];
  readonly options: PollMoodOptions;
}

export interface PollVariant {
  readonly moodIndex: number;
  readonly questionIndex: number;
  readonly optionIndexes: readonly number[];
}

export interface PollText {
  readonly question: string;
  readonly options: string[];
}

const VARIANT_SEPARATOR = '.';
const VARIANT_RADIX = 36;

const randomIndex = (items: readonly unknown[]): number => Math.floor(Math.random() * items.length);

export const createPollVariant = (
  moods: readonly PollMoodDefinition[],
  moodIndex: number | undefined,
  size: PollSize,
): PollVariant => {
  const resolvedIndex = moodIndex ?? randomIndex(moods);
  const mood = moods[resolvedIndex];

  return {
    moodIndex: resolvedIndex,
    questionIndex: randomIndex(mood.questions),
    optionIndexes: POLL_SIZES[size].map((category) => randomIndex(mood.options[category])),
  };
};

export const encodePollVariant = ({ moodIndex, questionIndex, optionIndexes }: PollVariant): string =>
  [moodIndex, questionIndex, optionIndexes.map((index) => index.toString(VARIANT_RADIX)).join('')].join(
    VARIANT_SEPARATOR,
  );

export const decodePollVariant = (encoded: string): PollVariant => {
  const [moodIndex, questionIndex, optionIndexes] = encoded.split(VARIANT_SEPARATOR);

  return {
    moodIndex: Number(moodIndex),
    questionIndex: Number(questionIndex),
    optionIndexes: [...optionIndexes].map((index) => parseInt(index, VARIANT_RADIX)),
  };
};

export const buildPollText = (
  moods: readonly PollMoodDefinition[],
  { moodIndex, questionIndex, optionIndexes }: PollVariant,
  size: PollSize,
  when: PollWhen,
): PollText => {
  const mood = moods[moodIndex];

  return {
    question: mood.questions[questionIndex](when),
    options: POLL_SIZES[size].map((category, index) => mood.options[category][optionIndexes[index]]),
  };
};
