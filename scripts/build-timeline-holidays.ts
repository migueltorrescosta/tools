// Regenerate src/routes/timelines/data/events/public-holidays.json from the rules in
// src/routes/timelines/holidays.ts. The timelines data spec fails if the two drift apart.
//
// Usage: node scripts/build-timeline-holidays.ts
import { writeFileSync } from 'node:fs';
import { generateHolidays } from '../src/routes/timelines/holidays.ts';

const OUT = 'src/routes/timelines/data/events/public-holidays.json';
const events = generateHolidays(2026, 2029);
writeFileSync(OUT, JSON.stringify(events, null, '\t') + '\n');
console.log(`wrote ${events.length} holidays to ${OUT}`);
