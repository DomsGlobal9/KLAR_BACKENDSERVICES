import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO = process.env.MONGODB_URI!;

const WalletSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    balance: Number,
    status: String,
    currency: String,
}, { strict: false, collection: 'wallets' });

const UserSchema = new mongoose.Schema({
    email: String,
}, { strict: false, collection: 'users' });

const Wallet = mongoose.model('Wallet', WalletSchema);
const User = mongoose.model('User', UserSchema);

async function main() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO);
    console.log('✅ Connected\n');

    const all = await Wallet.find({}).sort({ balance: -1 });

    if (all.length === 0) {
        console.log('⚠️  No wallets found in DB!');
        await mongoose.disconnect();
        return;
    }

    console.log('=== ALL WALLETS ===');
    for (const w of all) {
        const u = await User.findById((w as any).userId);
        console.log(`  walletId: ${w._id}`);
        console.log(`  userId  : ${(w as any).userId}`);
        console.log(`  email   : ${(u as any)?.email || 'USER NOT FOUND'}`);
        console.log(`  balance : ₹${((w as any).balance || 0).toLocaleString('en-IN')}`);
        console.log(`  status  : ${(w as any).status}`);
        console.log('---');
    }

    // Find wallet with high balance (>= 1 lakh)
    const richWallet = all.find((w: any) => w.balance >= 100000);
    // Find wallet with 206 (or near it)
    const poorWallet = all.find((w: any) => w.balance <= 500 && w.balance > 0);

    if (richWallet && poorWallet && richWallet._id.toString() !== poorWallet._id.toString()) {
        console.log('\n⚠️  MISMATCH DETECTED');
        console.log(`  6-lakh wallet userId : ${(richWallet as any).userId}`);
        console.log(`  ₹206 wallet userId   : ${(poorWallet as any).userId}`);
        console.log('\n🔧 Transferring balance...');

        const amount = (richWallet as any).balance;
        await Wallet.updateOne({ _id: richWallet._id }, { $set: { balance: 0 } });
        await Wallet.updateOne({ _id: poorWallet._id }, { $inc: { balance: amount } });

        const updated = await Wallet.findById(poorWallet._id);
        console.log(`✅ Fixed! New balance: ₹${((updated as any)?.balance || 0).toLocaleString('en-IN')}`);
    } else if (!richWallet) {
        console.log('\n⚠️  No wallet with ₹1 lakh+ found. The 6-lakh balance may not exist in DB.');
    } else {
        console.log('\n✅ Same user owns the high-balance wallet. No fix needed — you may be logged into a different account.');
    }

    await mongoose.disconnect();
}

main().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
