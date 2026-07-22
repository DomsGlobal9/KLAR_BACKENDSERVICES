const fs = require('fs');
const file = '/Users/rehanshaik/AndroidStudioProjects/KLAR_BACKENDSERVICES/flight-service/src/services/search.service.ts';
let content = fs.readFileSync(file, 'utf8');

// For OneWay
content = content.replace(
  /const markedUpResponse = MarkupInterceptor\.applyMarkupToFlightSearch\(rawResponse\.data\);/,
  `if (rawResponse.data && rawResponse.data.status && rawResponse.data.status.success === false) {
                throw new Error("TripJack API Error: " + JSON.stringify(rawResponse.data.errors));
            }
            const markedUpResponse = MarkupInterceptor.applyMarkupToFlightSearch(rawResponse.data);`
);

// For Return
content = content.replace(
  /const markedUpResponse = MarkupInterceptor\.applyMarkupToFlightSearch\(rawResponse\.data\);/g,
  `if (rawResponse.data && rawResponse.data.status && rawResponse.data.status.success === false) {
                throw new Error("TripJack API Error: " + JSON.stringify(rawResponse.data.errors));
            }
            const markedUpResponse = MarkupInterceptor.applyMarkupToFlightSearch(rawResponse.data);`
);

// We replaced it globally for all occurrences (OneWay, Return, MultiCity)
fs.writeFileSync(file, content);
