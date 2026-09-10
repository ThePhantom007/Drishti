import fs from 'fs';
import path from 'path';
import * as lucide from 'lucide-react';

const srcDir = path.join(process.cwd(), 'src');
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.jsx'));

let errors = [];
files.forEach(f => {
  const content = fs.readFileSync(path.join(srcDir, f), 'utf8');
  const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/);
  if (importMatch) {
    const iconNames = importMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    iconNames.forEach(icon => {
      if (!lucide[icon]) {
        errors.push({ file: f, icon });
      }
    });
  }
});

console.log('Icon errors:', JSON.stringify(errors, null, 2));
