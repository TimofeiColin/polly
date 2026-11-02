export interface PollWhen {
  readonly date: string;
  readonly time: string;
  readonly day: string;
  readonly Day: string;
  readonly dayAcc: string;
  readonly onDay: string;
  readonly OnDay: string;
}

const WEEKDAYS = [
  { short: 'вс', day: 'воскресенье', dayAcc: 'воскресенье', onDay: 'в воскресенье' },
  { short: 'пн', day: 'понедельник', dayAcc: 'понедельник', onDay: 'в понедельник' },
  { short: 'вт', day: 'вторник', dayAcc: 'вторник', onDay: 'во вторник' },
  { short: 'ср', day: 'среда', dayAcc: 'среду', onDay: 'в среду' },
  { short: 'чт', day: 'четверг', dayAcc: 'четверг', onDay: 'в четверг' },
  { short: 'пт', day: 'пятница', dayAcc: 'пятницу', onDay: 'в пятницу' },
  { short: 'сб', day: 'суббота', dayAcc: 'субботу', onDay: 'в субботу' },
] as const;

const MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

const capitalize = (text: string): string => text[0].toUpperCase() + text.slice(1);

const formatDate = (date: Date): string => `${date.getDate()} ${MONTHS[date.getMonth()]}`;

export const formatShortDate = (date: Date): string => `${WEEKDAYS[date.getDay()].short}, ${formatDate(date)}`;

export const createPollWhen = (date: Date, time: string): PollWhen => {
  const { day, dayAcc, onDay } = WEEKDAYS[date.getDay()];

  return {
    date: formatDate(date),
    time,
    day,
    Day: capitalize(day),
    dayAcc,
    onDay,
    OnDay: capitalize(onDay),
  };
};
