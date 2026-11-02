# Polly

A Telegram bot that creates game night polls. Instead of typing a long command, you tap through a button menu in a private control chat, preview the poll, and Polly posts it to the chat you picked.

Polly has a personality, too. Each of the eight moods has its own question texts and answer options, from shy to bossy to chaotic. The bot's texts are in Russian.

## Features

- **Step-by-step menu:** choose the chat, poll size, mood, day, time and place, using only buttons.
- **Live preview:** see the exact poll before sending, and reroll the text with one tap.
- **Three poll sizes:** full (5 answers), short (3) or minimal (2).
- **Automatic chat tracking:** when someone from the control chat adds Polly to a group, the group appears in the menu. Renames and supergroup upgrades are handled too.
- **Editable lists:** manage locations and times from Telegram.
- **Restricted control:** commands work only in the control chat.

## Commands

All commands work in the control chat only.

| Command | Description |
| --- | --- |
| `/настолки`, `/nastolki` | Open the poll menu |
| `/locations` | Show locations and delete them with buttons |
| `/addlocation <name>` | Add a location |
| `/times` | Show times and delete them with buttons |
| `/addtime <time>` | Add a time, such as `18` or `18:30` |
| `/chats` | Show the chats Polly can post to |
| `/help` | Show the command list |

## Tech stack

TypeScript, Node.js 24, [NestJS](https://nestjs.com), [grammY](https://grammy.dev), Docker and pm2.

## Getting started

You need Node.js 24 and a bot token from [@BotFather](https://t.me/BotFather).

```bash
git clone https://github.com/TimofeiColin/polly.git
cd polly
npm ci
cp .env.example .env
```

Fill in `.env`:

| Variable | Description |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather |
| `CTRL_CHAT_ID` | Chat where commands are accepted |
| `MAIN_CHAT_ID` | Main chat for polls, always shown in the menu |

Add the bot to both chats, then start it in development mode:

```bash
npm run start:dev
```

The location and time lists start empty, so add at least one of each with `/addlocation` and `/addtime` before creating a poll.

Only one copy of the bot can run per token, because Telegram rejects a second polling connection.

## Running in production

**With Docker:**

```bash
docker build -t polly .
docker run -d --name polly --restart unless-stopped --env-file .env -v polly-data:/app/data polly
```

**With pm2** (install it first with `npm install -g pm2`):

| Command | Description |
| --- | --- |
| `npm run pm2:deploy` | Build, then start or restart the bot |
| `npm run pm2:start` | Start or restart the bot without building |
| `npm run pm2:list` | Show pm2 processes |
| `npm run pm2:stop` | Stop the bot |

## Data storage

Saved chats, locations and times are JSON files in `data/`: `chats.json`, `locations.json` and `times.json`. The folder is gitignored, and in Docker it needs the volume shown above so the data survives a rebuild.

## Project structure

```text
src/
├── moods/                         Mood texts and poll text generation
└── telegram/
    ├── telegram.service.ts        Bot startup and command routing
    ├── poll-command.service.ts    Poll menu flow and sending
    ├── poll-menu.ts               Menu steps, text and buttons
    ├── chat-tracker.service.ts    Membership, rename and upgrade events
    ├── chat-store.service.ts      Saved chats
    ├── editable-list.service.ts   Shared list, menu and add logic
    ├── location.service.ts        Locations
    └── time.service.ts            Times
```

The menu keeps no session state. Each button carries the choices made so far, so an open menu keeps working after a restart.

## License

[MIT](LICENSE)
