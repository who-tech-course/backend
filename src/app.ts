import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PrismaClient } from '@prisma/client';
import { adminAuth } from './shared/middleware/auth.js';
import { errorHandler } from './shared/middleware/error.js';

// Repositories
import { createWorkspaceRepository } from './db/repositories/workspace.repository.js';
import { createMemberRepository } from './db/repositories/member.repository.js';
import { createMissionRepoRepository } from './db/repositories/mission-repo.repository.js';
import { createSubmissionRepository } from './db/repositories/submission.repository.js';
import { createBlogPostRepository } from './db/repositories/blog-post.repository.js';

// Services
import { createWorkspaceService } from './features/workspace/workspace.service.js';
import { createMemberService } from './features/member/member.service.js';
import { createSyncService } from './features/sync/sync.service.js';
import { createSyncAdminService } from './features/sync/sync.admin.service.js';
import { createRepoService } from './features/repo/repo.service.js';
import { createBlogService } from './features/blog/blog.service.js';
import { createBlogAdminService } from './features/blog/blog.admin.service.js';
import { createOctokit } from './features/sync/github.service.js';

// Routers
import { createWorkspaceRouter } from './features/workspace/workspace.route.js';
import { createMemberRouter } from './features/member/member.route.js';
import { createRepoRouter } from './features/repo/repo.route.js';
import { createSyncRouter } from './features/sync/sync.route.js';
import { createBlogRouter } from './features/blog/blog.route.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Composition Root ---
const db = new PrismaClient();
const octokit = createOctokit(process.env['GITHUB_TOKEN']);

const workspaceRepo = createWorkspaceRepository(db);
const memberRepo = createMemberRepository(db);
const missionRepoRepo = createMissionRepoRepository(db);
const submissionRepo = createSubmissionRepository(db);
const blogPostRepo = createBlogPostRepository(db);

const workspaceService = createWorkspaceService({ workspaceRepo });
const syncService = createSyncService({ memberRepo, missionRepoRepo, submissionRepo, workspaceRepo });
const memberService = createMemberService({ memberRepo, workspaceService });
const repoService = createRepoService({ missionRepoRepo, workspaceService, syncService, octokit });
const blogService = createBlogService({ memberRepo, blogPostRepo });
const blogAdminService = createBlogAdminService({ memberRepo, workspaceService, blogService, octokit });
const syncAdminService = createSyncAdminService({
  memberRepo,
  missionRepoRepo,
  workspaceService,
  syncService,
  octokit,
});

// --- Express App ---
const app = express();
app.use(express.json());
app.use('/admin/ui', express.static(join(__dirname, 'public')));

app.get('/', (_req, res) => {
  res.json({ message: 'who-tech-course API' });
});

app.use('/admin', adminAuth);
app.use('/admin/workspace', createWorkspaceRouter(workspaceService));
app.use('/admin/repos', createRepoRouter(repoService));
app.use('/admin', createSyncRouter(syncAdminService));
app.use('/admin', createBlogRouter(blogAdminService));
app.use('/admin/members', createMemberRouter(memberService));
app.use(errorHandler);

export default app;
