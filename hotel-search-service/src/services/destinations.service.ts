import { RGDestinationModel } from "../models/RGDestination.model";

class DestinationsService {
    async getDestinations() {
        const destinations = await RGDestinationModel.find().lean();
        
        return {
            status: true,
            body: destinations.map(dest => ({
                destCode: dest.destCode,
                destName: dest.destName,
                countryName: "" // Optional, can be added if available in model
            }))
        };
    }
}

export const destinationsService = new DestinationsService();
