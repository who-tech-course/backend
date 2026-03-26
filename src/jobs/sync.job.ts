import cron from 'node-cron';
import { Octokit } from '@octokit/rest';
import prisma from '../db/prisma.js';
import { syncWorkspace } from '../services/sync.service.js';

export const SYNC_CRON_EXPRESSION = '0 3 * * *';

export function startSyncJob() {
  cron.schedule(SYNC_CRON_EXPRESSION, async () => {
    console.log('[sync-job] start');

    const token = process.env['GITHUB_TOKEN'];
    if (!token) {
      console.error('[sync-job] GITHUB_TOKEN not set');
      return;
    }

    const octokit = new Octokit({ auth: token });
    const workspaces = await prisma.workspace.findMany();

    for (const workspace of workspaces) {
      try {
        const { totalSynced, reposSynced } = await syncWorkspace(octokit, workspace.id);
        console.log(`[sync-job] ${workspace.name}: repos=${reposSynced}, submissions=${totalSynced}`);
      } catch (err) {
        console.error(`[sync-job] ${workspace.name} failed:`, err);
      }
    }

    console.log('[sync-job] done');
  });
}
