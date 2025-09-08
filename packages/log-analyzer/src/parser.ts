import { LogEntry } from './types.js';

const NGINX_LOG_REGEX = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) ([^"]*) (\S+)" (\d+) (\d+|-) "([^"]*)" "([^"]*)"(?:\s+"([^"]*)")?/;

export function parseLogLine(line: string): LogEntry | null {
  const trimmedLine = line.trim();
  if (!trimmedLine) {
    return null;
  }

  const match = trimmedLine.match(NGINX_LOG_REGEX);
  if (!match) {
    console.warn(`Failed to parse log line: ${line}`);
    return null;
  }

  const [
    ,
    ip,
    timestampStr,
    method,
    url,
    protocol,
    statusCodeStr,
    responseSizeStr,
    referrer,
    userAgent,
    forwardedFor
  ] = match;

  // Parse timestamp (format: 06/Sep/2025:11:01:23 -0700)
  const timestamp = parseNginxTimestamp(timestampStr);
  if (!timestamp) {
    console.warn(`Failed to parse timestamp: ${timestampStr}`);
    return null;
  }

  // Parse numeric values
  const statusCode = parseInt(statusCodeStr, 10);
  const responseSize = responseSizeStr === '-' ? 0 : parseInt(responseSizeStr, 10);

  if (isNaN(statusCode) || isNaN(responseSize)) {
    console.warn(`Failed to parse numeric values: status=${statusCodeStr}, size=${responseSizeStr}`);
    return null;
  }

  return {
    ip,
    timestamp,
    method,
    url,
    protocol,
    statusCode,
    responseSize,
    referrer: referrer === '-' ? '' : referrer,
    userAgent,
    forwardedFor: forwardedFor || undefined
  };
}

function parseNginxTimestamp(timestampStr: string): Date | null {
  // Format: 06/Sep/2025:11:01:23 -0700
  const timestampRegex = /^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/;
  const match = timestampStr.match(timestampRegex);
  
  if (!match) {
    return null;
  }

  const [, day, monthStr, year, hour, minute, second, timezone] = match;
  
  // Convert month name to number
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
  };
  
  const month = months[monthStr];
  if (month === undefined) {
    return null;
  }

  // Parse timezone offset
  const timezoneMatch = timezone.match(/([+-])(\d{2})(\d{2})/);
  if (!timezoneMatch) {
    return null;
  }
  
  const [, sign, offsetHours, offsetMinutes] = timezoneMatch;
  const offsetMilliseconds = (
    (parseInt(offsetHours, 10) * 60 + parseInt(offsetMinutes, 10)) * 60 * 1000
  ) * (sign === '+' ? -1 : 1); // Negative because we need to convert TO UTC

  // Create date in the original timezone and convert to UTC
  const date = new Date(
    parseInt(year, 10),
    month,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10),
    parseInt(second, 10)
  );
  
  return new Date(date.getTime() + offsetMilliseconds);
}

export function isBot(userAgent: string): boolean {
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /googlebot/i,
    /bingbot/i,
    /slurp/i,
    /duckduckbot/i,
    /baiduspider/i,
    /yandexbot/i,
    /facebookexternalhit/i,
    /twitterbot/i,
    /linkedinbot/i,
    /whatsapp/i,
    /telegrambot/i,
    /curl/i,
    /wget/i,
    /python-requests/i,
    /go-http-client/i,
    /java/i,
    /apache-httpclient/i,
    /okhttp/i,
    /postman/i,
    /zapier/i,
    /monitor/i,
    /check/i,
    /test/i,
    /scan/i,
    /probe/i,
    /lighthouse/i,
    /pagespeed/i,
    /gtmetrix/i,
    /pingdom/i,
    /uptimerobot/i,
    /newrelic/i
  ];

  return botPatterns.some(pattern => pattern.test(userAgent));
}

export function parseLogFile(content: string): LogEntry[] {
  const lines = content.split('\n');
  const entries: LogEntry[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      continue;
    }
    
    const entry = parseLogLine(line);
    if (entry) {
      entries.push(entry);
    }
  }
  
  return entries;
}