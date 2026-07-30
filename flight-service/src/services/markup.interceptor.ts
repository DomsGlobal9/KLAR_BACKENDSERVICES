import MarkupConfiguration from "../config/markup.config";

class MarkupInterceptorService {

    /**
     * Apply markup to FLIGHT SEARCH RESPONSE
     */
    applyMarkupToFlightSearch(response: any): any {

        if (!response || !MarkupConfiguration.isEnabled()) {

            return response;
        }

        const clonedResponse = JSON.parse(JSON.stringify(response));

        const tripInfos = clonedResponse?.searchResult?.tripInfos;

        if (!tripInfos) {

            return clonedResponse;
        }

        if (tripInfos.ONWARD && Array.isArray(tripInfos.ONWARD)) {

            this.processFlightTripInfos(tripInfos.ONWARD);
        }

        if (tripInfos.RETURN && Array.isArray(tripInfos.RETURN)) {

            this.processFlightTripInfos(tripInfos.RETURN);
        }

        if (tripInfos.COMBO && Array.isArray(tripInfos.COMBO)) {

            this.processFlightTripInfos(tripInfos.COMBO);
        }

        return clonedResponse;
    }

    /**
     * Process trip infos and apply markup to all prices
     */
    private processFlightTripInfos(tripInfos: any[]): void {
        for (const trip of tripInfos) {
            if (trip.totalPriceList && Array.isArray(trip.totalPriceList)) {
                for (const price of trip.totalPriceList) {
                    if (price.fD) {
                        // Process ADULT
                        if (price.fD.ADULT?.fC?.TF) {
                            const originalPrice = price.fD.ADULT.fC.TF;
                            const markupAmount = MarkupConfiguration.getMarkupValue(originalPrice);



                            price.fD.ADULT.fC.originalTF = originalPrice;
                            price.fD.ADULT.fC.TF = originalPrice + markupAmount;
                            price.fD.ADULT.fC.markup = markupAmount;
                        }

                        // Process CHILD
                        if (price.fD.CHILD?.fC?.TF) {
                            const originalPrice = price.fD.CHILD.fC.TF;
                            const markupAmount = MarkupConfiguration.getMarkupValue(originalPrice);
                            price.fD.CHILD.fC.originalTF = originalPrice;
                            price.fD.CHILD.fC.TF = originalPrice + markupAmount;
                            price.fD.CHILD.fC.markup = markupAmount;
                        }

                        // Process INFANT
                        if (price.fD.INFANT?.fC?.TF) {
                            const originalPrice = price.fD.INFANT.fC.TF;
                            const markupAmount = MarkupConfiguration.getMarkupValue(originalPrice);
                            price.fD.INFANT.fC.originalTF = originalPrice;
                            price.fD.INFANT.fC.TF = originalPrice + markupAmount;
                            price.fD.INFANT.fC.markup = markupAmount;
                        }
                    }
                }
            }
        }
    }
}

export default new MarkupInterceptorService();