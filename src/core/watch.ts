import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

export interface UploadQueueOptions {
  /** Uploads File Cabinet paths; a rejection is logged and the queue keeps going. */
  upload: (fileCabinetPaths: string[]) => Promise<void>;
  /** File Cabinet path of a changed file, or null when it must not be uploaded. */
  toFileCabinetPath: (file: string) => string | null;
  /** Content fingerprint, or null when the file no longer exists. */
  fingerprint?: (file: string) => string | null;
  log: (message: string) => void;
  /** Hold every change until tsc finishes its first build (its output must not be uploaded). */
  waitForFirstBuild: boolean;
  debounceMs?: number;
}

/**
 * Batches changed files into one upload at a time. Uploads never run in parallel, never while tsc is building and
 * never while the last build had errors; files whose content did not change since the last upload are skipped.
 */
export class UploadQueue {
  private readonly pending = new Set<string>();
  /** Files seen before the queue was ready; their content becomes the baseline. */
  private readonly baseline = new Set<string>();
  private readonly uploaded = new Map<string, string>();
  private readonly debounceMs: number;
  private readonly fingerprint: (file: string) => string | null;
  private ready: boolean;
  private settling = false;
  private building = false;
  private errors = 0;
  private uploading = false;
  private blockedReported = false;
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly options: UploadQueueOptions) {
    this.debounceMs = options.debounceMs ?? 300;
    this.fingerprint = options.fingerprint ?? fingerprintFile;
    this.ready = !options.waitForFirstBuild;
  }

  fileChanged(file: string): void {
    if (!this.ready) {
      this.baseline.add(file);
      if (this.settling) this.schedule(() => this.becomeReady());
      return;
    }
    this.pending.add(file);
    this.schedule(() => void this.flush());
  }

  buildStarted(): void {
    this.building = true;
  }

  buildFinished(errors: number): void {
    this.building = false;
    this.errors = errors;
    if (!this.ready) {
      // tsc writes files right before reporting; wait until they stop changing.
      this.settling = true;
      this.schedule(() => this.becomeReady());
    } else if (this.pending.size > 0) {
      this.schedule(() => void this.flush());
    }
  }

  stop(): void {
    clearTimeout(this.timer);
  }

  private becomeReady(): void {
    this.ready = true;
    this.settling = false;
    for (const file of this.baseline) {
      const fingerprint = this.fingerprint(file);
      if (fingerprint !== null) this.uploaded.set(file, fingerprint);
    }
    this.baseline.clear();
    this.options.log('Ready. Watching for changes...');
  }

  private schedule(callback: () => void): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(callback, this.debounceMs);
  }

  private async flush(): Promise<void> {
    if (this.uploading || this.building || this.pending.size === 0) return;
    if (this.errors > 0) {
      if (!this.blockedReported) {
        const errors = this.errors === 1 ? '1 error' : `${this.errors} errors`;
        this.options.log(`TypeScript reported ${errors}; nothing is uploaded until they are fixed.`);
        this.blockedReported = true;
      }
      return;
    }
    this.blockedReported = false;

    const batch = new Map<string, { path: string; fingerprint: string }>();
    for (const file of this.pending) {
      const fingerprint = this.fingerprint(file);
      if (fingerprint === null || this.uploaded.get(file) === fingerprint) continue;
      const path = this.options.toFileCabinetPath(file);
      if (path) batch.set(file, { path, fingerprint });
    }
    this.pending.clear();
    if (batch.size === 0) return;

    const paths = [...batch.values()].map((entry) => entry.path);
    this.uploading = true;
    try {
      await this.options.upload(paths);
      for (const [file, { fingerprint }] of batch) this.uploaded.set(file, fingerprint);
      this.options.log(`↑ ${paths.join(', ')}`);
    } catch (error) {
      this.options.log(`✖ Upload failed: ${(error as Error).message}`);
    } finally {
      this.uploading = false;
    }
    if (this.pending.size > 0) this.schedule(() => void this.flush());
  }
}

/** Files under the FileCabinet that `watch` never uploads: source maps, tsc artifacts and dotfiles. */
export function isIgnored(fileCabinetPath: string): boolean {
  return (
    /\.(map|tsbuildinfo)$/.test(fileCabinetPath) ||
    fileCabinetPath.endsWith('.d.ts') ||
    fileCabinetPath.split('/').some((segment) => segment.startsWith('.'))
  );
}

function fingerprintFile(file: string): string | null {
  if (!existsSync(file)) return null;
  try {
    return createHash('sha1').update(readFileSync(file)).digest('hex');
  } catch {
    return null; // a folder, or removed between the checks
  }
}
