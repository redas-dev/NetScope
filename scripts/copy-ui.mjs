import { cpSync, existsSync, mkdirSync } from 'node:fs';
const source = new URL('../netscope.client/dist/', import.meta.url);
const target = new URL('../NetScope.Server/wwwroot/', import.meta.url);
if (!existsSync(new URL('index.html', source))) throw new Error('First run: npm run build --prefix netscope.client');
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log('React build copied to NetScope.Server/wwwroot.');
