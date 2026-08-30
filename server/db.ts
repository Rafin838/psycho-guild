import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { UserSubmission, AdminStats, SubmissionStatus } from '../src/types.js';
import { formatDhakaDate, formatDhakaTime, isTodayInDhaka } from './timezone.js';

// Configuration for Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Create a single supabase client for interacting with the database
let supabase: any = null;

console.log(`[SUPABASE CONFIG]\nURL configured: ${!!supabaseUrl}\nSERVICE KEY configured: ${!!supabaseServiceKey}`);

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false, // Do not persist session in server environment
    },
  });
}

export interface InternalSubmissionRecord extends UserSubmission {
  submissionSecret: string;
}

// Helper to map DB record to internal record
function mapDbRecordToInternal(dbRecord: any): InternalSubmissionRecord {
  return {
    id: dbRecord.id,
    submissionSecret: dbRecord.submission_secret,
    gameName: dbRecord.game_name,
    gameUid: dbRecord.game_uid,
    status: dbRecord.status === 'pending' ? 'Pending' : (dbRecord.status === 'approved' ? 'Approved' : 'Rejected'),
    submissionDate: dbRecord.submission_date || formatDhakaDate(new Date(dbRecord.created_at).getTime()),
    submissionTime: dbRecord.submission_time || formatDhakaTime(new Date(dbRecord.created_at).getTime()),
    createdAt: new Date(dbRecord.created_at).getTime(),
    ipAddress: dbRecord.ip_address,
    notes: dbRecord.notes,
  };
}

export async function loadAllSubmissions(): Promise<InternalSubmissionRecord[]> {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Supabase credentials missing. Returning empty submissions.');
    throw new Error('Database credentials missing. Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to read from Supabase:', error);
    if (error.code === '42P01') {
      throw new Error("Supabase Error: The 'submissions' table does not exist. Please run the SQL in 'supabase-schema.sql'.");
    }
    throw new Error(`Production Database Error: ${error.message || 'Failed to retrieve submission records from Supabase.'}`);
  }

  const mapped = (data || []).map(mapDbRecordToInternal);
  
  console.log(`[SUPABASE SELECT]\nsuccess: true\nrecord count: ${mapped.length}`);
  
  return mapped;
}

export function checkSupabaseHealth(): { status: string; message: string; connected: boolean } {
  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      status: 'error',
      message: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are missing.',
      connected: false
    };
  }
  return {
    status: 'ok',
    message: 'Supabase credentials configured.',
    connected: true
  };
}

export async function checkGameUidExists(
  normalizedUid: string
): Promise<{ exists: boolean; existingRecord?: InternalSubmissionRecord }> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return { exists: false };
  }
  
  const cleanInput = (normalizedUid || '').trim().toLowerCase();
  const all = await loadAllSubmissions();
  
  const found = all.find((item) => {
    const itemDigits = item.gameUid.trim().replace(/\D/g, '');
    const inputDigits = cleanInput.replace(/\D/g, '');
    if (itemDigits && inputDigits && itemDigits === inputDigits) {
      return true;
    }
    return item.gameUid.trim().toLowerCase() === cleanInput;
  });

  return { exists: Boolean(found), existingRecord: found };
}

export async function getAllSubmissionsAdmin(): Promise<UserSubmission[]> {
  const items = await loadAllSubmissions();
  
  const mapped = items
    .map((item) => ({
      id: item.id,
      gameName: item.gameName,
      gameUid: item.gameUid,
      status: item.status,
      submissionDate: item.submissionDate,
      submissionTime: item.submissionTime,
      createdAt: item.createdAt,
      ipAddress: item.ipAddress,
      notes: item.notes,
    }));

  return mapped;
}

export async function getSubmissionByIdSecure(
  id: string,
  sessionToken?: string,
  isAdmin: boolean = false
): Promise<{
  success: boolean;
  record?: UserSubmission;
  forbidden?: boolean;
  notFound?: boolean;
  message?: string;
}> {
  const cleanId = (id || '').trim();
  if (!cleanId) {
    return { success: false, notFound: true, message: 'Invalid submission ID' };
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return { success: false, message: 'Database disconnected' };
  }

  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', cleanId)
    .single();

  if (error || !data) {
    return { success: false, notFound: true, message: 'Submission not found' };
  }

  const found = mapDbRecordToInternal(data);

  if (isAdmin) {
    return {
      success: true,
      record: {
        id: found.id,
        gameName: found.gameName,
        gameUid: found.gameUid,
        status: found.status,
        submissionDate: found.submissionDate,
        submissionTime: found.submissionTime,
        createdAt: found.createdAt,
        ipAddress: found.ipAddress,
      },
    };
  }

  const providedToken = (sessionToken || '').trim();
  if (!providedToken || providedToken !== found.submissionSecret) {
    return {
      success: false,
      forbidden: true,
      message: 'Access denied: Valid submission session token is required to view this status',
    };
  }

  return {
    success: true,
    record: {
      id: found.id,
      clientToken: found.submissionSecret,
      gameName: found.gameName,
      gameUid: found.gameUid,
      status: found.status,
      submissionDate: found.submissionDate,
      submissionTime: found.submissionTime,
      createdAt: found.createdAt,
    },
  };
}

