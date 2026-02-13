#!/usr/bin/env node

/**
 * Vite Migration Script
 *
 * Automatically converts process.env to import.meta.env in all source files
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const SRC_DIR = path.join(__dirname, '..', 'frontend', 'src');

// Find all JS/JSX/TS/TSX files
const files = glob.sync(`${SRC_DIR}/**/*.{js,jsx,ts,tsx}`, {
  ignore: ['**/node_modules/**', '**/build/**', '**/dist/**']
});

console.log(`\n🔍 Found ${files.length} files to migrate\n`);

let totalReplacements = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;
  let fileReplacements = 0;

  // Replace process.env.REACT_APP_* with import.meta.env.REACT_APP_*
  const processEnvPattern = /process\.env\.(REACT_APP_[A-Z_]+)/g;
  const matches = content.match(processEnvPattern);

  if (matches) {
    const before = content;
    content = content.replace(processEnvPattern, 'import.meta.env.$1');
    fileReplacements = matches.length;
    modified = true;
  }

  // Replace process.env.NODE_ENV with import.meta.env.MODE
  if (content.includes('process.env.NODE_ENV')) {
    content = content.replace(/process\.env\.NODE_ENV/g, 'import.meta.env.MODE');
    fileReplacements++;
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`✅ ${path.relative(process.cwd(), file)}: ${fileReplacements} replacements`);
    totalReplacements += fileReplacements;
  }
});

console.log(`\n✨ Migration complete! ${totalReplacements} replacements in ${files.length} files\n`);
console.log('Next steps:');
console.log('1. Update package.json scripts to use Vite');
console.log('2. Test dev server: npm run dev');
console.log('3. Test build: npm run build');
console.log('4. Run E2E tests: npm run e2e\n');
