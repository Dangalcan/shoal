import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import {
  PortForwardService,
  PortForwardArgs,
} from '../services/portforward/portforward-service';

vi.mock('../logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('child_process', () => {
  const spawn = vi.fn();
  return { spawn, default: { spawn } };
});

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  pid = 4321;
  kill = vi.fn(() => {
    this.emit('exit', 0);
    return true;
  });
}

const validArgs: PortForwardArgs = {
  contextName: 'kind-test',
  namespace: 'default',
  resourceType: 'pod',
  resourceName: 'my-pod',
  localPort: 8080,
  remotePort: 80,
};

function startAndReady(
  service: PortForwardService,
  args: PortForwardArgs = validArgs,
  onClosed?: (info: unknown, error?: string) => void
) {
  const child = new FakeChild();
  vi.mocked(spawn).mockReturnValueOnce(
    child as unknown as ReturnType<typeof spawn>
  );
  const promise = service.startForward(args, onClosed);
  child.stdout.emit(
    'data',
    Buffer.from(
      `Forwarding from 127.0.0.1:${args.localPort} -> ${args.remotePort}\n`
    )
  );
  return { child, promise };
}

describe('PortForwardService', () => {
  let service: PortForwardService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PortForwardService();
  });

  it('spawns kubectl port-forward with validated args and resolves when ready', async () => {
    const { promise } = startAndReady(service);
    const info = await promise;

    expect(spawn).toHaveBeenCalledWith(
      'kubectl',
      [
        'port-forward',
        'pod/my-pod',
        '8080:80',
        '-n',
        'default',
        '--context',
        'kind-test',
      ],
      expect.objectContaining({ windowsHide: true })
    );
    expect(info.id).toBeTruthy();
    expect(info.localPort).toBe(8080);
    expect(service.listForwards()).toEqual([info]);
  });

  it('rejects with stderr output when kubectl dies before ready', async () => {
    const child = new FakeChild();
    vi.mocked(spawn).mockReturnValueOnce(
      child as unknown as ReturnType<typeof spawn>
    );
    const promise = service.startForward(validArgs);
    child.stderr.emit('data', Buffer.from('error: pods "my-pod" not found\n'));
    child.emit('exit', 1);

    await expect(promise).rejects.toThrow('pods "my-pod" not found');
    expect(service.listForwards()).toEqual([]);
  });

  it('rejects after the readiness timeout', async () => {
    vi.useFakeTimers();
    try {
      const child = new FakeChild();
      vi.mocked(spawn).mockReturnValueOnce(
        child as unknown as ReturnType<typeof spawn>
      );
      const promise = service.startForward(validArgs);
      const assertion = expect(promise).rejects.toThrow(
        'Timed out waiting for port-forward to start'
      );
      await vi.advanceTimersByTimeAsync(10_000);
      await assertion;
      expect(child.kill).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    [
      { ...validArgs, resourceType: 'deployment' as 'pod' },
      /Invalid resource type/,
    ],
    [
      { ...validArgs, resourceName: '--kubeconfig=/evil' },
      /Invalid resource name/,
    ],
    [{ ...validArgs, namespace: 'Bad_NS' }, /Invalid namespace/],
    [{ ...validArgs, contextName: 'ctx;rm' }, /Invalid context name/],
    [{ ...validArgs, localPort: 0 }, /Invalid local port/],
    [{ ...validArgs, remotePort: 70000 }, /Invalid remote port/],
    [{ ...validArgs, localPort: 8.5 }, /Invalid local port/],
  ])('rejects invalid args without spawning: %o', async (args, error) => {
    await expect(service.startForward(args)).rejects.toThrow(error);
    expect(spawn).not.toHaveBeenCalled();
  });

  it('rejects a local port that is already forwarded', async () => {
    await startAndReady(service).promise;

    await expect(
      service.startForward({ ...validArgs, remotePort: 443 })
    ).rejects.toThrow('Local port 8080 is already forwarded');
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('stopForward kills the process without firing onClosed', async () => {
    const onClosed = vi.fn();
    const { child, promise } = startAndReady(service, validArgs, onClosed);
    const info = await promise;

    expect(service.stopForward(info.id)).toBe(true);
    expect(child.kill).toHaveBeenCalled();
    expect(service.listForwards()).toEqual([]);
    expect(onClosed).not.toHaveBeenCalled();
  });

  it('stopForward returns false for unknown ids', () => {
    expect(service.stopForward('nope')).toBe(false);
  });

  it('fires onClosed when an established forward dies unexpectedly', async () => {
    const onClosed = vi.fn();
    const { child, promise } = startAndReady(service, validArgs, onClosed);
    const info = await promise;

    child.stderr.emit('data', Buffer.from('lost connection to pod\n'));
    child.emit('exit', 1);

    expect(service.listForwards()).toEqual([]);
    expect(onClosed).toHaveBeenCalledWith(info, 'lost connection to pod');
  });

  it('stopAll kills every active forward', async () => {
    const first = startAndReady(service);
    await first.promise;
    const second = startAndReady(service, {
      ...validArgs,
      localPort: 9090,
      resourceType: 'service',
      resourceName: 'my-svc',
    });
    await second.promise;

    service.stopAll();

    expect(first.child.kill).toHaveBeenCalled();
    expect(second.child.kill).toHaveBeenCalled();
    expect(service.listForwards()).toEqual([]);
  });
});
