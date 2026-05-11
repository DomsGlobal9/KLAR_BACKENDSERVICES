
const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://domsgloballlp_Klar_Auth:EqPiFeGcACd0BW5y@klar.ynuvafo.mongodb.net/hotel-search-service?retryWrites=true&w=majority";

const RGDestinationSchema = new mongoose.Schema({
    destCode: String,
    destName: String,
});

const RGDestination = mongoose.model('RGDestination', RGDestinationSchema, 'rgdestinations');

async function check() {
    await mongoose.connect(MONGODB_URI);
    const dubai = await RGDestination.find({ destName: /dubai/i });
    console.log("Dubai destinations:", JSON.stringify(dubai, null, 2));
    
    const count = await RGDestination.countDocuments();
    console.log("Total destinations:", count);
    
    await mongoose.disconnect();
}

check().catch(console.error);
