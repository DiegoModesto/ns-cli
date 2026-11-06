import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readSettings, settingsPath, writeSettings } from '../../src/core/settings.js';

describe('settingsPath', () => {
  it('uses APPDATA on Windows and XDG_CONFIG_HOME or ~/.config elsewhere', () => {
    expect(settingsPath({ APPDATA: 'C:\\Users\\me\\AppData\\Roaming' }, 'win32', 'C:\\Users\\me')).toBe(
      'C:\\Users\\me\\AppData\\Roaming\\nsk\\settings.json',
    );
    expect(settingsPath({ XDG_CONFIG_HOME: '/xdg' }, 'linux', '/home/me')).toBe('/xdg/nsk/settings.json');
    expect(settingsPath({}, 'darwin', '/Users/me')).toBe('/Users/me/.config/nsk/settings.json');
  });
});

describe('readSettings / writeSettings', () => {
  let dir: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('saves, merges and removes keys, deleting the file when it becomes empty', () => {
    dir = mkdtempSync(join(tmpdir(), 'nsk-settings-'));
    const file = join(dir, 'nsk', 'settings.json');

    expect(readSettings(file)).toEqual({});
    writeSettings({ language: 'es' }, file);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ language: 'es' });

    writeSettings({ language: undefined }, file);
    expect(existsSync(file)).toBe(false);
  });

  it('treats a broken file as empty', () => {
    dir = mkdtempSync(join(tmpdir(), 'nsk-settings-'));
    const file = join(dir, 'settings.json');
    writeFileSync(file, '{broken');
    expect(readSettings(file)).toEqual({});
  });
});
