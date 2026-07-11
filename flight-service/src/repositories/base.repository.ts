import { Model, Document } from 'mongoose';

export class BaseRepository<T extends Document> {
    protected model: Model<T>;

    constructor(model: Model<T>) {
        this.model = model;
    }

    async create(data: Partial<T>): Promise<T> {
        const document = new this.model(data);
        return await document.save();
    }

    async findById(id: string): Promise<T | null> {
        return await this.model.findById(id).lean();
    }

    async findAll(filter: any = {}): Promise<T[]> {
        return await this.model.find(filter).lean();
    }

    async update(id: string, data: Partial<T>): Promise<T | null> {
        return await this.model.findByIdAndUpdate(id, data, { new: true });
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.model.findByIdAndDelete(id);
        return !!result;
    }
}