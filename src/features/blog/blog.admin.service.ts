import { syncBlogs } from './blog.service.js';
import { getWorkspaceOrThrow } from '../workspace/workspace.service.js';

export async function syncWorkspaceBlogs() {
  const workspace = await getWorkspaceOrThrow();
  return syncBlogs(workspace.id);
}
