/**
 * Escape Probe: Node entry.
 *
 * The plugin declares no permissions and does nothing on activation; the
 * interesting part is renderer.js, which runs inside the sandboxed frame and
 * tries to get out. This file exists because a plugin needs a `main`.
 */

module.exports = {
  activate: async () => {},
  deactivate: async () => {},
};
