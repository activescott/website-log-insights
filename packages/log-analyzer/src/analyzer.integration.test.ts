import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync } from 'fs';
import path from 'path';
import { LogAnalyzer } from './analyzer.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('LogAnalyzer Integration Tests', () => {
  let analyzer: LogAnalyzer;
  const testDbPath = path.resolve(__dirname,'./test-logs.db');
  const testLogPath = path.resolve(__dirname,'../test-data/sample.log');

  beforeEach(() => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    analyzer = new LogAnalyzer(testDbPath);
  });

  afterEach(() => {
    analyzer.close();
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('Host Tracking', () => {
    it('should track hosts correctly when loading log files', async () => {
      // Load logs for first host
      await analyzer.loadLogFile(testLogPath, 'scott.willeke.com');
      
      const hosts = analyzer.getAllHosts();
      expect(hosts).toHaveLength(1);
      expect(hosts[0].hostname).toBe('scott.willeke.com');
      expect(hosts[0].id).toBe(1);
      expect(hosts[0].createdAt).toBeInstanceOf(Date);
      expect(hosts[0].updatedAt).toBeInstanceOf(Date);
    });

    it('should handle multiple hosts correctly', async () => {
      // Load same logs for different hosts
      await analyzer.loadLogFile(testLogPath, 'scott.willeke.com');
      await analyzer.loadLogFile(testLogPath, 'example.com');
      
      const hosts = analyzer.getAllHosts();
      expect(hosts).toHaveLength(2);
      expect(hosts.map(h => h.hostname).sort()).toEqual(['example.com', 'scott.willeke.com']);
    });

    it('should update timestamp when loading logs for existing host', async () => {
      await analyzer.loadLogFile(testLogPath, 'scott.willeke.com');
      const hostsFirst = analyzer.getAllHosts();
      const firstUpdatedAt = hostsFirst[0].updatedAt;
      
      // Wait a bit and load again
      await new Promise(resolve => setTimeout(resolve, 10));
      await analyzer.loadLogFile(testLogPath, 'scott.willeke.com');
      
      const hostsSecond = analyzer.getAllHosts();
      expect(hostsSecond).toHaveLength(1);
      expect(hostsSecond[0].updatedAt.getTime()).toBeGreaterThan(firstUpdatedAt.getTime());
    });

    it('should throw error when hostname is missing', async () => {
      await expect(analyzer.loadLogFile(testLogPath, '')).rejects.toThrow('Hostname is required');
      await expect(analyzer.loadLogFile(testLogPath, '   ')).rejects.toThrow('Hostname is required');
    });
  });

  describe('Log Loading and Parsing', () => {
    beforeEach(async () => {
      await analyzer.loadLogFile(testLogPath, 'scott.willeke.com');
    });

    it('should parse log entries correctly', async () => {
      const results = await analyzer.analyze();
      
      // Total requests should match number of log lines (121 entries in sample)
      expect(results.summary.totalRequests).toBe(121);
      expect(results.summary.totalRequests).toBeGreaterThan(0);
    });

    it('should calculate unique IPs correctly', async () => {
      const results = await analyzer.analyze();
      
      // Should be less than or equal to total requests due to repeated IPs
      expect(results.summary.totalUniqueIPs).toBeLessThanOrEqual(results.summary.totalRequests);
      expect(results.summary.totalUniqueIPs).toBeGreaterThan(0);
      
      // Based on actual sample data analysis
      expect(results.summary.totalUniqueIPs).toBeGreaterThanOrEqual(1);
    });

    it('should calculate bandwidth correctly', async () => {
      const results = await analyzer.analyze();
      
      expect(results.summary.totalBandwidth).toBeGreaterThan(0);
      expect(results.summary.avgResponseSize).toBeGreaterThan(0);
      
      // Average should be total/count
      const expectedAvg = Math.round(results.summary.totalBandwidth / results.summary.totalRequests);
      expect(results.summary.avgResponseSize).toBe(expectedAvg);
    });
  });

  describe('Bot Detection', () => {
    beforeEach(async () => {
      await analyzer.loadLogFile(testLogPath, 'scott.willeke.com');
    });

    it('should detect bots correctly', async () => {
      const results = await analyzer.analyze();
      
      // Should have some bot traffic percentage
      expect(results.summary.botTrafficPercentage).toBeGreaterThan(0);
      expect(results.summary.botTrafficPercentage).toBeLessThanOrEqual(100);
      
      // Check user agent stats for bot detection
      const botUserAgents = results.userAgents.filter(ua => ua.isBot);
      const nonBotUserAgents = results.userAgents.filter(ua => !ua.isBot);
      
      expect(botUserAgents.length).toBeGreaterThan(0);
      expect(nonBotUserAgents.length).toBeGreaterThan(0);
      
      // Verify known bots from sample data
      const zapierBot = results.userAgents.find(ua => ua.userAgent === 'Zapier');
      const ahrefsBot = results.userAgents.find(ua => ua.userAgent.includes('AhrefsBot'));
      const amazonBot = results.userAgents.find(ua => ua.userAgent.includes('Amazonbot'));
      
      expect(zapierBot?.isBot).toBe(true);
      expect(ahrefsBot?.isBot).toBe(true);
      expect(amazonBot?.isBot).toBe(true);
    });

    it('should count bot vs non-bot traffic correctly in page stats', async () => {
      const results = await analyzer.analyze();
      
      const rootPage = results.pages.find(p => p.url === '/');
      expect(rootPage).toBeDefined();
      
      if (rootPage) {
        expect(rootPage.botRequests30d).toBeGreaterThan(0);
        expect(rootPage.nonBotRequests30d).toBeGreaterThan(0);
        expect(rootPage.requests30d).toBe(rootPage.botRequests30d + rootPage.nonBotRequests30d);
      }
    });
  });

  describe('Status Code Analysis', () => {
    beforeEach(async () => {
      await analyzer.loadLogFile(testLogPath, 'scott.willeke.com');
    });

    it('should track status codes correctly', async () => {
      const results = await analyzer.analyze();
      
      expect(results.summary.topStatusCodes).toBeDefined();
      expect(results.summary.topStatusCodes.length).toBeGreaterThan(0);
      
      // Should have 200, 404, and other status codes from sample data
      const statusCodes = results.summary.topStatusCodes.map(sc => sc.code);
      expect(statusCodes).toContain(200);
      expect(statusCodes).toContain(404);
      
      // Total of all status codes should equal total requests
      const totalStatusCodeRequests = results.summary.topStatusCodes.reduce((sum, sc) => sum + sc.count, 0);
      expect(totalStatusCodeRequests).toBe(results.summary.totalRequests);
    });

    it('should track error statistics correctly', async () => {
      const results = await analyzer.analyze();
      
      expect(results.errors.length).toBeGreaterThan(0);
      
      // Should have 404 errors from .php file requests in sample data
      const phpErrors = results.errors.filter(e => e.url.endsWith('.php') && e.statusCode === 404);
      expect(phpErrors.length).toBeGreaterThan(0);
      
      // Verify error counts match status code analysis
      const total404s = results.summary.topStatusCodes.find(sc => sc.code === 404)?.count || 0;
      const errorTotal404s = results.errors.filter(e => e.statusCode === 404).reduce((sum, e) => sum + e.requests30d, 0);
      expect(errorTotal404s).toBe(total404s);
    });
  });

  describe('Page Statistics', () => {
    beforeEach(async () => {
      await analyzer.loadLogFile(testLogPath, 'scott.willeke.com');
    });

    it('should calculate page statistics correctly', async () => {
      const results = await analyzer.analyze();
      
      expect(results.pages.length).toBeGreaterThan(0);
      
      // Root page should be the most requested
      const rootPage = results.pages.find(p => p.url === '/');
      expect(rootPage).toBeDefined();
      expect(rootPage!.requests30d).toBeGreaterThan(0);
      
      // Feed.rss should have high traffic (lots in sample data)
      const feedPage = results.pages.find(p => p.url === '/feed.rss');
      expect(feedPage).toBeDefined();
      expect(feedPage!.requests30d).toBeGreaterThan(10); // Many Zapier requests in sample
      
      // Verify unique IP counts
      expect(rootPage!.uniqueIPs30d).toBeGreaterThan(0);
      expect(rootPage!.uniqueIPs30d).toBeLessThanOrEqual(rootPage!.requests30d);
    });

    it('should sort pages by request count', async () => {
      const results = await analyzer.analyze();
      
      // Pages should be sorted by 30-day request count descending
      for (let i = 1; i < results.pages.length; i++) {
        expect(results.pages[i-1].requests30d).toBeGreaterThanOrEqual(results.pages[i].requests30d);
      }
    });
  });

  describe('User Agent Analysis', () => {
    beforeEach(async () => {
      await analyzer.loadLogFile(testLogPath, 'scott.willeke.com');
    });

    it('should track user agent statistics correctly', async () => {
      const results = await analyzer.analyze();
      
      expect(results.userAgents.length).toBeGreaterThan(0);
      
      // Zapier should be high due to many feed requests
      const zapier = results.userAgents.find(ua => ua.userAgent === 'Zapier');
      expect(zapier).toBeDefined();
      expect(zapier!.requests30d).toBeGreaterThan(10);
      expect(zapier!.isBot).toBe(true);
      
      // Should have various user agents
      const userAgentStrings = results.userAgents.map(ua => ua.userAgent);
      expect(userAgentStrings).toContain('Zapier');
      expect(userAgentStrings.some(ua => ua.includes('Mozilla'))).toBe(true);
    });
  });

  describe('Referrer Analysis', () => {
    beforeEach(async () => {
      await analyzer.loadLogFile(testLogPath, 'scott.willeke.com');
    });

    it('should track referrer statistics correctly', async () => {
      const results = await analyzer.analyze();
      
      // Should have referrers (some entries have referrers in sample data)
      expect(results.referrers.length).toBeGreaterThan(0);
      
      // Look for referrers from sample data
      const referrerUrls = results.referrers.map(r => r.referrer);
      expect(referrerUrls.some(ref => ref.includes('activescott.com'))).toBe(true);
    });
  });

  describe('Bandwidth Analysis', () => {
    beforeEach(async () => {
      await analyzer.loadLogFile(testLogPath, 'scott.willeke.com');
    });

    it('should calculate bandwidth by date correctly', async () => {
      const results = await analyzer.analyze();
      
      expect(results.bandwidth.length).toBeGreaterThan(0);
      
      // Should have entries for the dates in sample data
      const dates = results.bandwidth.map(b => b.date);
      expect(dates.length).toBeGreaterThan(0);
      expect(dates).toContain('2025-09-07'); // We know this date exists
      
      // Each date entry should have valid data
      results.bandwidth.forEach(entry => {
        expect(entry.totalBytes).toBeGreaterThan(0);
        expect(entry.totalRequests).toBeGreaterThan(0);
        expect(entry.averageResponseSize).toBeGreaterThan(0);
        
        // Average should be reasonable
        const expectedAvg = Math.round(entry.totalBytes / entry.totalRequests);
        expect(entry.averageResponseSize).toBe(expectedAvg);
      });
    });
  });

  describe('Top IP Analysis', () => {
    beforeEach(async () => {
      await analyzer.loadLogFile(testLogPath, 'scott.willeke.com');
    });

    it('should track top IPs correctly', async () => {
      const results = await analyzer.analyze();
      
      expect(results.topIPs.length).toBeGreaterThan(0);
      
      // Should be sorted by request count
      for (let i = 1; i < results.topIPs.length; i++) {
        expect(results.topIPs[i-1].requests30d).toBeGreaterThanOrEqual(results.topIPs[i].requests30d);
      }
      
      // IPs that made multiple requests should be marked correctly
      const multipleRequestIPs = results.topIPs.filter(ip => ip.requests30d > 1);
      expect(multipleRequestIPs.length).toBeGreaterThanOrEqual(0);
      
      // The sample data shows all requests from same server IP (172.16.6.142)
      // This is normal for nginx logs that log the server IP, not client IP
      const topIP = results.topIPs[0];
      expect(topIP.requests30d).toBe(121); // Should match total requests
    });
  });

  describe('Date Analysis', () => {
    beforeEach(async () => {
      await analyzer.loadLogFile(testLogPath, 'scott.willeke.com');
    });

    it('should identify most active day correctly', async () => {
      const results = await analyzer.analyze();
      
      expect(results.summary.mostActiveDay).toBeDefined();
      expect(results.summary.mostActiveDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      // Should be one of the dates in our sample data
      expect(['2025-09-06', '2025-09-07']).toContain(results.summary.mostActiveDay);
    });
  });

  describe('Data Consistency', () => {
    beforeEach(async () => {
      await analyzer.loadLogFile(testLogPath, 'scott.willeke.com');
    });

    it('should have consistent metrics across different analyses', async () => {
      const results = await analyzer.analyze({
        pageLimit: 1000,     // Increase limits to capture all data
        userAgentLimit: 1000
      });
      
      // Total requests should be consistent
      const userAgentRequestsSum = results.userAgents.reduce((sum, ua) => sum + ua.requests30d, 0);
      const bandwidthRequestsSum = results.bandwidth.reduce((sum, bw) => sum + bw.totalRequests, 0);
      
      expect(userAgentRequestsSum).toBe(results.summary.totalRequests);
      expect(bandwidthRequestsSum).toBe(results.summary.totalRequests);
      
      // Page requests might be less due to default limit, but should be <= total
      const pageRequestsSum = results.pages.reduce((sum, page) => sum + page.requests30d, 0);
      expect(pageRequestsSum).toBeLessThanOrEqual(results.summary.totalRequests);
      
      // Bot percentage should match bot vs non-bot counts
      const botRequests = results.userAgents.filter(ua => ua.isBot).reduce((sum, ua) => sum + ua.requests30d, 0);
      const expectedBotPercentage = Math.round((botRequests / results.summary.totalRequests) * 100);
      expect(results.summary.botTrafficPercentage).toBe(expectedBotPercentage);
    });
  });

  describe('Clear Data Functionality', () => {
    it('should clear all data including hosts', async () => {
      // Load data
      await analyzer.loadLogFile(testLogPath, 'scott.willeke.com');
      await analyzer.loadLogFile(testLogPath, 'example.com');
      
      // Verify data exists
      let hosts = analyzer.getAllHosts();
      let results = await analyzer.analyze();
      expect(hosts.length).toBe(2);
      expect(results.summary.totalRequests).toBeGreaterThan(0);
      
      // Clear data
      analyzer.clearData();
      
      // Verify data is cleared
      hosts = analyzer.getAllHosts();
      results = await analyzer.analyze();
      expect(hosts.length).toBe(0);
      expect(results.summary.totalRequests).toBe(0);
      expect(results.pages.length).toBe(0);
      expect(results.userAgents.length).toBe(0);
    });
  });
});
