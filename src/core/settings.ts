import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

/** Per-user preferences (not per project), e.g. the language chosen with `nsk language`. */
export interface UserSettings {
  language?: string;
}

/** %APPDATA%\nsk\settings.json on Windows; $XDG_CONFIG_HOME (or ~/.config)/nsk/settings.json elsewhere. */
export function settingsPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  home: string = homedir(),
): string {
  const p = platform === 'win32' ? path.win32 : path.posix;
  const base = platform === 'win32' ? (env.APPDATA ?? p.join(home, 'AppData', 'Roaming')) : (env.XDG_CONFIG_HOME ?? p.join(home, '.config'));
  return p.join(base, 'nsk', 'settings.json');
}

/** Missing or unreadable settings are treated as empty: they must never stop a command. */
export function readSettings(file: string = settingsPath()): UserSettings {
  try {
    const json: unknown = JSON.parse(readFileSync(file, 'utf8'));
    return typeof json === 'object' && json !== null ? (json as UserSettings) : {};
  } catch {
    return {};
  }
}

/** Saves the settings; keys set to undefined are removed, and an empty file is deleted. */
export function writeSettings(settings: UserSettings, file: string = settingsPath()): void {
  const merged = Object.fromEntries(
    Object.entries({ ...readSettings(file), ...settings }).filter(([, value]) => value !== undefined),
  );
  if (Object.keys(merged).length === 0) {
    if (existsSync(file)) rmSync(file);
    return;
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(merged, null, 2) + '\n');
}
