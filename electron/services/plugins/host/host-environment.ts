/**
 * Environment handed to a plugin host process. The main process keeps the
 * rest (KUBECONFIG, cloud credentials, tokens): a plugin talks to the
 * cluster through its PluginContext, never on its own.
 */

const HOST_ENV_KEYS = [
  'PATH',
  'Path',
  'HOME',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'TEMP',
  'TMP',
  'TMPDIR',
  'SystemRoot',
  'SystemDrive',
  'LANG',
  'LC_ALL',
  'TZ',
  'NODE_ENV',
] as const;

export function hostEnvironment(
  source: NodeJS.ProcessEnv = process.env
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of HOST_ENV_KEYS) {
    const value = source[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}
