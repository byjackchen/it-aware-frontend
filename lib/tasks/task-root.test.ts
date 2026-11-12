import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import middleware from '@/proxy';
import { TASKS } from './catalog';
import { taskRootRedirect, taskRootTarget } from './task-root';

const request = (path: string) => new NextRequest(`http://localhost${path}`);

afterEach(() => {
    vi.restoreAllMocks();
});

describe("a multi-view task's own address", () => {
    const multi = TASKS.filter(task => task.views.length > 1);

    it('goes to the first view of every multi-view task, and no other task', () => {
        expect(multi.length).toBeGreaterThan(5);
        for (const task of multi) {
            expect(taskRootTarget(`/tasks/${task.code}`)).toBe(task.views[0].address);
            expect(taskRootTarget(`/tasks/${task.code}/`)).toBe(task.views[0].address);
        }
        for (const task of TASKS.filter(candidate => candidate.views.length === 1)) {
            expect(taskRootTarget(`/tasks/${task.code}`)).toBeNull();
        }
        expect(taskRootTarget('/tasks/workers/workers')).toBeNull();
        expect(taskRootTarget('/tasks/workersx')).toBeNull();
        expect(taskRootTarget('/tasks')).toBeNull();
        expect(taskRootTarget('/')).toBeNull();
    });

    it('answers 307 with the query string kept, and lets anything else through', () => {
        const response = taskRootRedirect(request('/tasks/it-tickets?range=7d'));
        expect(response?.status).toBe(307);
        expect(response?.headers.get('location')).toBe('http://localhost/tasks/it-tickets/active?range=7d');
        expect(taskRootRedirect(request('/tasks/it-incidents'))).toBeNull();
    });

    it('is answered by the proxy before any auth work', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch');
        const response = await middleware(request('/tasks/workers'));
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe('http://localhost/tasks/workers/workers');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
