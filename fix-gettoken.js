const fs = require('fs');
const path = require('path');

const files = [
  'frontend/src/components/MyCardPage.tsx',
  'frontend/src/hooks/useInspectionReport.js',
  'frontend/src/hooks/useSessionVoice.js',
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove getToken import if still there
    content = content.replace(/,\s*getToken/g, '');
    content = content.replace(/getToken\s*,/g, '');

    // Replace Authorization header with credentials
    content = content.replace(/headers:\s*\{\s*Authorization:\s*`Bearer\s*\$\{getToken\(\)\}`\s*\}/g, 'credentials: \'include\'');
    content = content.replace(/Authorization:\s*`Bearer\s*\$\{getToken\(\)\}`,/g, 'credentials: \'include\',');

    // For cases where headers object has other properties
    content = content.replace(/Authorization:\s*`Bearer\s*\$\{getToken\(\)\}`/g, '// Auth via httpOnly cookie');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${file}`);
  }
});

console.log('All files fixed!');
