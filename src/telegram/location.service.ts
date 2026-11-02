import { Injectable } from '@nestjs/common';
import { EditableListService } from './editable-list.service';

const MAX_NAME_LENGTH = 100;

const parseName = (input: string): string | undefined => {
  const name = input.replace(/\s+/g, ' ').trim();

  return name.length <= MAX_NAME_LENGTH ? name : undefined;
};

@Injectable()
export class LocationService extends EditableListService {
  constructor() {
    super({
      callbackPrefix: 'location',
      fileName: 'locations.json',
      parse: parseName,
      texts: {
        title: 'Где можно играть:',
        icon: '📍',
        hint: 'Нажми на место, чтобы удалить его. Добавить новое: /addlocation название',
        addUsage: 'Напиши название: /addlocation Антикафе',
        invalid: `Слишком длинно! Максимум ${MAX_NAME_LENGTH} символов`,
        gone: 'Этого места уже нет в списке',
      },
    });
  }
}
