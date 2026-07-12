/**
 * Port Forward Service
 *
 * Manages long-running `kubectl port-forward` child processes. Each
 * forward is a session identified by a UUID; sessions die with the app
 * (stopAll on quit) or when the user stops them.
 *
 * kubectl is spawned directly (no shell) with a validated argument
 * array, mirroring the safe-exec rules for long-running processes.
 */

import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import {
  assertContext,
  assertNamespace,
  assertResourceName,
} from '../../utils/k8s-validate';
import log from '../../logger';

export type ForwardResourceType = 'pod' | 'service';

export interface PortForwardArgs {
  contextName: string;
  namespace: string;
  resourceType: ForwardResourceType;
  resourceName: string;
  localPort: number;
  remotePort: number;
}

export interface PortForwardInfo extends PortForwardArgs {
  id: string;
  startedAt: string;
}

/** Called when a running forward dies on its own (not via stopForward). */
export type ForwardClosedCallback = (
  info: PortForwardInfo,
  error?: string
) => void;

interface Session {
  info: PortForwardInfo;
  process: ChildProcess;
  onClosed?: ForwardClosedCallback;
}

const READY_TIMEOUT_MS = 10_000;

function assertPort(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`Invalid ${label}: "${value}" (must be 1-65535)`);
  }
}

export class PortForwardService {
  private sessions = new Map<string, Session>();

  /**
   * Starts a port-forward and resolves once kubectl reports the tunnel
   * is listening ("Forwarding from ..."), or rejects with kubectl's
   * stderr if it dies first.
   */
  async startForward(
    args: PortForwardArgs,
    onClosed?: ForwardClosedCallback
  ): Promise<PortForwardInfo> {
    const { contextName, namespace, resourceType, resourceName } = args;
    const localPort = Number(args.localPort);
    const remotePort = Number(args.remotePort);

    assertContext(contextName);
    assertNamespace(namespace);
    assertResourceName(resourceName);
    if (resourceType !== 'pod' && resourceType !== 'service') {
      throw new Error(`Invalid resource type: "${resourceType}"`);
    }
    assertPort(localPort, 'local port');
    assertPort(remotePort, 'remote port');

    for (const session of this.sessions.values()) {
      if (session.info.localPort === localPort) {
        throw new Error(
          `Local port ${localPort} is already forwarded to ` +
            `${session.info.resourceType}/${session.info.resourceName}`
        );
      }
    }

    const id = randomUUID();
    const info: PortForwardInfo = {
      id,
      contextName,
      namespace,
      resourceType,
      resourceName,
      localPort,
      remotePort,
      startedAt: new Date().toISOString(),
    };

    const child = spawn(
      'kubectl',
      [
        'port-forward',
        `${resourceType}/${resourceName}`,
        `${localPort}:${remotePort}`,
        '-n',
        namespace,
        '--context',
        contextName,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
    );

    return new Promise<PortForwardInfo>((resolve, reject) => {
      let stderrBuf = '';
      let ready = false;

      const timeout = setTimeout(() => {
        if (!ready) {
          // Reject before kill: the exit handler's reject is a no-op once
          // the promise is settled, regardless of event ordering.
          reject(new Error('Timed out waiting for port-forward to start'));
          child.kill();
        }
      }, READY_TIMEOUT_MS);

      child.stdout!.on('data', (data: Buffer) => {
        if (!ready && data.toString('utf8').includes('Forwarding from')) {
          ready = true;
          clearTimeout(timeout);
          this.sessions.set(id, { info, process: child, onClosed });
          log.info(
            `[PortForward] Started ${id}: ${resourceType}/${resourceName} ` +
              `${localPort}:${remotePort} (ns=${namespace}, ctx=${contextName})`
          );
          resolve(info);
        }
      });

      child.stderr!.on('data', (data: Buffer) => {
        stderrBuf += data.toString('utf8');
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        if (!ready) reject(err);
      });

      child.on('exit', (code) => {
        clearTimeout(timeout);
        if (!ready) {
          reject(
            new Error(
              stderrBuf.trim() ||
                `kubectl port-forward exited with code ${code}`
            )
          );
          return;
        }
        // Died after being established (pod deleted, connection lost…)
        if (this.sessions.delete(id)) {
          log.info(`[PortForward] Session ${id} closed (code ${code})`);
          onClosed?.(info, stderrBuf.trim() || undefined);
        }
      });
    });
  }

  /** Stops a forward. Resolves false if the id is unknown. */
  stopForward(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    // Delete first so the exit handler doesn't fire onClosed for a
    // user-requested stop.
    this.sessions.delete(id);
    session.process.kill();
    log.info(`[PortForward] Stopped ${id}`);
    return true;
  }

  listForwards(): PortForwardInfo[] {
    return [...this.sessions.values()].map((s) => s.info);
  }

  /** Kills every active forward (app quit). */
  stopAll(): void {
    for (const id of [...this.sessions.keys()]) {
      this.stopForward(id);
    }
  }
}

export const portForwardService = new PortForwardService();
