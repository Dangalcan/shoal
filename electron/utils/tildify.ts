import os from 'os';

/**
 * Shows the home folder as `~`: paths end up in the About card, in the
 * prefilled GitHub issue and in main.log, and the OS user name is nobody's
 * business.
 */
export function tildify(filePath: string, home = os.homedir()): string {
  if (!home || !filePath.startsWith(home)) return filePath;
  const rest = filePath.slice(home.length);
  return rest === '' || rest.startsWith('/') || rest.startsWith('\\')
    ? `~${rest}`
    : filePath;
}
