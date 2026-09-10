import fs from 'fs';
import path from 'path';
import * as Lucide from 'lucide-react';

const srcDir = path.join(process.cwd(), 'src');
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.jsx'));

let errors = [];

files.forEach(file => {
  const code = fs.readFileSync(path.join(srcDir, file), 'utf8');
  // Match import { ... } from 'lucide-react'
  const regex = /import\s*\{([\s\S]*?)\}\s*from\s*['"]lucide-react['"]/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    const rawIcons = match[1].split(',').map(s => s.trim()).filter(Boolean);
    rawIcons.forEach(item => {
      // Handle 'Image as ImageIcon' or 'Activity'
      const parts = item.split(/\s+as\s+/);
      const originalName = parts[0].trim();
      const aliasName = parts[1] ? parts[1].trim() : originalName;

      if (!Lucide[originalName]) {
        errors.push({ file, missingIcon: originalName, alias: aliasName });
      }
    });
  }
});

console.log('MISSING ICONS COUNT:', errors.length);
if (errors.length > 0) {
  console.log('MISSING ICONS:', JSON.stringify(errors, null, 2));
} else {
  console.log('ALL LUCIDE ICONS ARE 100% VALID!');
}
