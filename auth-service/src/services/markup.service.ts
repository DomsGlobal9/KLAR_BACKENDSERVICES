import { Types } from 'mongoose';
import { IMarkup, IMarkupService } from '../models/markup.model';
import { canonicalRegion } from './markup-config.service';
import { MarkupRepository } from '../repositories/markup.repository';
import { MarkupEarningRepository } from '../repositories/markup-earning.repository';
import { UserRepository } from '../repositories/user.repository';

export class MarkupService {

    private markupRepo = new MarkupRepository();
    private earningRepo = new MarkupEarningRepository();
    private userRepository = UserRepository.getInstance();

    async getAll(userId: Types.ObjectId, serviceType?: string) {

        const markup = await this.markupRepo.findActiveByUser(userId);

        if (!markup) return null;

        if (!serviceType) return markup;

        const target = serviceType.toUpperCase();
        const service = markup.services.find(s => {
            const current = (s.serviceType || '').toUpperCase();
            return current === target ||
                (target === 'HOTELS' && current === 'HOTEL') ||
                (target === 'HOTEL' && current === 'HOTELS') ||
                (target === 'FLIGHTS' && current === 'FLIGHT') ||
                (target === 'FLIGHT' && current === 'FLIGHTS');
        });

        if (!service) return {};

        return {
            ...markup,
            services: [service]
        };
    }

    async upsert(userId: Types.ObjectId, data: {
        serviceType?: string;
        region?: string;
        services?: IMarkupService[];
        appliedTo?: IMarkup['appliedTo'];
        isActive?: boolean;
    }) {

        const userData = await this.userRepository.findUserById(userId);

        if (userData?.createdBy) {
            throw new Error("You have no access to create and get personal markup");
        }

        if (data.services && Array.isArray(data.services)) {
            return this.markupRepo.upsertFull(userId, {
                userId,
                services: data.services,
                appliedTo: data.appliedTo,
                isActive: data.isActive,
                updatedBy: userId
            });
        }

        if (data.serviceType) {
            let markup = await this.markupRepo.findByUser(userId);

            // A service is keyed by (serviceType, region). Matching on
            // serviceType alone would make "HOTEL INTERNATIONAL" overwrite the
            // agent's existing "HOTEL DOMESTIC" rule instead of sitting beside
            // it — silently replacing one margin with another.
            const wantedRegion = canonicalRegion(data.region);
            const payload = { ...data, region: wantedRegion };

            if (markup) {
                const index = markup.services.findIndex(
                    s =>
                        (s.serviceType || '').toUpperCase() ===
                            (data.serviceType || '').toUpperCase() &&
                        canonicalRegion(s.region) === wantedRegion
                );

                if (index > -1) {
                    markup.services[index] = {
                        ...markup.services[index],
                        ...payload
                    };
                } else {
                    markup.services.push(payload as IMarkupService);
                }

                markup.updatedBy = userId;
                if (data.appliedTo) markup.appliedTo = data.appliedTo;

                return this.markupRepo.save(markup);
            }

            return this.markupRepo.create({
                userId,
                services: [payload as IMarkupService],
                appliedTo: data.appliedTo || 'BASE_FARE',
                createdBy: userId,
                updatedBy: userId
            });
        }

        throw new Error('Invalid data');
    }

    async bulkUpsert(userId: Types.ObjectId, data: {
        markups: IMarkupService[];
        appliedTo?: IMarkup['appliedTo'];
    }) {
        if (!Array.isArray(data.markups)) {
            throw new Error('Markups must be an array');
        }

        return this.markupRepo.updateServices(
            userId,
            data.markups,
            data.appliedTo
        );
    }

    /**
     * Removes one (serviceType, region) rule.
     *
     * `region` is optional for backwards compatibility: an older client that
     * sends only a serviceType still means "the ALL rule", which is what its
     * single pre-region row migrated to.
     */
    async delete(userId: Types.ObjectId, serviceType: string, region?: string) {
        if (!serviceType) {
            throw new Error('serviceType is required');
        }

        return this.markupRepo.pullService(
            userId,
            serviceType,
            canonicalRegion(region)
        );
    }

    async deleteByServiceId(
        userId: Types.ObjectId,
        serviceId: Types.ObjectId
    ) {

        const markup = await this.markupRepo.findByUser(userId);

        if (!markup) {
            throw new Error("Markup not found");
        }

        const exists = markup.services.some(
            s => s._id?.toString() === serviceId.toString()
        );

        if (!exists) {
            throw new Error("Service not found");
        }

        return this.markupRepo.pullServiceById(userId, serviceId);
    }

    async getMonthlyMarkupRevenue(userId: Types.ObjectId, monthsBack: number) {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - monthsBack);

        return this.earningRepo.getMonthlyRevenue(userId, startDate);
    }

    async getMarkupByUserAndType(userId: Types.ObjectId, serviceType: string) {
        try {
            const userData = await this.userRepository.findUserById(userId);

            if (!userData) {
                throw new Error("User not found");
            }

            let targetUserId = userId;
            if (userData.createdBy) {
                targetUserId = userData.createdBy;
            }

            const markup = await this.markupRepo.findActiveByUser(targetUserId);

            if (!markup) return null;

            const target = serviceType.toUpperCase();
            const service = markup.services.find(s => {
                const current = (s.serviceType || '').toUpperCase();
                return current === target ||
                    (target === 'HOTELS' && current === 'HOTEL') ||
                    (target === 'HOTEL' && current === 'HOTELS') ||
                    (target === 'FLIGHTS' && current === 'FLIGHT') ||
                    (target === 'FLIGHT' && current === 'FLIGHTS');
            });

            if (!service) return null;

            // Fix: Convert to object safely
            const markupObject = typeof markup.toObject === 'function'
                ? markup.toObject()
                : markup;

            const result = {
                ...markupObject,
                services: [service],
                _usedUserId: targetUserId,
                _isInherited: targetUserId.toString() !== userId.toString()
            };


            return result;

        } catch (error: any) {
            console.error(`[ERROR] getMarkupByUserAndType failed:`, {
                userId: userId.toString(),
                serviceType: serviceType,
                errorMessage: error.message
            });
            throw error;
        }
    }
}