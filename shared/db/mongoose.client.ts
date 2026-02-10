import mongoose from 'mongoose';

class MongooseClient {
    private static instance: MongooseClient;
    private isConnected: boolean = false;

    private constructor() { }

    public static getInstance(): MongooseClient {
        if (!MongooseClient.instance) {
            MongooseClient.instance = new MongooseClient();
        }
        return MongooseClient.instance;
    }

    public async connect(uri?: string): Promise<void> {
        if (this.isConnected) {
            console.log('💾 MongoDB already connected');
            return;
        }

        const mongoUri = uri || process.env.MONGODB_URI;

        if (!mongoUri) {
            console.error('❌ MONGODB_URI is not defined in environment variables');
            throw new Error('MONGODB_URI environment variable is required');
        }

        try {
            await mongoose.connect(mongoUri, {
                maxPoolSize: 10,
                minPoolSize: 2,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });

            this.isConnected = true;
            console.log('💾 MongoDB connected successfully');
            console.log(`📊 Database: ${process.env.MONGODB_URI}`);

            // Connection event handlers
            mongoose.connection.on('error', (error) => {
                console.error('❌ MongoDB connection error:', error);
                this.isConnected = false;
            });

            mongoose.connection.on('disconnected', () => {
                console.warn('⚠️  MongoDB disconnected');
                this.isConnected = false;
            });

            mongoose.connection.on('reconnected', () => {
                console.log('✅ MongoDB reconnected');
                this.isConnected = true;
            });

        } catch (error) {
            console.error('❌ MongoDB connection failed:', error);
            throw error;
        }
    }

    public async disconnect(): Promise<void> {
        if (!this.isConnected) {
            return;
        }

        try {
            await mongoose.disconnect();
            this.isConnected = false;
            console.log('💾 MongoDB disconnected gracefully');
        } catch (error) {
            console.error('❌ Error disconnecting MongoDB:', error);
            throw error;
        }
    }

    public getConnection() {
        return mongoose.connection;
    }

    public isConnectionActive(): boolean {
        return this.isConnected && mongoose.connection.readyState === 1;
    }
}

// Singleton instance
const mongooseClient = MongooseClient.getInstance();

// Graceful shutdown handlers
process.on('SIGINT', async () => {
    await mongooseClient.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await mongooseClient.disconnect();
    process.exit(0);
});

export default mongooseClient;
