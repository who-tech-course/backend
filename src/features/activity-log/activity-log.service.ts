import type { ActivityLogRepository } from '../../db/repositories/activity-log.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';

export function createActivityLogService(deps: {
  activityLogRepo: ActivityLogRepository;
  workspaceService: WorkspaceService;
}) {
  const { activityLogRepo, workspaceService } = deps;

  return {
    getLogs: async (limit?: number) => {
      const workspace = await workspaceService.getOrThrow();
      return activityLogRepo.findMany(workspace.id, limit);
    },

    addLog: async (type: string, message: string) => {
      const workspace = await workspaceService.getOrThrow();
      return activityLogRepo.create({ type, message, workspaceId: workspace.id });
    },

    clearLogs: async () => {
      const workspace = await workspaceService.getOrThrow();
      return activityLogRepo.deleteAll(workspace.id);
    },
  };
}

export type ActivityLogService = ReturnType<typeof createActivityLogService>;
