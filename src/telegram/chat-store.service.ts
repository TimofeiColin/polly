import { Injectable } from '@nestjs/common';
import { dataFilePath, readJsonArray, writeJsonArray } from './json-file';

export interface SavedChat {
  readonly chatId: number;
  readonly title: string;
}

const CHATS_FILE = dataFilePath('chats.json');

@Injectable()
export class ChatStoreService {
  private chats = readJsonArray<SavedChat>(CHATS_FILE);

  getAll(): readonly SavedChat[] {
    return this.chats;
  }

  save(chat: SavedChat): void {
    this.chats = [...this.chats.filter(({ chatId }) => chatId !== chat.chatId), chat];
    this.persist();
  }

  remove(chatId: number): boolean {
    const remaining = this.chats.filter((chat) => chat.chatId !== chatId);
    const removed = remaining.length !== this.chats.length;

    this.chats = remaining;

    if (removed) {
      this.persist();
    }

    return removed;
  }

  rename(chatId: number, title: string): void {
    if (this.chats.some((chat) => chat.chatId === chatId)) {
      this.save({ chatId, title });
    }
  }

  migrate(oldChatId: number, newChatId: number): void {
    const chat = this.chats.find(({ chatId }) => chatId === oldChatId);

    if (chat) {
      this.chats = this.chats.filter(({ chatId }) => chatId !== oldChatId && chatId !== newChatId);
      this.save({ chatId: newChatId, title: chat.title });
    }
  }

  private persist(): void {
    writeJsonArray(CHATS_FILE, this.chats);
  }
}
