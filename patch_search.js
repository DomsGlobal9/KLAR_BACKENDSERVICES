const fs = require('fs');
const file = '/Users/rehanshaik/AndroidStudioProjects/KLAR_BACKENDSERVICES/flight-service/src/services/search.service.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  /console\.log\("TRIPJACK RAW RESPONSE >>>".*?\n/,
  `require('fs').writeFileSync('tripjack_raw.json', JSON.stringify(rawResponse.data, null, 2));\n`
);
fs.writeFileSync(file, content);
