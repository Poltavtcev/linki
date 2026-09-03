import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const db = getDb();

  const accounts = db.prepare(`
    SELECT id, name, from_email, daily_email_limit, ramp_up_enabled, ramp_start_date
    FROM email_accounts
    ORDER BY name
  `).all() as {
    id: string; name: string; from_email: string;
    daily_email_limit: number; ramp_up_enabled: number; ramp_start_date: string | null;
  }[];

  // Sent per account per day for the last 7 days
  const dailySends = db.prepare(`
    SELECT rp.email_account_id,
           date(l.created_at) as day,
           COUNT(*) as sent
    FROM logs l
    JOIN run_profiles rp ON rp.run_id = l.run_id AND rp.target_id = l.target_id
    WHERE l.message LIKE 'Email sent%'
    AND l.created_at >= date('now', '-6 days')
    GROUP BY rp.email_account_id, date(l.created_at)
  `).all() as { email_account_id: string; day: string; sent: number }[];

  // Last 50 email send log entries across all accounts
  const recentLogs = db.prepare(`
    SELECT l.created_at, l.message, rp.email_account_id, r.account_id as linkedin_account_id
    FROM logs l
    LEFT JOIN run_profiles rp ON rp.run_id = l.run_id AND rp.target_id = l.target_id
    LEFT JOIN runs r ON r.id = l.run_id
    WHERE l.message LIKE 'Email sent%' 
       OR l.message LIKE 'Connection request sent%'
       OR l.message LIKE 'Sending message to%'
       OR l.message LIKE 'InMail sent%'
       OR l.message LIKE 'Profile visited%'
    ORDER BY l.created_at DESC
    LIMIT 50
  `).all() as { created_at: string; message: string; email_account_id: string | null; linkedin_account_id: string | null }[]; message: string; email_account_id: string }[];

  // Guard trips today
  const guardTrips = db.prepare(`
    SELECT l.created_at, l.message, rp.email_account_id, r.account_id as linkedin_account_id
    FROM logs l
    LEFT JOIN run_profiles rp ON rp.run_id = l.run_id AND rp.target_id = l.target_id
    LEFT JOIN runs r ON r.id = l.run_id
    WHERE (l.message LIKE '%Daily limit%' OR l.message LIKE '%limit guard%' OR l.message LIKE '%weekly quota%')
    AND date(l.created_at) = date('now')
    ORDER BY l.created_at DESC
    LIMIT 50
  `).all() as { created_at: string; message: string; email_account_id: string | null; linkedin_account_id: string | null }[]; message: string; email_account_id: string | null }[];

  function effectiveLimit(a: typeof accounts[0], date: Date) {
    if (!a.ramp_up_enabled || !a.ramp_start_date) return a.daily_email_limit;
    const start = new Date(a.ramp_start_date);
    const daysActive = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.min(a.daily_email_limit, daysActive * 2);
  }

  const now = new Date();
  // Build last 7 days list (UTC dates)
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  // Index sends: accountId -> day -> count
  const sendsIndex: Record<string, Record<string, number>> = {};
  for (const row of dailySends) {
    if (!sendsIndex[row.email_account_id]) sendsIndex[row.email_account_id] = {};
    sendsIndex[row.email_account_id][row.day] = row.sent;
  }

  const today = now.toISOString().slice(0, 10);

  const result = accounts.map(a => {
    const sentToday = sendsIndex[a.id]?.[today] ?? 0;
    const limit = effectiveLimit(a, now);
    return {
      id: a.id,
      name: a.name,
      from_email: a.from_email,
      daily_email_limit: a.daily_email_limit,
      ramp_up_enabled: a.ramp_up_enabled,
      ramp_start_date: a.ramp_start_date,
      effective_limit_today: limit,
      sent_today: sentToday,
      days: days.map(day => ({
        day,
        sent: sendsIndex[a.id]?.[day] ?? 0,
        limit: effectiveLimit(a, new Date(day + "T12:00:00Z")),
      })),
    };
  });

  
  // LinkedIn Accounts
  const liAccounts = db.prepare(`
    SELECT id, name, daily_connection_limit, weekly_connection_limit, daily_message_limit, daily_inmail_limit
    FROM accounts
    ORDER BY name
  `).all() as any[];

  const liCounts = db.prepare(`
    SELECT 
      a.id,
      SUM(CASE WHEN l.message LIKE 'Connection request sent%' AND date(l.created_at) = date('now') THEN 1 ELSE 0 END) as connects_today,
      SUM(CASE WHEN l.message LIKE 'Connection request sent%' AND l.created_at >= datetime('now', 'weekday 1', '-7 days') THEN 1 ELSE 0 END) as connects_week,
      SUM(CASE WHEN l.message LIKE 'Sending message to%' AND date(l.created_at) = date('now') THEN 1 ELSE 0 END) as messages_today,
      SUM(CASE WHEN l.message LIKE 'InMail sent to%' AND date(l.created_at) = date('now') THEN 1 ELSE 0 END) as inmails_today,
      SUM(CASE WHEN l.message LIKE 'Profile visited:%' AND date(l.created_at) = date('now') THEN 1 ELSE 0 END) as visits_today
    FROM logs l
    JOIN runs r ON r.id = l.run_id
    JOIN accounts a ON a.id = r.account_id
    WHERE l.created_at >= datetime('now', 'weekday 1', '-7 days')
    GROUP BY a.id
  `).all() as any[];

  function calculateDailyJitteredLimit(maxLimit: number, accountId: string, dateStr: string): number {
    if (maxLimit <= 0) return 0;
    const input = accountId + "_" + dateStr;
    let h = 0;
    for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
    const variancePercent = 80 + (h % 21);
    return Math.max(1, Math.floor((maxLimit * variancePercent) / 100));
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const linkedin = liAccounts.map(a => {
    const counts = liCounts.find(c => c.id === a.id) || { connects_today: 0, connects_week: 0, messages_today: 0, inmails_today: 0, visits_today: 0 };
    return {
      id: a.id,
      name: a.name,
      invitations: {
        sentToday: counts.connects_today,
        limitToday: calculateDailyJitteredLimit(a.daily_connection_limit ?? 20, a.id, todayStr),
        sentWeek: counts.connects_week,
        limitWeek: a.weekly_connection_limit ?? 200
      },
      messages: {
        sentToday: counts.messages_today,
        limitToday: calculateDailyJitteredLimit(a.daily_message_limit ?? 50, a.id, todayStr)
      },
      visits: {
        sentToday: counts.visits_today,
        limitToday: 150 // Generic hard cap assumption based on Waalaxy for visits
      },
      inmails: {
        sentToday: counts.inmails_today,
        limitToday: calculateDailyJitteredLimit(a.daily_inmail_limit ?? 15, a.id, todayStr)
      }
    };
  });

  res.json({ accounts: result, linkedin, days, recentLogs, guardTrips });
}
