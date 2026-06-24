const fs = require('fs');
const path = require('path');

async function run() {
  const reportsDir = path.join(__dirname, 'public', 'reports');
  const filename = 'Direct Bilirubin. Indirect Bilirubin. .doc';
  const filepath = path.join(reportsDir, filename);
  console.log('=== FILE:', filename, '===');
  try {
    const buffer = fs.readFileSync(filepath);
    const rawText = new TextDecoder('windows-1252').decode(buffer);
    
    // Extract sequences of readable characters
    const cleanText = rawText.replace(/[^\x20-\x7E\r\n\t]/g, ' ');
    console.log('CLEAN READABLE TEXT:');
    
    // Let's split by lines, trim, and print non-empty lines to see the structure
    const lines = cleanText.split(/[\r\n]+/)
      .map(l => l.replace(/\s+/g, ' ').trim())
      .filter(l => l.length > 5);
      
    lines.forEach((line, idx) => {
      console.log(`${idx}: ${line}`);
    });
  } catch (err) {
    console.error(err);
  }
}
run();
