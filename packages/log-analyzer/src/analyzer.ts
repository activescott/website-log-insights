import { readFileSync, existsSync } from 'fs';
import { LogDatabase } from './database.js';
import { parseLogFile } from './parser.js';
import { UserAgentStats, PageStats, ReferrerStats, ErrorStats, BandwidthStats, TopIPStats } from './types.js';

export interface AnalysisResults {
  userAgents: UserAgentStats[];
  pages: PageStats[];
  referrers: ReferrerStats[];
  errors: ErrorStats[];
  bandwidth: BandwidthStats[];
  topIPs: TopIPStats[];
  summary: {
    totalRequests: number;
    totalUniqueIPs: number;
    totalBandwidth: number;
    avgResponseSize: number;
    botTrafficPercentage: number;
    mostActiveDay: string;
    topStatusCodes: Array<{ code: number; count: number }>;
  };
}

export class LogAnalyzer {
  private db: LogDatabase;

  constructor(dbPath?: string) {
    this.db = new LogDatabase(dbPath);
  }

  async loadLogFile(filePath: string, hostname: string): Promise<void> {
    if (!existsSync(filePath)) {
      throw new Error(`Log file not found: ${filePath}`);
    }

    if (!hostname || hostname.trim() === '') {
      throw new Error('Hostname is required when loading log files');
    }

    console.log(`Loading log file: ${filePath} for host: ${hostname}`);
    const content = readFileSync(filePath, 'utf-8');
    const entries = parseLogFile(content);
    
    if (entries.length === 0) {
      throw new Error('No valid log entries found in the file');
    }

    console.log(`Parsed ${entries.length} log entries`);
    console.log('Importing into database...');
    
    this.db.insertLogEntries(entries, hostname);
    
    console.log(`Successfully imported ${entries.length} log entries for host: ${hostname}`);
  }

  async analyze(options: {
    userAgentLimit?: number;
    pageLimit?: number;
    referrerLimit?: number;
    errorLimit?: number;
    ipLimit?: number;
  } = {}): Promise<AnalysisResults> {
    const {
      userAgentLimit = 50,
      pageLimit = 50,
      referrerLimit = 50,
      errorLimit = 50,
      ipLimit = 50
    } = options;

    console.log('Running analysis...');

    // Get all the stats
    const userAgents = this.db.getUserAgentStats(userAgentLimit);
    const pages = this.db.getPageStats(pageLimit);
    const referrers = this.db.getReferrerStats(referrerLimit);
    const errors = this.db.getErrorStats(errorLimit);
    const bandwidth = this.db.getBandwidthStats();
    const topIPs = this.db.getTopIPs(ipLimit);

    // Calculate summary statistics
    const summary = this.calculateSummary();

    return {
      userAgents,
      pages,
      referrers,
      errors,
      bandwidth,
      topIPs,
      summary
    };
  }

  private calculateSummary() {
    // Get basic counts
    const totalRequests = this.db.getLogCount();
    
    // Get unique IP count
    const uniqueIPsStmt = this.db['db'].prepare('SELECT COUNT(DISTINCT ip) as count FROM log_entries');
    const uniqueIPsResult = uniqueIPsStmt.get() as any;
    const totalUniqueIPs = uniqueIPsResult.count;

    // Get total bandwidth
    const bandwidthStmt = this.db['db'].prepare('SELECT SUM(response_size) as total FROM log_entries');
    const bandwidthResult = bandwidthStmt.get() as any;
    const totalBandwidth = bandwidthResult.total || 0;

    // Get average response size
    const avgSizeStmt = this.db['db'].prepare('SELECT AVG(response_size) as avg FROM log_entries');
    const avgSizeResult = avgSizeStmt.get() as any;
    const avgResponseSize = Math.round(avgSizeResult.avg || 0);

    // Get bot traffic percentage
    const botStmt = this.db['db'].prepare('SELECT COUNT(*) as bot_count FROM log_entries WHERE is_bot = 1');
    const botResult = botStmt.get() as any;
    const botTrafficPercentage = totalRequests > 0 ? Math.round((botResult.bot_count / totalRequests) * 100) : 0;

    // Get most active day
    const mostActiveDayStmt = this.db['db'].prepare(`
      SELECT date_only, COUNT(*) as request_count 
      FROM log_entries 
      GROUP BY date_only 
      ORDER BY request_count DESC 
      LIMIT 1
    `);
    const mostActiveDayResult = mostActiveDayStmt.get() as any;
    const mostActiveDay = mostActiveDayResult?.date_only || 'N/A';

    // Get top status codes
    const statusCodesStmt = this.db['db'].prepare(`
      SELECT status_code, COUNT(*) as count 
      FROM log_entries 
      GROUP BY status_code 
      ORDER BY count DESC 
      LIMIT 10
    `);
    const statusCodesResults = statusCodesStmt.all() as any[];
    const topStatusCodes = statusCodesResults.map(row => ({
      code: row.status_code,
      count: row.count
    }));

    return {
      totalRequests,
      totalUniqueIPs,
      totalBandwidth,
      avgResponseSize,
      botTrafficPercentage,
      mostActiveDay,
      topStatusCodes
    };
  }

  getAllHosts(): Array<{id: number, hostname: string, createdAt: Date, updatedAt: Date}> {
    return this.db.getAllHosts();
  }

  clearData(): void {
    this.db.clearAllData();
  }

  close(): void {
    this.db.close();
  }
}