import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as campaigns from '@/app/actions/campaigns';
import * as objects from '@/app/actions/objects';
import * as security from '@/app/actions/security';

/**
 * The server actions of the data, campaign and access pages redraw those pages
 * at their task addresses (the pages moved under /tasks/..., lane F4). The API
 * clients are mocked and answer every call, so each action takes its success
 * path; what is checked is the addresses it revalidates.
 */

const revalidated: string[] = [];
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => revalidated.push(path) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [{ name: 'it_aware_access', value: 't' }] }) }));
vi.mock('@/lib/logger', () => ({
    logger: { generateRequestId: () => 'r', info: () => undefined, warn: () => undefined, error: () => undefined },
}));
vi.mock('@/lib/api/security');
vi.mock('@/lib/api/objects');
vi.mock('@/lib/api/campaigns');
vi.mock('@/lib/api/scenarios');

const form = (fields: Record<string, string> = {}) => {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) data.set(name, value);
    return data;
};

beforeEach(() => {
    revalidated.length = 0;
    // The campaign actions check write permission with the backend's /auth/me first.
    vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
            Response.json({ permissions: { unconstrained: ['*:*:*'] }, account: { username: 'gate.example' } }),
        ),
    );
});

/** What one call revalidates. */
async function redraws(call: () => Promise<unknown>): Promise<string[]> {
    revalidated.length = 0;
    await call();
    return [...revalidated];
}

describe('Maintain Access', () => {
    it('redraws the permissions, roles, groups and accounts views', async () => {
        expect(await redraws(() => security.createPermission(form()))).toEqual(['/tasks/access/permissions']);
        expect(await redraws(() => security.deletePermission('p'))).toEqual(['/tasks/access/permissions']);
        for (const call of [
            () => security.createRole(form()),
            () => security.updateRole('r', form()),
            () => security.deleteRole('r'),
        ]) {
            expect(await redraws(call)).toEqual(['/tasks/access/roles']);
        }
        for (const call of [
            () => security.createGroup(form()),
            () => security.updateGroup('g', form()),
            () => security.deleteGroup('g'),
            () => security.assignGroupPermission('g', 'p'),
            () => security.removeGroupPermission('g', 'p'),
            () => security.linkGroupRole('g', 'r'),
            () => security.unlinkGroupRole('g', 'r'),
        ]) {
            expect(await redraws(call)).toEqual(['/tasks/access/groups']);
        }
        for (const call of [
            () => security.createAccount(form()),
            () => security.updateAccount('a', form()),
            () => security.deleteAccount('a'),
            () => security.linkAccountWorker('a', 'w'),
            () => security.unlinkAccountWorker('a', 'w'),
            () => security.assignAccountGroup('a', 'g'),
            () => security.removeAccountGroup('a', 'g'),
        ]) {
            expect(await redraws(call)).toEqual(['/tasks/access/accounts']);
        }
        expect(await redraws(() => security.linkAccountSystem('a', 's'))).toEqual([
            '/tasks/access/accounts',
            '/tasks/access/accounts/a',
        ]);
        expect(await redraws(() => security.unlinkAccountSystem('a', 's'))).toEqual([
            '/tasks/access/accounts',
            '/tasks/access/accounts/a',
        ]);
    });
});

