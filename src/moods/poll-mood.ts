export const POLL_REPLY_CATEGORIES = ['YES', 'YES_WITH_FRIEND', 'MAYBE', 'NO', 'CHAOTIC'] as const;

export type PollReplyCategory = (typeof POLL_REPLY_CATEGORIES)[number];

export type PollQuestionTemplate = (date: string) => string;
export type PollMoodOptions = Record<PollReplyCategory, string[]>;

export interface PollMoodDefinition {
  readonly name: string;
  readonly questions: PollQuestionTemplate[];
  readonly options: PollMoodOptions;
}

export const generateQuestion = (mood: PollMoodDefinition, date: string): string => pickRandom(mood.questions)(date);

export const generateOptions = (mood: PollMoodDefinition): string[] =>
  POLL_REPLY_CATEGORIES.map((category) => pickRandom(mood.options[category]));

export const pickRandom = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
