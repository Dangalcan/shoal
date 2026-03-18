import { exec } from 'child_process';
import util from 'util';

/** Promisified version of `child_process.exec`, shared across the main process. */
export const execPromise = util.promisify(exec);
