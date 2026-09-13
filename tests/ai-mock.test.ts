import { describe, expect, it, vi } from 'vitest';
// Workers cannot read the repository's mocks directory at runtime.
vi.mock('node:fs/promises', () => ({ readFile: () => { throw new Error('ENOENT: mocks directory absent in Worker'); } }));
import { loadMock } from '../src/server/ai/mock';
import { AI_TASKS, taskSchemas } from '../src/server/ai/schemas';

describe('bundled AI mocks', () => {
  it.each(AI_TASKS)('%s loads and validates without a runtime filesystem', async task => {
    const data = await loadMock(task);
    expect(taskSchemas[task].safeParse(data).success).toBe(true);
  });
  it('returns isolated data so a caller cannot change subsequent responses', async () => {
    const first = await loadMock('tree') as { weekly: unknown[] };
    first.weekly.length = 0;
    const next = await loadMock('tree') as { weekly: unknown[] };
    expect(next.weekly.length).toBeGreaterThan(0);
  });
});
