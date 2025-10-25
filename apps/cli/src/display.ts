import Table from 'cli-table3';
import chalk from 'chalk';
import bytes from 'bytes';
import { AnalysisResults, getOrganizationsForIPs } from '@website-log-insights/log-analyzer';

const MAX_PATH_COLUMN_WIDTH = 120;

export async function displayResults(results: AnalysisResults): Promise<void> {
  console.log('\n' + chalk.bold.blue('📊 WEBSITE LOG ANALYSIS RESULTS') + '\n');

  // Summary Section
  displaySummary(results.summary);

  // User Agents Section
  displayUserAgents(results.userAgents);

  // Popular Pages Section
  displayPopularPages(results.pages);

  // Top Referrers Section
  displayReferrers(results.referrers);

  // Top 404s Section
  displayErrors(results.errors);

  // Top IPs Section
  await displayTopIPs(results.topIPs);

  // Bandwidth Analysis Section
  displayBandwidth(results.bandwidth);
}

function displaySummary(summary: AnalysisResults['summary']): void {
  console.log(chalk.bold.yellow('🔍 SUMMARY STATISTICS'));
  console.log('═'.repeat(50));
  
  const summaryTable = new Table({
    style: { head: ['cyan'] },
    colWidths: [25, 25]
  });
  
  summaryTable.push(
    ['Total Requests', summary.totalRequests.toLocaleString()],
    ['Unique IPs', summary.totalUniqueIPs.toLocaleString()],
    ['Total Bandwidth', bytes(summary.totalBandwidth)],
    ['Avg Response Size', bytes(summary.avgResponseSize)],
    ['Bot Traffic %', `${summary.botTrafficPercentage}%`],
    ['Most Active Day', summary.mostActiveDay]
  );
  
  console.log(summaryTable.toString());
  
  // Status codes breakdown
  if (summary.topStatusCodes.length > 0) {
    console.log(chalk.bold.cyan('\n📈 Top Status Codes:'));
    summary.topStatusCodes.forEach(({ code, count }) => {
      const percentage = ((count / summary.totalRequests) * 100).toFixed(1);
      const color = code >= 400 ? 'red' : code >= 300 ? 'yellow' : 'green';
      console.log(chalk[color](`  ${code}: ${count.toLocaleString()} (${percentage}%)`));
    });
  }
  
  console.log('\n');
}

function displayUserAgents(userAgents: AnalysisResults['userAgents']): void {
  if (userAgents.length === 0) return;
  const USER_AGENT_COLUMN_WIDTH = 100;
  const USER_AGENT_MAX_CHAR_COUNT = USER_AGENT_COLUMN_WIDTH * 2;
  
  console.log(chalk.bold.yellow('🤖 TOP USER AGENTS'));
  console.log('═'.repeat(80));
  
  const table = new Table({
    head: [
      chalk.cyan('User Agent'),
      chalk.cyan('1d'),
      chalk.cyan('7d'),
      chalk.cyan('30d'),
      chalk.cyan('Type')
    ],
    colWidths: [USER_AGENT_COLUMN_WIDTH, 8, 8, 8, 8],
    wordWrap: true
  });
  
  userAgents.slice(0, 20).forEach(ua => {
    const userAgentDisplay = ua.userAgent.length > USER_AGENT_MAX_CHAR_COUNT ? 
      ua.userAgent.substring(0, USER_AGENT_MAX_CHAR_COUNT) + '...' : ua.userAgent;
    
    const typeDisplay = ua.isBot ? chalk.red('Bot') : chalk.green('User');
    
    table.push([
      userAgentDisplay,
      ua.requests1d.toLocaleString(),
      ua.requests7d.toLocaleString(),
      ua.requests30d.toLocaleString(),
      typeDisplay
    ]);
  });
  
  console.log(table.toString());
  console.log('\n');
}

function displayPopularPages(pages: AnalysisResults['pages']): void {
  if (pages.length === 0) return;
  
  console.log(chalk.bold.yellow('📄 MOST POPULAR PAGES'));
  console.log('═'.repeat(80));
  
  // Calculate optimal URL column width
  const maxUrlLength = Math.min(MAX_PATH_COLUMN_WIDTH, Math.max(40, 
    pages.slice(0, 20).reduce((max, page) => Math.max(max, page.url.length), 0)
  ));
  
  const table = new Table({
    head: [
      chalk.cyan('URL'),
      chalk.cyan('Total (30d)'),
      chalk.cyan('Unique IPs'),
      chalk.cyan('Bot Requests'),
      chalk.cyan('Human Requests')
    ],
    colWidths: [maxUrlLength, 12, 12, 12, 12],
    wordWrap: true
  });
  
  pages.slice(0, 20).forEach(page => {
    const urlDisplay = page.url.length > maxUrlLength - 3 ? 
      page.url.substring(0, maxUrlLength - 3) + '...' : page.url;
    
    table.push([
      urlDisplay,
      page.requests30d.toLocaleString(),
      page.uniqueIPs30d.toLocaleString(),
      page.botRequests30d.toLocaleString(),
      page.nonBotRequests30d.toLocaleString()
    ]);
  });
  
  console.log(table.toString());
  
  // Show time breakdown for top 5 pages
  console.log(chalk.bold.cyan('\n⏰ Time Breakdown (Top 5 Pages):'));
  const timeMaxUrlLength = Math.min(MAX_PATH_COLUMN_WIDTH, Math.max(40, 
    pages.slice(0, 5).reduce((max, page) => Math.max(max, page.url.length), 0)
  ));
  
  const timeTable = new Table({
    head: [
      chalk.cyan('URL'),
      chalk.cyan('1d'),
      chalk.cyan('7d'),
      chalk.cyan('30d')
    ],
    colWidths: [timeMaxUrlLength, 10, 10, 10],
    wordWrap: true
  });
  
  pages.slice(0, 5).forEach(page => {
    const urlDisplay = page.url.length > timeMaxUrlLength - 3 ? 
      page.url.substring(0, timeMaxUrlLength - 3) + '...' : page.url;
    
    timeTable.push([
      urlDisplay,
      page.requests1d.toLocaleString(),
      page.requests7d.toLocaleString(),
      page.requests30d.toLocaleString()
    ]);
  });
  
  console.log(timeTable.toString());
  console.log('\n');
}

