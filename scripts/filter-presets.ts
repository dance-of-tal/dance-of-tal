import fs from 'fs';
import path from 'path';

const talsPath = path.resolve('src/data/tals.json');
const dancesPath = path.resolve('src/data/dances.json');

const tals = JSON.parse(fs.readFileSync(talsPath, 'utf8'));
const filteredTals = tals.filter((t: any) => t.category !== 'Public Case').slice(0, 5);
fs.writeFileSync(talsPath, JSON.stringify(filteredTals, null, 2), 'utf8');

const dances = JSON.parse(fs.readFileSync(dancesPath, 'utf8'));
const filteredDances = dances.filter((d: any) => d.category !== 'Public Case').slice(0, 5);
fs.writeFileSync(dancesPath, JSON.stringify(filteredDances, null, 2), 'utf8');

console.log(`Filtered tals to ${filteredTals.length} items`);
console.log(`Filtered dances to ${filteredDances.length} items`);
