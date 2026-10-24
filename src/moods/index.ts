import { BOSSY_MOOD } from './bossy.mood';
import { CARING_MOOD } from './caring.mood';
import { CHAOTIC_MOOD } from './chaotic.mood';
import { COOL_MOOD } from './cool.mood';
import { DRAMATIC_MOOD } from './dramatic.mood';
import { EXCITED_MOOD } from './excited.mood';
import { PollMoodDefinition } from './poll-mood';
import { SERIOUS_MOOD } from './serious.mood';
import { SHY_MOOD } from './shy.mood';

export * from './poll-mood';

export const MOODS: readonly PollMoodDefinition[] = [
  SHY_MOOD,
  EXCITED_MOOD,
  BOSSY_MOOD,
  DRAMATIC_MOOD,
  CHAOTIC_MOOD,
  COOL_MOOD,
  CARING_MOOD,
  SERIOUS_MOOD,
];
