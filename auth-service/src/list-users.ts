import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://domsgloballlp_Klar_Auth:EqPiFeGcACd0BW5y@klar.ynuvafo.mongodb.net/auth-service?retryWrites=true&w=majority";

async function listUsers() {
    try {
        await mongoose.connect(MONGODB_URI);

        
        const db = mongoose.connection.db;
        if (!db) throw new Error('DB not found');
        
        const users = await db.collection('users').find({}).limit(5).toArray();

        users.forEach(u => console.log(`ID: ${u._id}, Name: ${u.name}, Email: ${u.email}`));
        
        await mongoose.disconnect();
    } catch (err) {

    }
}

listUsers();
