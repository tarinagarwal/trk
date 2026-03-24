const fs = require('fs');
const path = require('path');

const contracts = [
  'TRKRouter',
  'TRKTreasury',
  'TRKGameEngine',
  'TRKCashbackEngine',
  'TRKLuckyDraw',
  'TRKUserRegistry'
];

const sourceBase = path.join(__dirname, 'artifacts', 'contracts');
const targetBase = path.join(__dirname, 'src', 'abis');

if (!fs.existsSync(targetBase)) {
  fs.mkdirSync(targetBase, { recursive: true });
}

contracts.forEach(contract => {
  const sourcePath = path.join(sourceBase, `${contract}.sol`, `${contract}.json`);
  const targetPath = path.join(targetBase, `${contract}.json`);

  if (fs.existsSync(sourcePath)) {
    const data = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    fs.writeFileSync(targetPath, JSON.stringify(data, null, 2));
    console.log(`✅ Copied ${contract} ABI to src/abis/`);
  } else {
    console.error(`❌ Could not find artifact for ${contract} at ${sourcePath}`);
  }
});
