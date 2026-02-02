import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Starting dynamic plugin generation...');

const pluginsDir = path.join(__dirname, '../plugins');
const downloadsDir = path.join(
  __dirname,
  '../marketplace-backend/public/downloads'
);

// Ensure directories exist
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

if (!fs.existsSync(pluginsDir)) {
  console.log('No plugins directory found. Creating empty one...');
  fs.mkdirSync(pluginsDir, { recursive: true });
  process.exit(0);
}

const pluginFolders = fs
  .readdirSync(pluginsDir)
  .filter((f) => fs.statSync(path.join(pluginsDir, f)).isDirectory());

const catalog: any[] = [];

pluginFolders.forEach((folder) => {
  const sourcePath = path.join(pluginsDir, folder);
  const manifestPath = path.join(sourcePath, 'plugin.json');

  if (!fs.existsSync(manifestPath)) {
    console.warn(`Skipping ${folder}: No plugin.json found.`);
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const zip = new AdmZip();

  // Add all files from the plugin folder to the ZIP
  const files = fs.readdirSync(sourcePath);
  files.forEach((file) => {
    zip.addLocalFile(path.join(sourcePath, file));
  });

  const zipName = `${manifest.id}-${manifest.version}.zip`;
  const zipPath = path.join(downloadsDir, zipName);

  zip.writeZip(zipPath);

  // Build catalog entry
  catalog.push({
    ...manifest,
    downloadUrl: `http://localhost:3001/downloads/${zipName}`,
    rating: 5.0,
    reviews: 0,
    screenshots: [],
  });

  console.log(`Successfully bundled ${manifest.name} v${manifest.version}`);
});

// Save the catalog for the backend to consume
const catalogFilePath = path.join(downloadsDir, '../catalog.json');
fs.writeFileSync(catalogFilePath, JSON.stringify(catalog, null, 2));
console.log(`Generated marketplace catalog with ${catalog.length} entries.`);
