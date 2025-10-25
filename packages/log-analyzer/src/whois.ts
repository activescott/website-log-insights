import { whoisIp } from 'whoiser';

type WhoisData = Awaited<ReturnType<typeof whoisIp>>;

interface WhoisCache {
  [ip: string]: string;
}

const cache: WhoisCache = {};

/**
 * Extracts organization name from WHOIS data
 */
function extractOrganization(data: WhoisData): string {
  
  // Try different common fields for organization
  const orgField =
    data['OrgName'] ||
    data['org-name'] ||
    data['organization'] ||
    data['Organization'] ||
    data['descr'] ||
    data['netname'] ||
    '';
  if (!orgField) {
    console.warn('no org found. WHOIS data:', data);
  }
  // If it's an array, take the first element
  if (Array.isArray(orgField)) {
    return orgField[0] || '';
  }

  // Otherwise convert to string
  return String(orgField).trim();
}

/**
 * Looks up the organization name for an IP address using WHOIS
 * Returns cached results when available to avoid repeated lookups
 */
export async function getOrganizationForIP(ip: string): Promise<string> {
  // Check cache first
  if (cache[ip]) {
    return cache[ip];
  }

  try {
    const result: WhoisData = await whoisIp(ip);

    // Extract organization from the WHOIS data
    const organization = extractOrganization(result);

    // Cache the result (even if empty to avoid repeated failed lookups)
    cache[ip] = organization;

    return organization;
  } catch (error) {
    console.warn(`Failed to lookup WHOIS for ${ip}:`, error instanceof Error ? error.message : 'Unknown error');
    // Cache empty result to avoid repeated failures
    cache[ip] = '';
    return '';
  }
}

/**
 * Looks up organizations for multiple IPs in parallel
 */
export async function getOrganizationsForIPs(ips: string[]): Promise<Map<string, string>> {
  const results = await Promise.all(
    ips.map(async (ip) => {
      const org = await getOrganizationForIP(ip);
      return { ip, org };
    })
  );

  return new Map(results.map(r => [r.ip, r.org]));
}
