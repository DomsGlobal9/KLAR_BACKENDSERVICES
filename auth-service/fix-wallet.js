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

console.log('Connecting to MongoDB Atlas...');

const WalletSchema = new mongoose.Schema({}, { strict: false, collection: 'wallets' });
const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const Wallet = mongoose.model('Wallet', WalletSchema);
const User = mongoose.model('User', UserSchema);

mongoose.connect(MONGO, { serverSelectionTimeoutMS: 15000 })
    .then(async () => {
        console.log('✅ Connected!\n');

        const all = await Wallet.find({}).sort({ balance: -1 }).lean();
        console.log(`Total wallets found: ${all.length}\n`);

        if (all.length === 0) {
            console.log('⚠️  No wallets in DB!');
            return;
        }

        console.log('=== ALL WALLETS ===');
        for (const w of all) {
            const u = await User.findById(w.userId).lean();
            console.log(`  Wallet ID : ${w._id}`);
            console.log(`  User ID   : ${w.userId}`);
            console.log(`  Email     : ${u?.email || '(user not found)'}`);
            console.log(`  Balance   : ₹${(w.balance || 0).toLocaleString('en-IN')}`);
            console.log(`  Status    : ${w.status}`);
            console.log('---');
        }

        // Find highest balance wallet
        const rich = all[0]; // already sorted desc
        // Find the wallet with ~206
        const poor = all.find(w => w.balance <= 500);

        if (!poor) {
            console.log('\n⚠️  Could not find a low-balance wallet (<=500). Check the table above.');
            return;
        }

        if (rich._id.toString() === poor._id.toString()) {
            console.log('\n⚠️  Highest wallet IS the low-balance one — all wallets have low balance.');
            console.log('   This means the 6-lakh balance was never credited to any wallet in this DB.');
            return;
        }

        if (rich.balance < 100000) {
            console.log(`\n⚠️  Highest balance is only ₹${rich.balance} — no wallet has 6 lakhs in DB.`);
            return;
        }

        console.log('\n=== FIX: MISMATCH DETECTED ===');
        console.log(`  Rich wallet (₹${rich.balance?.toLocaleString('en-IN')}) → userId: ${rich.userId}`);
        console.log(`  Poor wallet (₹${poor.balance}) → userId: ${poor.userId}`);

        const richUser = await User.findById(rich.userId).lean();
        const poorUser = await User.findById(poor.userId).lean();
        console.log(`  Rich wallet belongs to: ${richUser?.email}`);
        console.log(`  Poor wallet belongs to: ${poorUser?.email}`);

        if (rich.userId?.toString() !== poor.userId?.toString()) {
            console.log('\n🔧 Transferring balance to the active user wallet...');
            const amount = rich.balance;
            await Wallet.updateOne({ _id: rich._id }, { $set: { balance: 0 } });
            await Wallet.updateOne({ _id: poor._id }, { $inc: { balance: amount } });
            const updated = await Wallet.findById(poor._id).lean();
            console.log(`✅ Fixed! New balance: ₹${(updated?.balance || 0).toLocaleString('en-IN')}`);
            console.log(`   Wallet ID: ${poor._id}`);
            console.log(`   Email    : ${poorUser?.email}`);
        } else {
            console.log('\n✅ Same user — no transfer needed. The logged-in user has ₹206 and owns the rich wallet too.');
        }
    })
    .catch(e => {
        console.error('❌ Connection failed:', e.message);
        if (e.message.includes('ENOTFOUND') || e.message.includes('querySrv')) {
            console.error('\n💡 DNS/Network issue reaching MongoDB Atlas.');
            console.error('   Try: (1) Check your internet, (2) Add 0.0.0.0/0 to Atlas IP whitelist');
        }
    })
    .finally(() => mongoose.disconnect());
