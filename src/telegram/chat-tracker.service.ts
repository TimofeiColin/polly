import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Context, Filter } from 'grammy';
import { ChatStoreService } from './chat-store.service';

const ACTIVE_MEMBER_STATUSES = ['creator', 'administrator', 'member', 'restricted'];

@Injectable()
export class ChatTrackerService {
  private readonly logger = new Logger(ChatTrackerService.name);
  private readonly ctrlChatId: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly chatStore: ChatStoreService,
  ) {
    this.ctrlChatId = Number(this.configService.getOrThrow<string>('CTRL_CHAT_ID'));
  }

  async handleMembershipChange(ctx: Filter<Context, 'my_chat_member'>): Promise<void> {
    const { chat, from, new_chat_member: member } = ctx.myChatMember;

    if (chat.type !== 'group' && chat.type !== 'supergroup') {
      return;
    }

    if (!ACTIVE_MEMBER_STATUSES.includes(member.status)) {
      if (this.chatStore.remove(chat.id)) {
        await ctx.api.sendMessage(this.ctrlChatId, `Polly убрали из чата «${chat.title}»`);
      }

      return;
    }

    const { status } = await ctx.api.getChatMember(this.ctrlChatId, from.id);

    if (!ACTIVE_MEMBER_STATUSES.includes(status)) {
      this.logger.warn(`Ignoring chat ${chat.id}: added by a user outside the control chat`);
      return;
    }

    this.chatStore.save({ chatId: chat.id, title: chat.title });
    await ctx.api.sendMessage(this.ctrlChatId, `Polly добавили в чат «${chat.title}» 🎉`);
  }

  handleRename(ctx: Filter<Context, 'message:new_chat_title'>): void {
    this.chatStore.rename(ctx.chat.id, ctx.msg.new_chat_title);
  }

  handleMigration(ctx: Filter<Context, 'message:migrate_to_chat_id'>): void {
    this.chatStore.migrate(ctx.chat.id, ctx.msg.migrate_to_chat_id);
  }
}
