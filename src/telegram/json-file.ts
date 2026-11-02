import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const dataFilePath = (name: string): string => join(process.cwd(), 'data', name);

export const readJsonArray = <T>(path: string): T[] =>
  existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T[]) : [];

export const writeJsonArray = <T>(path: string, items: readonly T[]): void => {
  const tempFile = `${path}.tmp`;

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(tempFile, JSON.stringify(items, null, 2));
  renameSync(tempFile, path);
};
