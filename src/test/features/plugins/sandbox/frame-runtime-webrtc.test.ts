import { describe, it, expect, afterEach, vi } from 'vitest';

/**
 * The CSP of a plugin frame has no directive for WebRTC, so the frame runtime
 * removes its constructors before any plugin code can run. The e2e escape test
 * checks the same thing in a real frame, where these globals exist.
 */

const WEBRTC_GLOBALS = [
  'RTCPeerConnection',
  'webkitRTCPeerConnection',
  'RTCDataChannel',
];

const globals = window as unknown as Record<string, unknown>;

describe('frame-runtime and WebRTC', () => {
  afterEach(() => {
    for (const name of WEBRTC_GLOBALS) delete globals[name];
    vi.resetModules();
  });

  it('removes the WebRTC constructors as soon as it loads', async () => {
    for (const name of WEBRTC_GLOBALS) globals[name] = class {};

    await import('../../../../features/plugins/sandbox/frame-runtime');

    for (const name of WEBRTC_GLOBALS) expect(name in window).toBe(false);
  });

  it('leaves the other globals alone', async () => {
    await import('../../../../features/plugins/sandbox/frame-runtime');

    expect(typeof window.addEventListener).toBe('function');
    expect(typeof window.MessageChannel).toBe('function');
  });
});
