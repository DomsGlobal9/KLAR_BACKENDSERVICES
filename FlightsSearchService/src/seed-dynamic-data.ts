import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from "node:dns/promises";

// DNS Fix for MongoDB Atlas connectivity
dns.setServers(["1.1.1.1", "1.0.0.1", "0.0.0.0", "149.88.103.51"]);

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://domsgloballlp_Klar_Auth:EqPiFeGcACd0BW5y@klar.ynuvafo.mongodb.net/flight-service?retryWrites=true&w=majority";

const TEST_USER_ID = "66c8c8b2a1f4e0a123456789";

async function seedData() {
    try {
        console.log('🌱 Connecting to search_service DB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected!');
        
        const db = mongoose.connection.db;
        if (!db) throw new Error('DB not found');
        
        const bookingsCollection = db.collection('flightbookings');
        
        // Clear existing test bookings for this user to avoid duplicates if re-run
        // await bookingsCollection.deleteMany({ userId: TEST_USER_ID });
        
        const sampleBookings = [
            {
                bookingId: "KL-FL-2026-001",
                userId: TEST_USER_ID,
                status: "CONFIRMED",
                totalAmount: 45000,
                bookingDate: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                paymentInfos: [{ amount: 45000 }],
                deliveryInfo: { emails: ["test@example.com"], contacts: ["9999999999"] },
                travellerInfo: [{
                    ti: "Mr", fN: "Test", lN: "User", pt: "ADULT", dob: new Date("1990-01-01")
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
                bookingId: "KL-FL-2026-002",
                userId: TEST_USER_ID,
                status: "CONFIRMED",
                totalAmount: 82000,
                bookingDate: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                paymentInfos: [{ amount: 82000 }],
                deliveryInfo: { emails: ["test@example.com"], contacts: ["9999999999"] },
                travellerInfo: [{
                    ti: "Mr", fN: "Test", lN: "User", pt: "ADULT", dob: new Date("1990-01-01")
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
            },
            {
                bookingId: "KL-FL-2026-003",
                userId: TEST_USER_ID,
                status: "CONFIRMED",
                totalAmount: 125000,
                bookingDate: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                paymentInfos: [{ amount: 125000 }],
                deliveryInfo: { emails: ["test@example.com"], contacts: ["9999999999"] },
                travellerInfo: [{
                    ti: "Mr", fN: "Test", lN: "User", pt: "ADULT", dob: new Date("1990-01-01")
                }],
                tripDetails: {
                    itinerary: {
                        segments: [{
                            fD: {
                                aD: { 
                                    src: { name: "London Heathrow Airport", city: "London", airportCode: "LHR" },
                                    dest: { name: "Charles de Gaulle Airport", city: "Paris", airportCode: "CDG" }
                                },
                                dt: "2026-06-23T10:00:00",
                                at: "2026-06-23T11:15:00"
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

        console.log('✨ Successfully seeded 3 flight bookings for Testing!');
        await mongoose.disconnect();
    } catch (err) {
        console.error('❌ Error seeding data:', err);
    }
}

seedData();
