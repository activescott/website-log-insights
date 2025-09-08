# Website Log Insights

A powerful TypeScript tool for analyzing nginx access logs and generating comprehensive insights about your website traffic.

## Features

- **User Agent Analysis**: Track unique user agents with bot detection over 1d, 7d, and 30d periods
- **Popular Pages**: Analyze most requested pages with bot/human traffic breakdown
- **Referrer Analysis**: Track top referrers and traffic sources
- **Error Analysis**: Monitor 404s and other HTTP errors
- **Bandwidth Usage**: Daily bandwidth consumption and response size analytics
- **IP Analysis**: Top IP addresses with bot detection
- **SQLite Caching**: Fast local database for efficient analysis of large log files

## Project Structure

```
.
├── packages/
│   └── log-analyzer/     # Core analysis library
└── apps/
    └── cli/              # Command-line interface
```

## Installation

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build
```

## Usage

### Quick Start

The easiest way to analyze your nginx logs:

```bash
# Clear database and analyze logs (recommended for fresh analysis)
pnpm clear-logs && pnpm analyze -h your-domain.com -f path/to/your-access.log

# Or run commands separately
pnpm clear-logs
pnpm analyze -h your-domain.com -f path/to/your-access.log
```

### CLI Commands

```bash
# Analyze logs for a specific hostname
pnpm analyze -h scott.willeke.com -f 2025-09-07_access.log

# Clear the database
pnpm clear-logs

# Analyze with custom database location
pnpm analyze -h example.com -f access.log -d custom-logs.db

# Interactive mode (prompts for missing parameters)
pnpm analyze
```

### Advanced Usage

```bash
# Clear database before analyzing (fresh start)
pnpm analyze -h example.com -f access.log --clear

# Analyze multiple hosts by running separate commands
pnpm analyze -h site1.com -f site1-access.log
pnpm analyze -h site2.com -f site2-access.log

# View help
pnpm analyze --help
```

### Interactive Mode

When you run the CLI without specifying required parameters (file path or hostname), it will prompt you to enter them interactively.

### Library Usage

```typescript
import { LogAnalyzer } from '@website-log-insights/log-analyzer';

const analyzer = new LogAnalyzer('./logs.db');
await analyzer.loadLogFile('/path/to/access.log', 'your-domain.com');
const results = await analyzer.analyze();

console.log('Total requests:', results.summary.totalRequests);
console.log('Top pages:', results.pages.slice(0, 5));
console.log('Tracked hosts:', analyzer.getAllHosts());

analyzer.close();
```

## Supported Log Format

The tool supports the standard nginx access log format:

```
$remote_addr - $remote_user [$time_local] "$request" $status $bytes_sent "$http_referer" "$http_user_agent" "$http_x_forwarded_for"
```

Example:
```
172.16.6.142 - - [06/Sep/2025:11:01:23 -0700] "GET /js/script.js HTTP/1.1" 200 1650 "https://example.com/" "Mozilla/5.0..." "205.169.39.128"
```

## Analysis Reports

### 1. User Agents Analysis
- Lists unique user agents ranked by 30-day request volume
- Distinguishes between bots and human users
- Shows request counts for 1d, 7d, and 30d periods

### 2. Popular Pages Analysis
- Most requested URLs with request counts and unique IP counts
- Separates bot traffic from human traffic
- Time-based breakdown (1d, 7d, 30d)

### 3. Referrer Analysis
- Top referrers sending traffic to your site
- Helps identify traffic sources and marketing effectiveness

### 4. Error Analysis (404s and others)
- Most common 404 URLs and other HTTP errors
- Helps identify broken links and missing resources

### 5. Bandwidth Analysis
- Daily bandwidth consumption
- Average response sizes
- Request volume trends

### 6. Top IP Analysis
- Most active IP addresses
- Bot detection per IP
- Geographic distribution insights

## Bot Detection

The tool automatically detects bots based on user agent patterns, including:

- Search engine crawlers (Google, Bing, Yahoo, etc.)
- Social media bots (Facebook, Twitter, LinkedIn)
- Monitoring services (Pingdom, UptimeRobot, etc.)
- Development tools (curl, wget, Postman, etc.)
- AI crawlers and scrapers

## Database

The tool uses SQLite for efficient local storage and querying:

- Automatic indexing for fast queries
- Persistent storage between runs
- Incremental data loading
- Easy backup and sharing

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run in development mode
pnpm dev

# Clean build artifacts
pnpm clean
```

## Requirements

- Node.js 18+
- pnpm 8+
- TypeScript 5+

## License

MIT