function displayReferrers(referrers: AnalysisResults['referrers']): void {
  if (referrers.length === 0) return;
  
  console.log(chalk.bold.yellow('🔗 TOP REFERRERS'));
  console.log('═'.repeat(80));
  
  // Calculate optimal referrer column width
  const maxReferrerLength = Math.min(MAX_PATH_COLUMN_WIDTH, Math.max(50, 
    referrers.reduce((max, ref) => Math.max(max, ref.referrer.length), 0)
  ));
  
  const table = new Table({
    head: [
      chalk.cyan('Referrer'),
      chalk.cyan('1d'),
      chalk.cyan('7d'),
      chalk.cyan('30d')
    ],
    colWidths: [maxReferrerLength, 10, 10, 10],
    wordWrap: true
  });
  
  referrers.slice(0, 15).forEach(ref => {
    const referrerDisplay = ref.referrer.length > maxReferrerLength - 3 ? 
      ref.referrer.substring(0, maxReferrerLength - 3) + '...' : ref.referrer;
    
    table.push([
      referrerDisplay,
      ref.requests1d.toLocaleString(),
      ref.requests7d.toLocaleString(),
      ref.requests30d.toLocaleString()
    ]);
  });
  
  console.log(table.toString());
  console.log('\n');
}

function displayErrors(errors: AnalysisResults['errors']): void {
  if (errors.length === 0) return;
  
  console.log(chalk.bold.yellow('❌ TOP 404s AND ERRORS'));
  console.log('═'.repeat(80));
  
  // Calculate optimal URL column width (use 80 as minimum for errors to avoid truncation)
  const maxErrorUrlLength = Math.min(MAX_PATH_COLUMN_WIDTH, Math.max(80, 
    errors.reduce((max, error) => Math.max(max, error.url.length), 0)
  ));
  
  const table = new Table({
    head: [
      chalk.cyan('URL'),
      chalk.cyan('Status'),
      chalk.cyan('1d'),
      chalk.cyan('7d'),
      chalk.cyan('30d')
    ],
    colWidths: [maxErrorUrlLength, 8, 8, 8, 8],
    wordWrap: true
  });
  
  errors.slice(0, 20).forEach(error => {
    const urlDisplay = error.url.length > maxErrorUrlLength - 3 ? 
      error.url.substring(0, maxErrorUrlLength - 3) + '...' : error.url;
    
    const statusColor = error.statusCode >= 500 ? 'red' : 
                       error.statusCode >= 400 ? 'yellow' : 'cyan';
    
    table.push([
      urlDisplay,
      chalk[statusColor](error.statusCode.toString()),
      error.requests1d.toLocaleString(),
      error.requests7d.toLocaleString(),
      error.requests30d.toLocaleString()
    ]);
  });
  
  console.log(table.toString());
  console.log('\n');
}

async function displayTopIPs(topIPs: AnalysisResults['topIPs']): Promise<void> {
  if (topIPs.length === 0) return;

  console.log(chalk.bold.yellow('🌐 TOP IP ADDRESSES'));
  console.log('═'.repeat(60));

  // Fetch WHOIS data for all IPs
  const ips = topIPs.slice(0, 15).map(ip => ip.ip);
  console.log(chalk.gray('Looking up WHOIS data for IP addresses...'));
  const organizations = await getOrganizationsForIPs(ips);

  const table = new Table({
    head: [
      chalk.cyan('IP Address'),
      chalk.cyan('1d'),
      chalk.cyan('7d'),
      chalk.cyan('30d'),
      chalk.cyan('Type')
    ],
    colWidths: [50, 8, 8, 8, 8],
    wordWrap: true
  });

  topIPs.slice(0, 15).forEach(ip => {
    const typeDisplay = ip.isBot ? chalk.red('Bot') : chalk.green('User');
    const org = organizations.get(ip.ip);
    const ipDisplay = org ? `${ip.ip} (${org})` : ip.ip;

    table.push([
      ipDisplay,
      ip.requests1d.toLocaleString(),
      ip.requests7d.toLocaleString(),
      ip.requests30d.toLocaleString(),
      typeDisplay
    ]);
  });

  console.log(table.toString());
  console.log('\n');
}

function displayBandwidth(bandwidth: AnalysisResults['bandwidth']): void {
  if (bandwidth.length === 0) return;
  
  console.log(chalk.bold.yellow('📊 DAILY BANDWIDTH USAGE (Last 10 Days)'));
  console.log('═'.repeat(70));
  
  const table = new Table({
    head: [
      chalk.cyan('Date'),
      chalk.cyan('Total Requests'),
      chalk.cyan('Bandwidth'),
      chalk.cyan('Avg Response')
    ],
    colWidths: [12, 15, 15, 15]
  });
  
  bandwidth.slice(0, 10).forEach(day => {
    table.push([
      day.date,
      day.totalRequests.toLocaleString(),
      bytes(day.totalBytes),
      bytes(day.averageResponseSize)
    ]);
  });
  
  console.log(table.toString());
  console.log('\n');
}
