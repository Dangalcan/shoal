/**
 * Log Streaming IPC Handlers
 *
 * Follow mode of the log viewer: `logs:stream-start` runs `kubectl logs -f`
 * through the log stream service and pushes its lines to the window that
 * asked, as `logs:stream-lines` events, until `logs:stream-stop`. A stream
 * that stops on its own (pod deleted, container stopped, kubectl failed)
 * sends `logs:stream-ended` with the reason.
 *
 * Events go to the main frame only (plugin frames never see them), and a
 * window's streams stop when it reloads, crashes or closes, so a reloaded
 * renderer cannot leave kubectl processes behind.
 */

import { app, ipcMain } from 'electron';
import type { WebContents } from 'electron';
import { wrapIpcHandler } from './ipc-utils';
import {
  logStreamService,
  LogStreamArgs,
} from '../services/logs/log-stream-service';
import log from '../logger';

/** Windows whose reload/crash/close already stops their streams. */
const watchedSenders = new WeakSet<WebContents>();

function stopStreamsOnUnload(sender: WebContents): void {
  if (watchedSenders.has(sender)) return;
  watchedSenders.add(sender);
  const ownerId = sender.id;
  const stopOwned = (why: string) => {
    const stopped = logStreamService.stopOwnedBy(ownerId);
    if (stopped > 0) log.info(`[LogStream] ${why}: stopped ${stopped}`);
  };
  // A reload starts a new main-frame document; hash-route changes are
  // same-document navigations and keep the stream.
  sender.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument) stopOwned('Reload');
  });
  sender.on('render-process-gone', () => stopOwned('Renderer gone'));
  sender.once('destroyed', () => stopOwned('Window closed'));
}

/** Sends to the main frame only. False when the window is gone. */
function sendToMainFrame(
  sender: WebContents,
  channel: string,
  payload: unknown
): boolean {
  if (sender.isDestroyed()) return false;
  try {
    sender.mainFrame.send(channel, payload);
    return true;
  } catch {
    return false;
  }
}

export function registerLogsIpcHandlers(): void {
  ipcMain.handle(
    'logs:stream-start',
    wrapIpcHandler('logs:stream-start', async (event, args: LogStreamArgs) => {
      // Input validation (context/pod/namespace/container) lives in the
      // service, before kubectl is spawned.
      const sender = event.sender;
      stopStreamsOnUnload(sender);
      const { streamId } = logStreamService.start(
        args,
        {
          onLines: (lines) => {
            const sent = sendToMainFrame(sender, 'logs:stream-lines', {
              streamId,
              lines,
            });
            if (!sent) logStreamService.stop(streamId);
          },
          onEnded: (end) => {
            sendToMainFrame(sender, 'logs:stream-ended', { streamId, ...end });
          },
        },
        sender.id
      );
      return { streamId };
    })
  );

  ipcMain.handle(
    'logs:stream-stop',
    wrapIpcHandler(
      'logs:stream-stop',
      async (_event, { streamId }: { streamId: string }) => {
        if (typeof streamId !== 'string') {
          throw new Error('A stream id is required');
        }
        return logStreamService.stop(streamId);
      }
    )
  );

  // kubectl processes are plain children: without this they outlive the app.
  app.on('will-quit', () => {
    logStreamService.stopAll();
  });
}
