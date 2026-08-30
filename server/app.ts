import express from 'express';
import cookieParser from 'cookie-parser';
import {
  addSubmission,
  getAllSubmissionsAdmin,
  getSubmissionByIdSecure,
  getStats,
  updateSubmissionStatus,
  deleteSubmission,
  checkSupabaseHealth,
} from './db.js';
import {
  authenticateAdmin,
  requireAdminAuth,
  verifyAdminToken,
  AuthenticatedRequest,
} from './auth.js';

export function createExpressApp() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  // Enable CORS & strict no-cache headers for all API requests
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, X-Submission-Token, Cache-Control, Pragma'
    );

    // Prevent caching on API endpoints so client always gets persistent state
    if (req.path.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  // --- PUBLIC API ROUTES ---

  // Health check
  app.get('/api/health', (_req, res) => {
    const dbHealth = checkSupabaseHealth();
    res.json({
      status: dbHealth.connected ? 'ok' : 'error',
      database: dbHealth,
      serverTime: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
      platform: process.env.VERCEL ? 'vercel-serverless' : 'node-server',
    });
  });

  // Public summary statistics for UI overview
  app.get('/api/stats/summary', async (_req, res) => {
    try {
      const stats = await getStats();
      res.json({
        success: true,
        data: {
          totalUsers: stats.totalUsers,
          pendingRequests: stats.pendingRequests,
          todaySubmissions: stats.todaySubmissions,
          status: 'System Online',
        },
      });
    } catch (err) {
      console.error('Stats summary error:', err);
      res.status(500).json({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to fetch summary stats from database',
      });
    }
  });

  // User submits Join Request
  app.post('/api/submissions', async (req, res) => {
    try {
      const { gameName, gameUid } = req.body;

      if (!gameName || typeof gameName !== 'string' || !gameName.trim()) {
        return res.status(400).json({
          success: false,
          message: 'গেম আইডির নাম প্রদান করা আবশ্যক (Game ID Name is required)',
        });
      }

      if (!gameUid || typeof gameUid !== 'string' || !gameUid.trim() || !/^\d+$/.test(gameUid.trim())) {
        return res.status(400).json({
          success: false,
          message: 'গেম UID শুধুমাত্র সংখ্যা (0-9) হতে হবে (Game UID must be numeric)',
        });
      }

      // Sanitize inputs
      const cleanName = gameName.trim().slice(0, 100);
      const cleanUid = gameUid.trim().slice(0, 50);

      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || '';
      const result = await addSubmission(cleanName, cleanUid, clientIp);

      if (result.success === false) {
        return res.status(409).json({
          success: false,
          duplicateUid: result.duplicateUid,
          message: result.message,
        });
      }

      res.status(201).json({
        success: true,
        message: 'Your join request has been submitted successfully.',
        data: result.record,
        submission: result.record,
      });
    } catch (err) {
      console.error('Error adding submission:', err);
      res.status(500).json({
        success: false,
        message: err instanceof Error ? err.message : 'Database error while saving submission',
      });
    }
  });

  // User status lookup (SECURED with per-session token ownership or Admin JWT)
  app.get('/api/submissions/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Invalid submission ID',
        });
      }

      // 1. Check if caller has admin authentication token
      let isAdmin = false;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const adminToken = authHeader.substring(7);
        const adminUser = verifyAdminToken(adminToken);
        if (adminUser) {
          isAdmin = true;
        }
      }

      // 2. Check user session token header or query param
      const sessionToken = (req.headers['x-submission-token'] as string) || (req.query.token as string) || '';

      const lookup = await getSubmissionByIdSecure(id.trim(), sessionToken, isAdmin);

      if (!lookup.success) {
        if (lookup.forbidden) {
          return res.status(403).json({
            success: false,
            message: lookup.message || 'Access denied: Valid submission session token is required',
          });
        }
        if (lookup.notFound) {
          return res.status(404).json({
            success: false,
            message: lookup.message || 'Submission record not found',
          });
        }
        return res.status(400).json({
          success: false,
          message: lookup.message || 'Unable to retrieve submission',
        });
      }

      res.json({
        success: true,
        data: lookup.record,
      });
    } catch (err) {
      console.error('Error fetching submission status:', err);
      res.status(500).json({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to retrieve submission record from database',
      });
    }
  });

  // Admin Login
  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required',
        });
      }

      const authResult = authenticateAdmin(email, password);
      if (!authResult.success) {
        return res.status(401).json(authResult);
      }

      res.json(authResult);
    } catch (err) {
      console.error('Admin login error:', err);
      res.status(500).json({ success: false, message: 'Authentication service error' });
    }
  });

  // Verify Admin Session
  app.get('/api/auth/me', requireAdminAuth, (req: AuthenticatedRequest, res) => {
    res.json({
      success: true,
      user: req.user,
    });
  });

  // --- PROTECTED ADMIN ROUTES ---

  // Get Submissions with dynamic search and status filtering
  app.get('/api/admin/submissions', requireAdminAuth, async (req, res) => {
    try {
      const search = ((req.query.search as string) || '').toLowerCase().trim();
      const status = (req.query.status as string) || 'All';

      let list = await getAllSubmissionsAdmin();

      if (status && status !== 'All') {
        list = list.filter((item) => item.status.toLowerCase() === status.toLowerCase());
      }

      if (search) {
        list = list.filter(
          (item) =>
            item.gameName.toLowerCase().includes(search) ||
            item.gameUid.toLowerCase().includes(search) ||
            item.id.toLowerCase().includes(search)
        );
      }

      res.json({
        success: true,
        data: list,
        submissions: list,
        total: list.length,
      });
    } catch (err) {
      console.error('Admin fetch submissions error:', err);
      res.status(500).json({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to fetch submissions list from database',
      });
    }
  });

  // Get Admin Dashboard Stats
  app.get('/api/admin/stats', requireAdminAuth, async (_req, res) => {
    try {
      const stats = await getStats();
      res.json({
        success: true,
        data: stats,
      });
    } catch (err) {
      console.error('Admin fetch stats error:', err);
      res.status(500).json({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to calculate stats from database',
      });
    }
  });

  // Update Submission Status (Approve / Reject - ONE-WAY FINAL DECISION)
  app.patch('/api/admin/submissions/:id/status', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (status !== 'Approved' && status !== 'Rejected') {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Can only change status to Approved or Rejected.',
        });
      }

      const result = await updateSubmissionStatus(id, status);

      if (result.success === false) {
        if (result.notFound) {
          return res.status(404).json({
            success: false,
            message: result.message,
          });
        }

        if (result.alreadyProcessed) {
          return res.status(409).json({
            success: false,
            alreadyProcessed: true,
            currentStatus: result.currentStatus,
            message: result.message,
          });
        }

        return res.status(400).json({
          success: false,
          message: result.message,
        });
      }

      return res.json({
        success: true,
        data: result.record,
        message: `Request status finalized as ${status}`,
      });
    } catch (err) {
      console.error('Admin update status error:', err);
      res.status(500).json({
        success: false,
        message: err instanceof Error ? err.message : 'Database error while updating status',
      });
    }
  });

  // Delete Submission
  app.delete('/api/admin/submissions/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await deleteSubmission(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Submission record not found in database',
        });
      }

      res.json({
        success: true,
        message: 'Submission successfully deleted',
      });
    } catch (err) {
      console.error('Admin delete submission error:', err);
      res.status(500).json({
        success: false,
        message: err instanceof Error ? err.message : 'Database error while deleting submission',
      });
    }
  });

  return app;
}
