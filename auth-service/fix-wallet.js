const mongoose = require('mongoose');
const fs = require('fs');

// Parse .env manually
const env = {};
fs.readFileSync('.env', 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
});

const MONGO = env['MONGODB_URI'];
if (!MONGO) { console.error('MONGODB_URI not found'); process.exit(1); }



const WalletSchema = new mongoose.Schema({}, { strict: false, collection: 'wallets' });
const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const Wallet = mongoose.model('Wallet', WalletSchema);
const User = mongoose.model('User', UserSchema);

mongoose.connect(MONGO, { serverSelectionTimeoutMS: 15000 })
    .then(async () => {


        const all = await Wallet.find({}).sort({ balance: -1 }).lean();


        if (all.length === 0) {

            return;
        }


        for (const w of all) {
            const u = await User.findById(w.userId).lean();






        }

        // Find highest balance wallet
        const rich = all[0]; // already sorted desc
        // Find the wallet with ~206
        const poor = all.find(w => w.balance <= 500);

        if (!poor) {

            return;
        }

        if (rich._id.toString() === poor._id.toString()) {


            return;
        }

        if (rich.balance < 100000) {

            return;
        }





        const richUser = await User.findById(rich.userId).lean();
        const poorUser = await User.findById(poor.userId).lean();



        if (rich.userId?.toString() !== poor.userId?.toString()) {

            const amount = rich.balance;
            await Wallet.updateOne({ _id: rich._id }, { $set: { balance: 0 } });
            await Wallet.updateOne({ _id: poor._id }, { $inc: { balance: amount } });
            const updated = await Wallet.findById(poor._id).lean();



        } else {

        }
    })
    .catch(e => {

        if (e.message.includes('ENOTFOUND') || e.message.includes('querySrv')) {


        }
    })
    .finally(() => mongoose.disconnect());
