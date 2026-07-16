const mongoose = require('mongoose');

const uri = "mongodb://domsgloballlp_Klar_Auth:EqPiFeGcACd0BW5y@ac-gfbeix5-shard-00-00.ynuvafo.mongodb.net:27017,ac-gfbeix5-shard-00-01.ynuvafo.mongodb.net:27017,ac-gfbeix5-shard-00-02.ynuvafo.mongodb.net:27017/cabs-service?ssl=true&authSource=admin&retryWrites=true&w=majority";

async function run() {
  try {
    await mongoose.connect(uri);
    console.log("Connected to DB");
    
    const db = mongoose.connection.db;
    const collection = db.collection('cabbookings'); 
    
    const indexes = await collection.indexes();
    console.log("Existing cabbookings indexes:", indexes.map(i => i.name));
    
    if (indexes.find(i => i.name === 'bookingId_1')) {
      await collection.dropIndex('bookingId_1');
      console.log("Dropped bookingId_1 index");
    } else {
      console.log("bookingId_1 index not found");
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
