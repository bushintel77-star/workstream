// Convert manifest.yaml to manifest.json
// Simple parser for this specific YAML structure
const fs = require('fs');
const yaml = fs.readFileSync('.pipeline/dock/manifest.yaml', 'utf8');
const lines = yaml.split('\n');
const result = { items: [], stale: [] };
let section = null;
let currentItem = null;
let inSaddle = false;
let inFiles = false;
let inDependsOn = false;
let inBlocks = false;
let inStale = false;
let currentStale = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;

  if (trimmed === 'items:') { section = 'items'; continue; }
  if (trimmed === 'stale:') { section = 'stale'; inStale = true; continue; }

  if (section === 'items' && trimmed.startsWith('- id:')) {
    if (currentItem) result.items.push(currentItem);
    currentItem = { depends_on: [], blocks: [], files: [], saddle: {} };
    inSaddle = false; inFiles = false; inDependsOn = false; inBlocks = false;
    currentItem.id = trimmed.substring(4).trim().replace(/^:\s*/, '');
    continue;
  }

  if (section === 'stale' && trimmed.startsWith('- stash:')) {
    if (currentStale) result.stale.push(currentStale);
    currentStale = {};
    currentStale.stash = trimmed.substring(7).trim();
    continue;
  }

  if (currentItem && !inSaddle && !inFiles && !inDependsOn && !inBlocks) {
    if (trimmed.startsWith('title:')) currentItem.title = trimmed.substring(6).trim().replace(/^"|"$/g, '');
    else if (trimmed.startsWith('spec:')) currentItem.spec = trimmed.substring(5).trim().replace(/^"|"$/g, '');
    else if (trimmed.startsWith('stage:')) currentItem.stage = trimmed.substring(6).trim();
    else if (trimmed.startsWith('location:')) currentItem.location = trimmed.substring(9).trim();
    else if (trimmed.startsWith('patch:')) currentItem.patch = trimmed.substring(6).trim();
    else if (trimmed.startsWith('hash:')) currentItem.hash = trimmed.substring(5).trim();
    else if (trimmed.startsWith('relevance:')) currentItem.relevance = trimmed.substring(10).trim();
    else if (trimmed.startsWith('main_commit:')) currentItem.main_commit = trimmed.substring(12).trim();
    else if (trimmed.startsWith('saddle:')) { inSaddle = true; continue; }
    else if (trimmed.startsWith('files:')) { inFiles = true; continue; }
    else if (trimmed.startsWith('depends_on:')) {
      if (trimmed === 'depends_on: []') continue;
      inDependsOn = true; continue;
    }
    else if (trimmed.startsWith('blocks:')) {
      if (trimmed === 'blocks: []') continue;
      inBlocks = true; continue;
    }
  }

  if (inSaddle && currentItem) {
    if (trimmed.startsWith('direction:')) currentItem.saddle.direction = trimmed.substring(9).trim().replace(/^"|"$/g, '');
    else if (trimmed.startsWith('next_action:')) currentItem.saddle.next_action = trimmed.substring(12).trim().replace(/^"|"$/g, '');
    else if (trimmed.startsWith('context:')) currentItem.saddle.context = trimmed.substring(8).trim().replace(/^"|"$/g, '');
    else if (!line.startsWith('      ')) { inSaddle = false; i--; continue; }
  }

  if (inFiles && currentItem) {
    if (trimmed.startsWith('- ')) currentItem.files.push(trimmed.substring(2).trim());
    else { inFiles = false; i--; continue; }
  }

  if (inDependsOn && currentItem) {
    if (trimmed.startsWith('- ')) currentItem.depends_on.push(trimmed.substring(2).trim());
    else { inDependsOn = false; i--; continue; }
  }

  if (inBlocks && currentItem) {
    if (trimmed.startsWith('- ')) currentItem.blocks.push(trimmed.substring(2).trim());
    else { inBlocks = false; i--; continue; }
  }

  if (inStale && currentStale) {
    if (trimmed.startsWith('patch:')) currentStale.patch = trimmed.substring(6).trim();
    else if (trimmed.startsWith('hash:')) currentStale.hash = trimmed.substring(5).trim();
    else if (trimmed.startsWith('note:')) currentStale.note = trimmed.substring(5).trim().replace(/^"|"$/g, '');
  }

  if (trimmed.startsWith('schema:')) result.schema = parseInt(trimmed.substring(7));
  else if (trimmed.startsWith('updated:')) result.updated = trimmed.substring(8).trim();
  else if (trimmed.startsWith('current_branch:')) result.current_branch = trimmed.substring(15).trim();
  else if (trimmed.startsWith('main_sha:')) result.main_sha = trimmed.substring(9).trim();
  else if (trimmed.startsWith('origin_main_sha:')) result.origin_main_sha = trimmed.substring(16).trim();
  else if (trimmed.startsWith('railway_api_sha:')) result.railway_api_sha = trimmed.substring(16).trim();
  else if (trimmed.startsWith('railway_web_sha:')) result.railway_web_sha = trimmed.substring(16).trim();
}

if (currentItem) result.items.push(currentItem);
if (currentStale) result.stale.push(currentStale);
result.transitions = [];

fs.writeFileSync('.pipeline/dock/manifest.json', JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log('Converted. Items:', result.items.length, 'Stale:', result.stale.length);
