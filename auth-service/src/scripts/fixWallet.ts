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

    await mongoose.connect(MONGO);


    const all = await Wallet.find({}).sort({ balance: -1 });

    if (all.length === 0) {

        await mongoose.disconnect();
        return;
    }


    for (const w of all) {
        const u = await User.findById((w as any).userId);






    }

    // Find wallet with high balance (>= 1 lakh)
    const richWallet = all.find((w: any) => w.balance >= 100000);
    // Find wallet with 206 (or near it)
    const poorWallet = all.find((w: any) => w.balance <= 500 && w.balance > 0);

    if (richWallet && poorWallet && richWallet._id.toString() !== poorWallet._id.toString()) {





        const amount = (richWallet as any).balance;
        await Wallet.updateOne({ _id: richWallet._id }, { $set: { balance: 0 } });
        await Wallet.updateOne({ _id: poorWallet._id }, { $inc: { balance: amount } });

        const updated = await Wallet.findById(poorWallet._id);

    } else if (!richWallet) {

    } else {

    }

    await mongoose.disconnect();
}

main().catch(e => {

    process.exit(1);
});
