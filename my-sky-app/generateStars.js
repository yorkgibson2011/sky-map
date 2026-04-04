// generateStars.js
import https from 'node:https';
import fs from 'node:fs';
import readline from 'node:readline';

// A stable, raw GitHub mirror of the v3 database
const CSV_URL = 'https://exploratoria.github.io/exhibits/astronomy/star-spotter/data/hygdata_v3.csv';

async function processStars() {
  console.log('Downloading HYG Database (this might take a few seconds)...');

  https.get(CSV_URL, async (response) => {
    if (response.statusCode !== 200) {
      console.error(`Failed to download file. Status Code: ${response.statusCode}`);
      return;
    }

    const rl = readline.createInterface({ input: response, crlfDelay: Infinity });

    let stars = [];
    let isHeader = true;

    console.log('Parsing star data...');

    for await (const line of rl) {
      if (isHeader) { isHeader = false; continue; }
      
      const columns = line.split(',');
      const properName = columns[6] ? columns[6].trim() : ""; 
      const ra = parseFloat(columns[7]);     // Right Ascension (hours)
      const dec = parseFloat(columns[8]);    // Declination (degrees)
      const mag = parseFloat(columns[13]);   // Visual Magnitude

      if (properName === 'Sol') continue;
      
      // Filter: Only keep stars brighter than Magnitude 5.5
      if (!isNaN(mag) && mag <= 5.5) {
        stars.push({
          name: properName,
          RA: Number((ra).toFixed(3)), 
          Dec: Number((dec).toFixed(3)),
          VM: Number((mag).toFixed(2))
        });
      }
    }

    console.log(`Extracted ${stars.length} visible stars. Writing to file...`);

    // Create the TypeScript file string
    const tsContent = `// Auto-generated Star Data from HYG Database
export interface StarDefinition {
  name: string;
  RA: number;
  Dec: number;
  VM: number;
}

export const STAR_DATA: StarDefinition[] = ${JSON.stringify(stars, null, 2)};
`;

    fs.writeFileSync('./src/utils/StarData.ts', tsContent);
    console.log('✅ Successfully generated /src/utils/StarData.ts!');
    
  }).on('error', (err) => {
    console.error('Error downloading the database:', err.message);
  });
}

processStars();