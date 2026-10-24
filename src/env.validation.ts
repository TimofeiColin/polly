const REQUIRED_ENV = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_OWNER_ID'] as const;

export const validateEnv = (config: Record<string, unknown>): Record<string, unknown> => {
  const missing = REQUIRED_ENV.filter((key) => {
    const value = config[key];

    return typeof value !== 'string' || !value.trim();
  });

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (Number.isNaN(Number(config.TELEGRAM_OWNER_ID))) {
    throw new Error('TELEGRAM_OWNER_ID must be a number');
  }

  return config;
};
