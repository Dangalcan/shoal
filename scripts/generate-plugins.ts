import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

console.log('Starting plugin generation...');
console.log('Current __dirname:', __dirname);

const plugins = [
  {
    id: 'log-viewer-plus',
    version: '1.2.0',
    name: 'Log Viewer Plus',
    description: 'Advanced log tailing and filtering.',
    author: 'K8s Experts',
    main: 'index.js',
  },
  {
    id: 'cluster-stats-pro',
    version: '2.1.5',
    name: 'Cluster Stats Pro',
    description: 'Real-time cluster stats.',
    author: 'CloudNative Corp',
    main: 'index.js',
  },
  {
    id: 'secure-guard',
    version: '3.0.0',
    name: 'Secure Guard',
    description: 'Security scanning.',
    author: 'SecurityFirst',
    main: 'index.js',
  },
];

const downloadsDir = path.join(
  __dirname,
  '../marketplace-backend/public/downloads'
);

// Ensure downloads dir exists
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

plugins.forEach((plugin) => {
  const zip = new AdmZip();

  // Create plugin.json
  const manifest = {
    id: plugin.id,
    name: plugin.name,
    version: plugin.version,
    description: plugin.description,
    author: plugin.author,
    main: plugin.main,
    permissions: ['ui', 'notifications'],
    license: { type: 'free', spdx: 'MIT' },
  };

  zip.addFile('plugin.json', Buffer.from(JSON.stringify(manifest, null, 2)));

  // Customize index.js based on plugin ID
  let specificActions = '';

  if (plugin.id === 'log-viewer-plus') {
    specificActions = `,
  getLogs: async (args) => {
    console.log('Log Viewer request:', args);
    return [
      { time: '${new Date().toISOString()}', msg: 'App started' },
      { time: '${new Date().toISOString()}', msg: 'Connected to DB' },
      { time: '${new Date().toISOString()}', msg: 'High memory usage' }
    ];
  }`;
  } else if (plugin.id === 'cluster-stats-pro') {
    specificActions = `,
  getStats: async () => {
    return { cpu: 45, memory: 60, pods: 12 };
  }`;
  }

  // Create index.js
  const indexJs = `
module.exports = {
  activate: (context) => {
    context.logger.info('${plugin.name} v${plugin.version} ACTIVATED via Real Backend!');
    context.ui.showNotification('${plugin.name} installed successfully from local server.', 'success');
  },
  deactivate: async () => {
    console.log('${plugin.name} deactivated');
  }${specificActions}
};`;

  zip.addFile('index.js', Buffer.from(indexJs));

  const zipName = `${plugin.id}-${plugin.version}.zip`;
  const zipPath = path.join(downloadsDir, zipName);

  zip.writeZip(zipPath);
  console.log(`Generated ${zipName} at ${zipPath}`);
});
