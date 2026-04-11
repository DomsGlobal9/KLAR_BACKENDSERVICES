import { productsService } from './src/services/products.service';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

async function verify() {
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI not found in environment');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const productPayload: any = {
        propertyId: "TJ:1000000", // Example TJ ID
        checkin: "2026-04-03",
        checkout: "2026-04-08",
        rooms: [{ Adults: 2, Children: 0, childrenAges: [] }],
        currency: "INR",
        countryCode: "IN"
    };

    console.log('Requesting products for TJ:1000000...');
    try {
        const data = await productsService.getProducts(productPayload);
        console.log('Product Result Summary:');
        console.log(`- status: ${data.status}`);
        console.log(`- hotelName: ${data.body?.name}`);
        console.log(`- roomOptions.length: ${data.body?.options?.length}`);

        if (data.status && data.body?.options?.length > 0) {
            console.log('✅ SUCCESS: Detail support is working.');
            console.log('\nTop 3 Room Options:');
            data.body.options.slice(0, 3).forEach((o: any, i: number) => {
                console.log(`${i+1}. ${o.name} (₹${o.price}) [${o.boardName}]`);
            });
        }
    } catch (e: any) {
        console.error('❌ FAILURE:', e.message);
    }

    await mongoose.disconnect();
}

verify().catch(console.error);
