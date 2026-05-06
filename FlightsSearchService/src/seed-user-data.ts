fimport mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from "node:dns/promises";

// DNS Fix for MongoDB Atlas connectivity
dns.setServers(["8.8.8.8", "1.1.1.1"]);

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://domsgloballlp_Klar_Auth:EqPiFeGcACd0BW5y@klar.ynuvafo.mongodb.net/flight-service?retryWrites=true&w=majority";

// The User ID seen in the logs
const TEST_USER_ID = "699d3fcb1264eb3701610b2a";

async function seedData() {
    try {
        console.log('🌱 Connecting to search_service DB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected!');

        const db = mongoose.connection.db;
        if (!db) throw new Error('DB not found');

        const bookingsCollection = db.collection('flightbookings');

        // Use a consistent set of sample bookings
        const sampleBookings = [
            {
                bookingId: "TJS101902128887",
                userId: TEST_USER_ID,
                status: "CONFIRMED",
                totalAmount: 45000,
                bookingDate: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                paymentInfos: [{ amount: 45000 }],
                deliveryInfo: { emails: ["test@example.com"], contacts: ["9999999999"] },
                travellerInfo: [{
                    ti: "Mr", fN: "Sudheer", lN: "Vignesh", pt: "ADULT", dob: new Date("1990-01-01")
                }],
                tripDetails: {
                    itinerary: {
                        segments: [{
                            fD: {
                                aD: {
                                    src: { name: "Indira Gandhi International Airport", city: "Delhi", airportCode: "DEL" },
                                    dest: { name: "Chhatrapati Shivaji Maharaj International Airport", city: "Mumbai", airportCode: "BOM" }
                                },
                                dt: "2026-06-24T10:00:00",
                                at: "2026-06-24T12:00:00"
                            }
                        }]
                    }
                }
            },
            {
                bookingId: "TJS104202128649",
                userId: TEST_USER_ID,
                status: "CONFIRMED",
                totalAmount: 82000,
                bookingDate: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                paymentInfos: [{ amount: 82000 }],
                deliveryInfo: { emails: ["test@example.com"], contacts: ["9999999999"] },
                travellerInfo: [{
                    ti: "Mr", fN: "Sudheer", lN: "Vignesh", pt: "ADULT", dob: new Date("1990-01-01")
                }],
                tripDetails: {
                    itinerary: {
                        segments: [{
                            fD: {
                                aD: {
                                    src: { name: "Dubai International Airport", city: "Dubai", airportCode: "DXB" },
                                    dest: { name: "Kempegowda International Airport", city: "Bengaluru", airportCode: "BLR" }
                                },
                                dt: "2026-06-25T15:30:00",
                                at: "2026-06-25T21:00:00"
                            }
                        }]
                    }
                }
            }
        ];

        for (const booking of sampleBookings) {
            await bookingsCollection.updateOne(
                { bookingId: booking.bookingId },
                { $set: booking },
                { upsert: true }
            );
        }

        console.log(`✨ Successfully seeded 2 flight bookings for User: ${TEST_USER_ID}`);
        await mongoose.disconnect();
    } catch (err) {
        console.error('❌ Error seeding data:', err);
    }
}

seedData();
