import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This script will read existing preset data and publish them to the dot-presets namespace
// Before running this script, you must have DOT_ADMIN_TOKEN set in your environment
// to authorize publishing to the reserved @dot-presets namespace.

const API_URL = process.env.REGISTRY_URL || 'https://registry.danceoftal.com';
const ADMIN_TOKEN = process.env.DOT_ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
    console.error('Error: DOT_ADMIN_TOKEN environment variable is required to publish to @dot-presets.');
    process.exit(1);
}

const AUTHOR = 'dot-presets';

async function publishAsset(category: string, name: string, payload: any, description: string, tags: string[] = []) {
    const urn = `${category}/@${AUTHOR}/${name}`;
    console.log(`Publishing ${urn}...`);

    try {
        const response = await fetch(`${API_URL}/publish`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ADMIN_TOKEN}`, // The worker expects this to match DOT_ADMIN_TOKEN
                'X-Admin-Author': AUTHOR
            },
            body: JSON.stringify({
                category,
                name,
                payload: {
                    ...payload,
                    description,
                    version: '2.0.0', // Standardizing on v2
                },
                tags
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            console.error(`❌ Failed to publish ${urn}:`, data.error || data.details || response.statusText);
        } else {
            console.log(`✅ Successfully published ${urn}`);
        }
    } catch (err) {
        console.error(`❌ Network error publishing ${urn}:`, err);
    }
}

async function main() {
    // Use front-end catalog data (source of truth for all tals/dances)
    const frontDataDir = path.resolve(__dirname, '../../front/src/data');

    // Read and publish Tals (array format: [{slug, name, description, thinking, tags, ...}])
    try {
        const talsFile = path.join(frontDataDir, 'tals.json');
        if (fs.existsSync(talsFile)) {
            const tals: any[] = JSON.parse(fs.readFileSync(talsFile, 'utf8'));
            console.log(`Seeding ${tals.length} tals...`);
            for (const tal of tals) {
                const tags = ['official', ...(tal.tags || [])];
                const talWithType = { type: `tal/${tal.slug}`, ...tal };
                await publishAsset('tal', tal.slug, talWithType, tal.description || `${tal.slug} Tal`, tags);
            }
        } else {
            console.warn('tals.json not found at', talsFile);
        }
    } catch (e) {
        console.error("Error processing tals:", e);
    }

    // Read and publish Dances (array format: [{slug, name, description, rules, ...}])
    try {
        const dancesFile = path.join(frontDataDir, 'dances.json');
        if (fs.existsSync(dancesFile)) {
            const dances: any[] = JSON.parse(fs.readFileSync(dancesFile, 'utf8'));
            console.log(`Seeding ${dances.length} dances...`);
            for (const dance of dances) {
                const tags = ['official', ...(dance.tags || [])];
                const danceWithType = { type: `dance/${dance.slug}`, ...dance };
                await publishAsset('dance', dance.slug, danceWithType, dance.description || `${dance.slug} Dance`, tags);
            }
        } else {
            console.warn('dances.json not found at', dancesFile);
        }
    } catch (e) {
        console.error("Error processing dances:", e);
    }

    // Official Combos to seed — references real tal/dance slugs from catalog
    const combos: Record<string, any> = {
        "gpt-architecture-review": {
            type: "combo/gpt-architecture-review",
            tal: "tal/@dot-presets/product-architect",
            dance: "dance/@dot-presets/architecture-decision-record-dance",
            description: "Expert architectural review of your codebase."
        },
        "gpt-safe-investor": {
            type: "combo/gpt-safe-investor",
            tal: "tal/@dot-presets/warren-buffett-case-tal",
            dance: "dance/@dot-presets/risk-screen",
            description: "Analyzes financial risks conservatively."
        },
        "gpt-creative-writer": {
            type: "combo/gpt-creative-writer",
            tal: "tal/@dot-presets/brand-storyteller",
            dance: "dance/@dot-presets/short-video-script-dance",
            description: "Helps draft creative narratives."
        }
    };

    console.log(`Seeding ${Object.keys(combos).length} combos...`);
    for (const [name, combo] of Object.entries(combos)) {
        await publishAsset('combo', name, combo, combo.description, ['official', 'recommended']);
    }

    console.log("Migration complete.");
}

main();
