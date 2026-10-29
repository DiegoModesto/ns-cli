import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isIgnored, UploadQueue, type UploadQueueOptions } from '../../src/core/watch.js';

/** Fake file system: content per file; a missing entry means the file was deleted. */
let files: Map<string, string>;

function createQueue(overrides: Partial<UploadQueueOptions> = {}) {
  const upload = vi.fn<UploadQueueOptions['upload']>(async () => {});
  const log = vi.fn<UploadQueueOptions['log']>();
  const queue = new UploadQueue({
    upload,
    log,
    toFileCabinetPath: (file) => (file.startsWith('/fc/') ? file.slice('/fc'.length) : null),
    fingerprint: (file) => files.get(file) ?? null,
    waitForFirstBuild: false,
    debounceMs: 100,
    ...overrides,
  });
  return { queue, upload, log };
}

function change(queue: UploadQueue, file: string, content: string) {
  files.set(file, content);
  queue.fileChanged(file);
}

beforeEach(() => {
  vi.useFakeTimers();
  files = new Map();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('UploadQueue', () => {
  it('batches changes within the debounce window into one upload', async () => {
    const { queue, upload } = createQueue();
    change(queue, '/fc/SuiteScripts/a.js', 'a');
    await vi.advanceTimersByTimeAsync(50);
    change(queue, '/fc/SuiteScripts/b.js', 'b');
    change(queue, '/fc/SuiteScripts/a.js', 'a2');
    await vi.advanceTimersByTimeAsync(100);

    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith(['/SuiteScripts/a.js', '/SuiteScripts/b.js']);
  });

  it('skips files whose content did not change since the last upload', async () => {
    const { queue, upload } = createQueue();
    change(queue, '/fc/SuiteScripts/a.js', 'a');
    await vi.advanceTimersByTimeAsync(100);
    change(queue, '/fc/SuiteScripts/a.js', 'a');
    await vi.advanceTimersByTimeAsync(100);

    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('ignores deleted files and files without a File Cabinet path', async () => {
    const { queue, upload } = createQueue();
    queue.fileChanged('/fc/SuiteScripts/deleted.js');
    change(queue, '/elsewhere/a.js', 'a');
    await vi.advanceTimersByTimeAsync(100);

    expect(upload).not.toHaveBeenCalled();
  });

  it('never runs two uploads in parallel', async () => {
    let finish: () => void = () => {};
    const upload = vi.fn<UploadQueueOptions['upload']>(() => new Promise<void>((resolve) => (finish = resolve)));
    const { queue } = createQueue({ upload });

    change(queue, '/fc/SuiteScripts/a.js', 'a');
    await vi.advanceTimersByTimeAsync(100);
    change(queue, '/fc/SuiteScripts/b.js', 'b');
    await vi.advanceTimersByTimeAsync(500);
    expect(upload).toHaveBeenCalledTimes(1);

    finish();
    await vi.advanceTimersByTimeAsync(100);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenLastCalledWith(['/SuiteScripts/b.js']);
  });

  it('keeps watching after a failed upload and retries the same content on the next save', async () => {
    const upload = vi.fn<UploadQueueOptions['upload']>().mockRejectedValueOnce(new Error('Invalid auth ID'));
    const { queue, log } = createQueue({ upload });

    change(queue, '/fc/SuiteScripts/a.js', 'a');
    await vi.advanceTimersByTimeAsync(100);
    expect(log).toHaveBeenCalledWith('✖ Upload failed: Invalid auth ID');

    change(queue, '/fc/SuiteScripts/a.js', 'a');
    await vi.advanceTimersByTimeAsync(100);
    expect(upload).toHaveBeenCalledTimes(2);
  });

  describe('with tsc', () => {
    it('does not upload the output of the first build', async () => {
      const { queue, upload } = createQueue({ waitForFirstBuild: true });
      queue.buildStarted();
      change(queue, '/fc/SuiteScripts/a.js', 'a');
      queue.buildFinished(0);
      change(queue, '/fc/SuiteScripts/b.js', 'b'); // written right after tsc reported
      await vi.advanceTimersByTimeAsync(1000);
      expect(upload).not.toHaveBeenCalled();

      change(queue, '/fc/SuiteScripts/b.js', 'b'); // rewritten with the same content
      change(queue, '/fc/SuiteScripts/a.js', 'a2');
      await vi.advanceTimersByTimeAsync(100);
      expect(upload).toHaveBeenCalledExactlyOnceWith(['/SuiteScripts/a.js']);
    });

    it('waits for the build to finish', async () => {
      const { queue, upload } = createQueue();
      queue.buildStarted();
      change(queue, '/fc/SuiteScripts/a.js', 'a');
      await vi.advanceTimersByTimeAsync(1000);
      expect(upload).not.toHaveBeenCalled();

      queue.buildFinished(0);
      await vi.advanceTimersByTimeAsync(100);
      expect(upload).toHaveBeenCalledOnce();
    });

    it('uploads nothing while the last build had errors, then everything once it is clean', async () => {
      const { queue, upload, log } = createQueue();
      queue.buildStarted();
      change(queue, '/fc/SuiteScripts/a.js', 'broken');
      queue.buildFinished(2);
      await vi.advanceTimersByTimeAsync(100);
      change(queue, '/fc/SuiteScripts/b.js', 'b');
      await vi.advanceTimersByTimeAsync(100);

      expect(upload).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledExactlyOnceWith('TypeScript reported 2 errors; nothing is uploaded until they are fixed.');

      queue.buildStarted();
      change(queue, '/fc/SuiteScripts/a.js', 'fixed');
      queue.buildFinished(0);
      await vi.advanceTimersByTimeAsync(100);
      expect(upload).toHaveBeenCalledExactlyOnceWith(['/SuiteScripts/a.js', '/SuiteScripts/b.js']);
    });
  });
});

describe('isIgnored', () => {
  it('ignores source maps, tsc artifacts and dotfiles', () => {
    expect(isIgnored('/SuiteScripts/a.js.map')).toBe(true);
    expect(isIgnored('/SuiteScripts/tsconfig.tsbuildinfo')).toBe(true);
    expect(isIgnored('/SuiteScripts/types.d.ts')).toBe(true);
    expect(isIgnored('/SuiteScripts/.DS_Store')).toBe(true);
    expect(isIgnored('/SuiteScripts/.cache/a.js')).toBe(true);
    expect(isIgnored('/SuiteScripts/App/ue_sales_order.js')).toBe(false);
  });
});