export async function addSubmission(
  gameName: string,
  gameUid: string,
  clientIp?: string
): Promise<{
  success: boolean;
  record?: UserSubmission;
  message?: string;
  duplicateUid?: boolean;
}> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return { success: false, message: 'Database credentials missing.' };
  }

  const normalizedUid = gameUid.trim().replace(/\D/g, '') || gameUid.trim().toLowerCase();

  const { exists, existingRecord } = await checkGameUidExists(normalizedUid);
  if (exists) {
    return {
      success: false,
      duplicateUid: true,
      message: `এই গেম UID (${gameUid}) ইতিমধ্যে যুক্ত রয়েছে! পূর্বের স্ট্যাটাস: ${existingRecord?.status || 'Pending'}`,
    };
  }

  const now = new Date();
  const submissionDate = formatDhakaDate(now);
  const submissionTime = formatDhakaTime(now);
  const createdAt = now.getTime();

  const submissionId = `sub_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
  const submissionSecret = `tok_${crypto.randomBytes(24).toString('hex')}`;

  const { error } = await supabase.from('submissions').insert({
    id: submissionId,
    game_name: gameName.trim(),
    game_uid: gameUid.trim(),
    status: 'pending',
    submission_secret: submissionSecret,
    ip_address: clientIp,
    submission_date: submissionDate,
    submission_time: submissionTime,
  });

  if (error) {
    console.error('Supabase INSERT error:', error);
    if (error.code === '42P01') {
      throw new Error("Supabase Error: The 'submissions' table does not exist. Please run the SQL in 'supabase-schema.sql'.");
    }
    if (error.code === '23505') {
      return {
        success: false,
        duplicateUid: true,
        message: 'This Game UID has already been submitted.',
      };
    }
    throw new Error(`Production Database Error: ${error.message || 'Failed to persist record.'}`);
  }

  console.log(`[SUPABASE INSERT]\nsuccess: true\nsubmission ID: ${submissionId}`);

  return {
    success: true,
    record: {
      id: submissionId,
      clientToken: submissionSecret,
      gameName: gameName.trim(),
      gameUid: gameUid.trim(),
      status: 'Pending',
      submissionDate,
      submissionTime,
      createdAt,
    },
  };
}

export async function updateSubmissionStatus(
  id: string,
  newStatus: SubmissionStatus
): Promise<{
  success: boolean;
  record?: UserSubmission;
  message?: string;
  notFound?: boolean;
  alreadyProcessed?: boolean;
  currentStatus?: SubmissionStatus;
}> {
  const cleanId = (id || '').trim();
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return { success: false, message: 'Database credentials missing.' };
  }

  const { data: existing, error: fetchError } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', cleanId)
    .single();

  if (fetchError || !existing) {
    return { success: false, notFound: true, message: 'Submission not found' };
  }

  const oldStatus = existing.status === 'pending' ? 'Pending' : (existing.status === 'approved' ? 'Approved' : 'Rejected');

  if (oldStatus !== 'Pending' && oldStatus !== newStatus) {
    return {
      success: false,
      alreadyProcessed: true,
      currentStatus: oldStatus,
      message: `This request has already been finalized as "${oldStatus}" and cannot be changed.`,
    };
  }

  const updatedStatusStr = newStatus === 'Approved' ? 'approved' : 'rejected';

  const { data: updated, error: updateError } = await supabase
    .from('submissions')
    .update({ 
      status: updatedStatusStr, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', cleanId)
    .select()
    .single();

  if (updateError || !updated) {
    console.error('Supabase UPDATE error:', updateError);
    return { success: false, message: 'Database update failed.' };
  }

  const mapped = mapDbRecordToInternal(updated);

  console.log(`[ADMIN STATUS UPDATE] ID: ${cleanId} | Old: ${oldStatus} | New: ${newStatus}`);

  return {
    success: true,
    record: {
      id: mapped.id,
      gameName: mapped.gameName,
      gameUid: mapped.gameUid,
      status: mapped.status,
      submissionDate: mapped.submissionDate,
      submissionTime: mapped.submissionTime,
      createdAt: mapped.createdAt,
      ipAddress: mapped.ipAddress,
    },
  };
}

export async function deleteSubmission(id: string): Promise<boolean> {
  const cleanId = (id || '').trim();
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return false;
  }

  const { error } = await supabase
    .from('submissions')
    .delete()
    .eq('id', cleanId);

  if (error) {
    console.error('Supabase DELETE error:', error);
    return false;
  }

  console.log(`[ADMIN SUBMISSION DELETE] ID: ${cleanId}`);
  return true;
}

export async function getStats(): Promise<AdminStats> {
  const items = await loadAllSubmissions();
  const now = new Date();
  const todayDhakaDateStr = formatDhakaDate(now);

  const totalUsers = items.length;
  const pendingRequests = items.filter((i) => i.status === 'Pending').length;
  const approvedUsers = items.filter((i) => i.status === 'Approved').length;
  const rejectedUsers = items.filter((i) => i.status === 'Rejected').length;

  const todaySubmissions = items.filter((i) => {
    if (i.createdAt && typeof i.createdAt === 'number') {
      return isTodayInDhaka(i.createdAt, now);
    }
    return i.submissionDate === todayDhakaDateStr;
  }).length;

  return {
    totalUsers,
    pendingRequests,
    approvedCount: approvedUsers,
    rejectedCount: rejectedUsers,
    todaySubmissions,
    totalRecords: totalUsers,
  };
}
