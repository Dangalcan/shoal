import { ipcMain, app } from 'electron';
import { wrapIpcHandler } from './ipc-utils';
import {
  portForwardService,
  PortForwardArgs,
} from '../services/portforward/portforward-service';

export function registerPortForwardIpcHandlers(): void {
  ipcMain.handle(
    'portforward:start',
    wrapIpcHandler(
      'portforward:start',
      async (event, args: PortForwardArgs) => {
        // Input validation (context/namespace/name/ports) lives in the
        // service so plugins reaching it directly are covered too.
        return await portForwardService.startForward(args, (info, error) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('portforward:closed', { info, error });
          }
        });
      }
    )
  );

  ipcMain.handle(
    'portforward:stop',
    wrapIpcHandler(
      'portforward:stop',
      async (_event, { id }: { id: string }) => {
        return portForwardService.stopForward(id);
      }
    )
  );

  ipcMain.handle(
    'portforward:list',
    wrapIpcHandler('portforward:list', async () =>
      portForwardService.listForwards()
    )
  );

  app.on('will-quit', () => {
    portForwardService.stopAll();
  });
}
