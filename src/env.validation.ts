const CHAT_ID_ENV = ['CTRL_CHAT_ID', 'MAIN_CHAT_ID'] as const;
const REQUIRED_ENV = ['TELEGRAM_BOT_TOKEN', ...CHAT_ID_ENV] as const;

export const validateEnv = (config: Record<string, unknown>): Record<string, unknown> => {
  const missing = REQUIRED_ENV.filter((key) => {
    const value = config[key];

    return typeof value !== 'string' || !value.trim();
  });

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const invalid = CHAT_ID_ENV.filter((key) => Number.isNaN(Number(config[key])));

  if (invalid.length) {
    throw new Error(`Environment variables must be numbers: ${invalid.join(', ')}`);
  }

  return config;
};
