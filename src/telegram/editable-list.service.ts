import { CallbackQueryContext, CommandContext, Context, InlineKeyboard } from 'grammy';
import { dataFilePath, readJsonArray, writeJsonArray } from './json-file';

export interface ListItem {
  readonly id: number;
  readonly name: string;
}

export interface EditableListTexts {
  readonly title: string;
  readonly icon: string;
  readonly hint: string;
  readonly addUsage: string;
  readonly invalid: string;
  readonly gone: string;
}

export interface EditableListOptions {
  readonly callbackPrefix: string;
  readonly fileName: string;
  readonly parse: (input: string) => string | undefined;
  readonly texts: EditableListTexts;
}

const CLOSE_STEP = 'close';
const REMOVE_STEP = 'remove';

const isSameName = (first: string, second: string): boolean => first.toLowerCase() === second.toLowerCase();

export abstract class EditableListService {
  readonly callbackPattern: RegExp;

  private readonly filePath: string;
  private items: ListItem[];

  protected constructor(private readonly options: EditableListOptions) {
    this.callbackPattern = new RegExp(`^${options.callbackPrefix}(?::.+)?$`);
    this.filePath = dataFilePath(options.fileName);
    this.items = readJsonArray<ListItem>(this.filePath);
  }

  getAll(): ListItem[] {
    return [...this.items];
  }

  async openMenu(ctx: Context): Promise<void> {
    await ctx.reply(this.listText(), { reply_markup: this.listKeyboard() });
  }

  async handleMenuStep(ctx: CallbackQueryContext<Context>): Promise<void> {
    const { texts } = this.options;
    const [step, action] = ctx.callbackQuery.data.split(':').slice(1);

    if (step === CLOSE_STEP) {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(this.listText());
      return;
    }

    const item = this.items.find(({ id }) => String(id) === step);

    if (step && !item) {
      await ctx.answerCallbackQuery({ text: texts.gone });
    } else {
      await ctx.answerCallbackQuery();
    }

    if (item && !action) {
      await ctx.editMessageText(`Удалить ${texts.icon} ${item.name}?`, {
        reply_markup: new InlineKeyboard()
          .text('🗑 Удалить', this.callbackData(item.id, REMOVE_STEP))
          .text('⬅️ Назад', this.callbackData()),
      });
      return;
    }

    if (item) {
      this.deleteItem(item);
    }

    await ctx.editMessageText(this.listText(), { reply_markup: this.listKeyboard() });
  }

  async addItem(ctx: CommandContext<Context>): Promise<void> {
    const { texts, parse } = this.options;

    if (!ctx.match.trim()) {
      await ctx.reply(texts.addUsage);
      return;
    }

    const name = parse(ctx.match);

    if (!name) {
      await ctx.reply(texts.invalid);
      return;
    }

    if (this.getAll().some((item) => isSameName(item.name, name))) {
      await ctx.reply(`«${name}» уже есть в списке`);
      return;
    }

    const id = Math.max(0, ...this.items.map((item) => item.id)) + 1;

    this.items = [...this.items, { id, name }];
    writeJsonArray(this.filePath, this.items);

    await ctx.reply(`Добавила: ${texts.icon} ${name}`);
  }

  private deleteItem({ id }: ListItem): void {
    this.items = this.items.filter((item) => item.id !== id);
    writeJsonArray(this.filePath, this.items);
  }

  private callbackData(...steps: (string | number)[]): string {
    return [this.options.callbackPrefix, ...steps].join(':');
  }

  private listText(): string {
    const { title, icon, hint } = this.options.texts;
    const list = this.getAll()
      .map(({ name }) => `${icon} ${name}`)
      .join('\n');

    return `${title}\n\n${list || 'Пока пусто'}\n\n${hint}`;
  }

  private listKeyboard(): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    this.getAll().forEach(({ id, name }) => {
      keyboard.text(name, this.callbackData(id)).row();
    });

    return keyboard.text('✖️ Закрыть', this.callbackData(CLOSE_STEP));
  }
}
