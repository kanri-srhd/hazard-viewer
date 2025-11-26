const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./data/power/osm/substations_osm.geojson', 'utf8'));

console.log('='.repeat(60));
console.log('OSM Substations Analysis (Kanto Region)');
console.log('='.repeat(60));
console.log(`Total features: ${data.features.length}`);

const named = data.features.filter(f => f.properties.name);
console.log(`Named substations: ${named.length}`);
console.log(`Unnamed substations: ${data.features.length - named.length}`);

// Voltage distribution
console.log('\nVoltage distribution (top 10):');
const voltages = {};
data.features.forEach(f => {
  const v = f.properties.voltage || 'unknown';
  voltages[v] = (voltages[v] || 0) + 1;
});
Object.entries(voltages)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([v, c]) => console.log(`  ${v}: ${c}`));

// OSM type distribution
console.log('\nOSM type distribution:');
const types = {};
data.features.forEach(f => {
  const t = f.properties.osm_type || 'unknown';
  types[t] = (types[t] || 0) + 1;
});
Object.entries(types).forEach(([t, c]) => console.log(`  ${t}: ${c}`));

// Sample named substations
console.log('\nSample named substations (first 20):');
named.slice(0, 20).forEach((f, i) => {
  const coords = f.geometry.coordinates;
  const name = f.properties.name || 'unnamed';
  const voltage = f.properties.voltage || 'N/A';
  console.log(`  ${i + 1}. ${name} [${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}] (${voltage}V)`);
});

console.log('\n' + '='.repeat(60));
console.log('Analysis complete!');
console.log('='.repeat(60));
