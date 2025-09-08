import Database from 'better-sqlite3';
import { LogEntry, UserAgentStats, PageStats, ReferrerStats, ErrorStats, BandwidthStats, TopIPStats } from './types.js';
import { isBot } from './parser.js';
import { subDays } from 'date-fns';

export class LogDatabase {
  private db: Database.Database;

  constructor(dbPath: string = './logs.db') {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // Create hosts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hosts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hostname TEXT UNIQUE NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Create the main log entries table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS log_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        host_id INTEGER NOT NULL,
        ip TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        protocol TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        response_size INTEGER NOT NULL,
        referrer TEXT NOT NULL DEFAULT '',
        user_agent TEXT NOT NULL,
        forwarded_for TEXT,
        is_bot INTEGER NOT NULL DEFAULT 0,
        date_only TEXT NOT NULL,
        FOREIGN KEY (host_id) REFERENCES hosts (id)
      );
    `);

    // Create indexes for better query performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_host_id ON log_entries(host_id);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON log_entries(timestamp);
      CREATE INDEX IF NOT EXISTS idx_date_only ON log_entries(date_only);
      CREATE INDEX IF NOT EXISTS idx_status_code ON log_entries(status_code);
      CREATE INDEX IF NOT EXISTS idx_user_agent ON log_entries(user_agent);
      CREATE INDEX IF NOT EXISTS idx_url ON log_entries(url);
      CREATE INDEX IF NOT EXISTS idx_referrer ON log_entries(referrer);
      CREATE INDEX IF NOT EXISTS idx_ip ON log_entries(ip);
      CREATE INDEX IF NOT EXISTS idx_is_bot ON log_entries(is_bot);
    `);

    // Create a metadata table to track file processing
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_metadata (
        file_path TEXT PRIMARY KEY,
        hostname TEXT NOT NULL,
        last_modified INTEGER NOT NULL,
        file_size INTEGER NOT NULL,
        processed_at INTEGER NOT NULL
      );
    `);
  }

  insertLogEntry(entry: LogEntry, hostname: string): void {
    const hostId = this.getOrCreateHost(hostname);
    const stmt = this.db.prepare(`
      INSERT INTO log_entries (
        host_id, ip, timestamp, method, url, protocol, status_code, response_size,
        referrer, user_agent, forwarded_for, is_bot, date_only
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const timestampMs = entry.timestamp.getTime();
    const dateOnly = entry.timestamp.toISOString().split('T')[0];
    const isBotFlag = isBot(entry.userAgent) ? 1 : 0;

    stmt.run(
      hostId,
      entry.ip,
      timestampMs,
      entry.method,
      entry.url,
      entry.protocol,
      entry.statusCode,
      entry.responseSize,
      entry.referrer,
      entry.userAgent,
      entry.forwardedFor || null,
      isBotFlag,
      dateOnly
    );
  }

  insertLogEntries(entries: LogEntry[], hostname: string): void {
    const hostId = this.getOrCreateHost(hostname);
    const stmt = this.db.prepare(`
      INSERT INTO log_entries (
        host_id, ip, timestamp, method, url, protocol, status_code, response_size,
        referrer, user_agent, forwarded_for, is_bot, date_only
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((entries: LogEntry[]) => {
      for (const entry of entries) {
        const timestampMs = entry.timestamp.getTime();
        const dateOnly = entry.timestamp.toISOString().split('T')[0];
        const isBotFlag = isBot(entry.userAgent) ? 1 : 0;

        stmt.run(
          hostId,
          entry.ip,
          timestampMs,
          entry.method,
          entry.url,
          entry.protocol,
          entry.statusCode,
          entry.responseSize,
          entry.referrer,
          entry.userAgent,
          entry.forwardedFor || null,
          isBotFlag,
          dateOnly
        );
      }
    });

    transaction(entries);
  }

  getUserAgentStats(limit: number = 50): UserAgentStats[] {
    const now = new Date();
    const oneDayAgo = subDays(now, 1).getTime();
    const sevenDaysAgo = subDays(now, 7).getTime();
    const thirtyDaysAgo = subDays(now, 30).getTime();

    const stmt = this.db.prepare(`
      SELECT 
        user_agent,
        is_bot,
        SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) as requests_1d,
        SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) as requests_7d,
        SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) as requests_30d
      FROM log_entries 
      GROUP BY user_agent, is_bot
      ORDER BY requests_30d DESC
      LIMIT ?
    `);

    const results = stmt.all(oneDayAgo, sevenDaysAgo, thirtyDaysAgo, limit) as any[];
    
    return results.map(row => ({
      userAgent: row.user_agent,
      requests1d: row.requests_1d,
      requests7d: row.requests_7d,
      requests30d: row.requests_30d,
      isBot: Boolean(row.is_bot)
    }));
  }

  getPageStats(limit: number = 50): PageStats[] {
    const now = new Date();
    const oneDayAgo = subDays(now, 1).getTime();
    const sevenDaysAgo = subDays(now, 7).getTime();
    const thirtyDaysAgo = subDays(now, 30).getTime();

    const stmt = this.db.prepare(`
      SELECT 
        url,
        SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) as requests_1d,
        SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) as requests_7d,
        SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) as requests_30d,
        COUNT(DISTINCT CASE WHEN timestamp >= ? THEN ip END) as unique_ips_1d,
        COUNT(DISTINCT CASE WHEN timestamp >= ? THEN ip END) as unique_ips_7d,
        COUNT(DISTINCT CASE WHEN timestamp >= ? THEN ip END) as unique_ips_30d,
        SUM(CASE WHEN timestamp >= ? AND is_bot = 1 THEN 1 ELSE 0 END) as bot_requests_1d,
        SUM(CASE WHEN timestamp >= ? AND is_bot = 1 THEN 1 ELSE 0 END) as bot_requests_7d,
        SUM(CASE WHEN timestamp >= ? AND is_bot = 1 THEN 1 ELSE 0 END) as bot_requests_30d,
        SUM(CASE WHEN timestamp >= ? AND is_bot = 0 THEN 1 ELSE 0 END) as non_bot_requests_1d,
        SUM(CASE WHEN timestamp >= ? AND is_bot = 0 THEN 1 ELSE 0 END) as non_bot_requests_7d,
        SUM(CASE WHEN timestamp >= ? AND is_bot = 0 THEN 1 ELSE 0 END) as non_bot_requests_30d
      FROM log_entries 
      GROUP BY url
      ORDER BY requests_30d DESC
      LIMIT ?
    `);

    const results = stmt.all(
      oneDayAgo, sevenDaysAgo, thirtyDaysAgo,  // for requests
      oneDayAgo, sevenDaysAgo, thirtyDaysAgo,  // for unique IPs
      oneDayAgo, sevenDaysAgo, thirtyDaysAgo,  // for bot requests
      oneDayAgo, sevenDaysAgo, thirtyDaysAgo,  // for non-bot requests
      limit
    ) as any[];

    return results.map(row => ({
      url: row.url,
      requests1d: row.requests_1d || 0,
      requests7d: row.requests_7d || 0,
      requests30d: row.requests_30d || 0,
      uniqueIPs1d: row.unique_ips_1d || 0,
      uniqueIPs7d: row.unique_ips_7d || 0,
      uniqueIPs30d: row.unique_ips_30d || 0,
      botRequests1d: row.bot_requests_1d || 0,
      botRequests7d: row.bot_requests_7d || 0,
      botRequests30d: row.bot_requests_30d || 0,
      nonBotRequests1d: row.non_bot_requests_1d || 0,
      nonBotRequests7d: row.non_bot_requests_7d || 0,
      nonBotRequests30d: row.non_bot_requests_30d || 0
    }));
  }

  getReferrerStats(limit: number = 50): ReferrerStats[] {
    const now = new Date();
    const oneDayAgo = subDays(now, 1).getTime();
    const sevenDaysAgo = subDays(now, 7).getTime();
    const thirtyDaysAgo = subDays(now, 30).getTime();

    const stmt = this.db.prepare(`
      SELECT 
        referrer,
        SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) as requests_1d,
        SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) as requests_7d,
        SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) as requests_30d
      FROM log_entries 
      WHERE referrer != '' AND referrer != '-'
      GROUP BY referrer
      ORDER BY requests_30d DESC
      LIMIT ?
    `);

    const results = stmt.all(oneDayAgo, sevenDaysAgo, thirtyDaysAgo, limit) as any[];
    
    return results.map(row => ({
      referrer: row.referrer,
      requests1d: row.requests_1d || 0,
      requests7d: row.requests_7d || 0,
      requests30d: row.requests_30d || 0
    }));
  }

  getErrorStats(limit: number = 50): ErrorStats[] {
    const now = new Date();
    const oneDayAgo = subDays(now, 1).getTime();
    const sevenDaysAgo = subDays(now, 7).getTime();
    const thirtyDaysAgo = subDays(now, 30).getTime();

    const stmt = this.db.prepare(`
      SELECT 
        url,
        status_code,
        SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) as requests_1d,
        SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) as requests_7d,
        SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) as requests_30d
      FROM log_entries 
      WHERE status_code >= 400
      GROUP BY url, status_code
      ORDER BY requests_30d DESC
      LIMIT ?
    `);

    const results = stmt.all(oneDayAgo, sevenDaysAgo, thirtyDaysAgo, limit) as any[];
    
    return results.map(row => ({
      url: row.url,
      statusCode: row.status_code,
      requests1d: row.requests_1d || 0,
      requests7d: row.requests_7d || 0,
      requests30d: row.requests_30d || 0
    }));
  }

  getBandwidthStats(): BandwidthStats[] {
    const stmt = this.db.prepare(`
      SELECT 
        date_only as date,
        SUM(response_size) as total_bytes,
        COUNT(*) as total_requests,
        AVG(response_size) as average_response_size
      FROM log_entries 
      GROUP BY date_only
      ORDER BY date_only DESC
      LIMIT 30
    `);

    const results = stmt.all() as any[];
    
    return results.map(row => ({
      date: row.date,
      totalBytes: row.total_bytes || 0,
      totalRequests: row.total_requests || 0,
      averageResponseSize: Math.round(row.average_response_size || 0)
    }));
  }

  getTopIPs(limit: number = 50): TopIPStats[] {
    const now = new Date();
    const oneDayAgo = subDays(now, 1).getTime();
    const sevenDaysAgo = subDays(now, 7).getTime();
    const thirtyDaysAgo = subDays(now, 30).getTime();

    const stmt = this.db.prepare(`
      SELECT 
        ip,
        SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) as requests_1d,
        SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) as requests_7d,
        SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) as requests_30d,
        MAX(is_bot) as is_bot
      FROM log_entries 
      GROUP BY ip
      ORDER BY requests_30d DESC
      LIMIT ?
    `);

    const results = stmt.all(oneDayAgo, sevenDaysAgo, thirtyDaysAgo, limit) as any[];
    
    return results.map(row => ({
      ip: row.ip,
      requests1d: row.requests_1d || 0,
      requests7d: row.requests_7d || 0,
      requests30d: row.requests_30d || 0,
      isBot: Boolean(row.is_bot)
    }));
  }

  clearAllData(): void {
    this.db.exec('DELETE FROM log_entries');
    this.db.exec('DELETE FROM file_metadata');
    this.db.exec('DELETE FROM hosts');
  }

  close(): void {
    this.db.close();
  }

  getLogCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM log_entries');
    const result = stmt.get() as any;
    return result.count;
  }

  getOrCreateHost(hostname: string): number {
    const now = Date.now();
    
    // Try to find existing host
    const selectStmt = this.db.prepare('SELECT id FROM hosts WHERE hostname = ?');
    const existingHost = selectStmt.get(hostname) as any;
    
    if (existingHost) {
      // Update the updated_at timestamp
      const updateStmt = this.db.prepare('UPDATE hosts SET updated_at = ? WHERE id = ?');
      updateStmt.run(now, existingHost.id);
      return existingHost.id;
    }
    
    // Create new host
    const insertStmt = this.db.prepare(`
      INSERT INTO hosts (hostname, created_at, updated_at)
      VALUES (?, ?, ?)
    `);
    const result = insertStmt.run(hostname, now, now);
    return result.lastInsertRowid as number;
  }

  getAllHosts(): Array<{id: number, hostname: string, createdAt: Date, updatedAt: Date}> {
    const stmt = this.db.prepare('SELECT id, hostname, created_at, updated_at FROM hosts ORDER BY hostname');
    const results = stmt.all() as any[];
    
    return results.map(row => ({
      id: row.id,
      hostname: row.hostname,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }
}