describe('the data views', () => {
    const cases: [string, () => Promise<unknown>, string[]][] = [
        ['createArticle', () => objects.createArticleAction(form()), ['/tasks/it-knowledge/articles']],
        ['updateArticle', () => objects.updateArticleAction('x', form()), ['/tasks/it-knowledge/articles', '/tasks/it-knowledge/articles/x']],
        ['deleteArticle', () => objects.deleteArticleAction('x'), ['/tasks/it-knowledge/articles']],
        ['createIncident', () => objects.createIncidentAction(form()), ['/tasks/it-incidents']],
        ['updateIncident', () => objects.updateIncidentAction('x', form()), ['/tasks/it-incidents', '/tasks/it-incidents/x']],
        ['deleteIncident', () => objects.deleteIncidentAction('x'), ['/tasks/it-incidents']],
        ['createRequest', () => objects.createRequestAction(form({ state: 'open' })), ['/tasks/it-requests']],
        ['updateRequest', () => objects.updateRequestAction('x', form()), ['/tasks/it-requests', '/tasks/it-requests/x']],
        ['deleteRequest', () => objects.deleteRequestAction('x'), ['/tasks/it-requests']],
        ['deleteInteraction', () => objects.deleteInteractionAction('x'), ['/tasks/it-interactions', '/tasks/it-interactions/x']],
        ['createScenario', () => objects.createScenarioAction(form()), ['/tasks/it-service-catalog/scenarios']],
        ['updateScenario', () => objects.updateScenarioAction('x', form()), ['/tasks/it-service-catalog/scenarios', '/tasks/it-service-catalog/scenarios/x']],
        ['deleteScenario', () => objects.deleteScenarioAction('x'), ['/tasks/it-service-catalog/scenarios']],
        ['createSystem', () => objects.createSystemAction(form()), ['/tasks/it-hardware/systems']],
        ['updateSystem', () => objects.updateSystemAction('x', form()), ['/tasks/it-hardware/systems', '/tasks/it-hardware/systems/x']],
        ['deleteSystem', () => objects.deleteSystemAction('x'), ['/tasks/it-hardware/systems']],
    ];
    it.each(cases)('%s redraws its view at its task address', async (_name, call, addresses) => {
        expect(await redraws(call)).toEqual(addresses);
    });
});

describe('Send Notifications and Run Surveys', () => {
    const batches = '/tasks/notifications/batches';
    const surveys = '/tasks/surveys/batches';
    const cases: [string, () => Promise<unknown>, string[]][] = [
        ['createNotificationBatch', () => campaigns.createCampaignNotificationBatchAction({} as never), [batches]],
        ['updateNotificationBatch', () => campaigns.updateCampaignNotificationBatchAction('b', {} as never), [batches]],
        ['deleteNotificationBatch', () => campaigns.deleteCampaignNotificationBatchAction('b'), [batches]],
        ['batchUpsertNotifications', () => campaigns.batchUpsertCampaignNotificationsAction('b', {} as never), [batches]],
        ['createNotification', () => campaigns.createCampaignNotificationAction('b', {} as never), [batches]],
        ['updateNotification', () => campaigns.updateCampaignNotificationAction('b', 'n', {} as never), [batches]],
        ['deleteNotification', () => campaigns.deleteCampaignNotificationAction('b', 'n'), [batches]],
        ['triggerNotificationBatch', () => campaigns.triggerCampaignNotificationBatchAction('b'), [batches]],
        ['cancelNotificationBatch', () => campaigns.cancelCampaignNotificationBatchAction('b'), [batches]],
        ['createSurveyBatch', () => campaigns.createCampaignSurveyBatchAction({} as never), [surveys]],
        ['updateSurveyBatch', () => campaigns.updateCampaignSurveyBatchAction('b', {} as never), [surveys]],
        ['deleteSurveyBatch', () => campaigns.deleteCampaignSurveyBatchAction('b'), [surveys]],
        ['publishSurveyBatch', () => campaigns.publishCampaignSurveyBatchAction('b'), [surveys]],
        ['closeSurveyBatch', () => campaigns.closeCampaignSurveyBatchAction('b'), [surveys]],
        ['reopenSurveyBatch', () => campaigns.reopenCampaignSurveyBatchAction('b'), [surveys]],
        ['cancelSurveyBatch', () => campaigns.cancelCampaignSurveyBatchAction('b'), [surveys]],
        ['createSurvey', () => campaigns.createCampaignSurveyAction('b', {} as never), [surveys]],
        ['updateSurvey', () => campaigns.updateCampaignSurveyAction('s', {} as never), [surveys]],
        ['submitSurvey', () => campaigns.submitCampaignSurveyAction('s', {} as never), [surveys]],
        ['revokeSurvey', () => campaigns.revokeCampaignSurveyAction('s'), [surveys]],
        ['batchUpsertSurveys', () => campaigns.batchUpsertCampaignSurveysAction('b', {} as never), [surveys]],
        ['deleteSurvey', () => campaigns.deleteCampaignSurveyAction('s'), [surveys]],
    ];
    it.each(cases)('%s redraws its view at its task address', async (_name, call, addresses) => {
        expect(await redraws(call)).toEqual(addresses);
    });
});
