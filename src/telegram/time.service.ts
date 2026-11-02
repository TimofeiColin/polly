import { Injectable } from '@nestjs/common';
import { EditableListService, ListItem } from './editable-list.service';

const TIME_FORMAT = /^(\d{1,2})(?::(\d{2}))?$/;

const parseTime = (input: string): string | undefined => {
  const match = TIME_FORMAT.exec(input.trim());

  if (!match) {
    return undefined;
  }

  const [hours, minutes] = [Number(match[1]), Number(match[2] ?? 0)];

  return hours < 24 && minutes < 60
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    : undefined;
};

@Injectable()
export class TimeService extends EditableListService {
  constructor() {
    super({
      callbackPrefix: 'time',
      fileName: 'times.json',
      parse: parseTime,
      texts: {
        title: 'Во сколько можно играть:',
        icon: '🕐',
        hint: 'Нажми на время, чтобы удалить его. Добавить новое: /addtime 18:30',
        addUsage: 'Напиши время: /addtime 18:30',
        invalid: 'Не понимаю такое время 🤔 Пример: 18 или 18:30',
        gone: 'Этого времени уже нет в списке',
      },
    });
  }

  override getAll(): ListItem[] {
    return super.getAll().sort((first, second) => first.name.localeCompare(second.name));
  }
}
