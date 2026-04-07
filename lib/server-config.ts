export type ServerConfig = {
  insightApiBase: string;
  insightProxyTimeoutMs: number;
  tbaApiBase: string;
  tbaApiKey: string;
  tbaProxyTimeoutMs: number;
};

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured on the server.`);
  }

  return value;
}

function readPositiveIntegerEnv(name: string) {
  const rawValue = readRequiredEnv(name);
  const value = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

export function getServerConfig(): ServerConfig {
  return {
    insightApiBase: readRequiredEnv('INSIGHT_API_BASE'),
    insightProxyTimeoutMs: readPositiveIntegerEnv('INSIGHT_PROXY_TIMEOUT_MS'),
    tbaApiBase: readRequiredEnv('TBA_API_BASE'),
    tbaApiKey: readRequiredEnv('TBA_API_KEY'),
    tbaProxyTimeoutMs: readPositiveIntegerEnv('TBA_PROXY_TIMEOUT_MS'),
  };
}
