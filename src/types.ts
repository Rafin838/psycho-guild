export type SubmissionStatus = 'Pending' | 'Approved' | 'Rejected';

export interface UserSubmission {
  id: string;
  clientSubmissionId?: string;
  clientToken?: string;
  gameName: string;
  gameUid: string;
  status: SubmissionStatus;
  submissionDate: string; // e.g. "28 Aug 2026"
  submissionTime: string; // e.g. "02:15 PM"
  createdAt: number;      // Unix timestamp (ms)
  ipAddress?: string;
  notes?: string;
}

export interface AdminStats {
  totalUsers: number;
  todaySubmissions: number;
  pendingRequests: number;
  totalRecords: number;
  approvedCount: number;
  rejectedCount: number;
}

export interface AdminUser {
  email: string;
  name: string;
  role: 'admin';
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: AdminUser;
  message?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
