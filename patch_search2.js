const fs = require('fs');
const file = '/Users/rehanshaik/AndroidStudioProjects/KLAR_BACKENDSERVICES/flight-service/src/services/search.service.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  /return \`route:oneway:\$\{from\}:\$\{to\}:\$\{date\}:\$\{cabin\}:\$\{pax\}\`;/,
  `return \`route:oneway:\$\{Date.now()\}:\$\{from\}:\$\{to\}:\$\{date\}:\$\{cabin\}:\$\{pax\}\`;`
);
fs.writeFileSync(file, content);
