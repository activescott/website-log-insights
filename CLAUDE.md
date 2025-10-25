# Claude Code Project Notes - Website Log Insights

## Project Structure
- **Package Manager**: Use `pnpm` (not npm) for all operations
- **Workspace Structure**:
  - `packages/log-analyzer`: Core log analysis library
  - `apps/cli`: CLI application
  - Root has `pnpm-workspace.yaml` and `pnpm-lock.yaml`

## Key Technical Details
- **Testing**: Uses Vitest for testing
- **Language**: TypeScript with ES modules (`"type": "module"`)
- **Database**: SQLite via better-sqlite3 for log storage
- **Log Format**: Nginx access logs with custom parsing

## Log Analyzer Package (`packages/log-analyzer`)
- **Main Classes**: `LogAnalyzer` (analyzer.ts), `LogDatabase` (database.ts)
- **Key Features**:
  - **Host Tracking**: All log files must be loaded with a hostname parameter
  - **Database Schema**: Includes `hosts`, `log_entries`, `file_metadata` tables
  - **Bot Detection**: Comprehensive bot pattern matching
  - **Metrics**: User agents, pages, referrers, errors, bandwidth, top IPs
  - **Time-based Analysis**: 1d, 7d, 30d rolling windows

## Host Tracking Implementation (Added in this session)
- `loadLogFile(filePath: string, hostname: string)` - hostname is required
- `getAllHosts()` - returns all tracked hosts with timestamps
- Database stores hosts with creation/update timestamps
- Foreign key relationship: `log_entries.host_id → hosts.id`

## Testing
- **Test Data**: Real nginx log sample in `test-data/sample.log` (121 entries)
- **Test Coverage**: Integration tests covering all metrics and host tracking
- **Run Tests**: `pnpm test` (uses vitest run, no watch mode)

## Development Commands
- Install dependencies: `pnpm install` (from root directory)
- Run tests: `pnpm test` (from specific package directory)
- Build: `pnpm build` or `tsc`

## Known Data Characteristics
- Sample log shows all requests from server IP 172.16.6.142 (normal for nginx logs)
- Contains legitimate traffic, bot traffic, and attack patterns (.php file requests)
- Date range: Primarily 2025-09-07, some 2025-09-06
- High bot traffic from Zapier (RSS feed polling), search engines, etc.

## Notes for Future Sessions
- Always use pnpm, not npm
- Host tracking is now implemented and tested
- Test file contains real log data that validates all functionality
- Database schema includes host foreign keys - migrations would be needed for existing data
