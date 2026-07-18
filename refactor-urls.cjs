const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const searchString = "${import.meta.env.VITE_API_URL || 'http://localhost:5000'}";

function processFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');

    if (content.includes(searchString)) {
        // Replace all occurrences
        content = content.split(searchString).join('${API_BASE_URL}');

        // Determine relative path to src/config.js
        const fileDir = path.dirname(filepath);
        let relativePath = path.relative(fileDir, srcDir);
        if (relativePath === '') {
            relativePath = '.';
        }
        const importStatement = `import { API_BASE_URL } from '${relativePath}/config';\n`;

        // Check if import already exists
        if (!content.includes('import { API_BASE_URL }')) {
            // Find the last import statement or the beginning of the file
            const lines = content.split('\n');
            let lastImportIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim().startsWith('import ')) {
                    lastImportIndex = i;
                }
            }

            if (lastImportIndex !== -1) {
                lines.splice(lastImportIndex + 1, 0, importStatement);
            } else {
                lines.unshift(importStatement);
            }
            content = lines.join('\n');
        }

        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`Updated ${filepath}`);
    }
}

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            walk(filepath);
        } else if (filepath.endsWith('.js') || filepath.endsWith('.jsx')) {
            if (filepath !== path.join(srcDir, 'config.js')) {
                processFile(filepath);
            }
        }
    }
}

walk(srcDir);
console.log('Refactoring complete!');
