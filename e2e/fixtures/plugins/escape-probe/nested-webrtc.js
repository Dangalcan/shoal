/**
 * Escape Probe: runs inside a frame nested in the plugin frame, and tells the
 * plugin page whether that realm still has WebRTC.
 */
window.parent.postMessage(
  {
    nestedWebrtc:
      typeof RTCPeerConnection === 'undefined' &&
      typeof webkitRTCPeerConnection === 'undefined'
        ? 'blocked'
        : 'open',
  },
  '*'
);
