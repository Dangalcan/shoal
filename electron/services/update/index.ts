import { autoUpdater } from 'electron-updater';
import { UpdateService, type UpdaterLike } from './update-service';

/** App-wide update service backed by electron-updater's autoUpdater. */
export const updateService = new UpdateService(
  autoUpdater as unknown as UpdaterLike
);

export * from './update-service';
