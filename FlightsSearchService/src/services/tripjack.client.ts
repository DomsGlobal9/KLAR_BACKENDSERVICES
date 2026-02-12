import axios from "axios";
import { envConfig } from "../config/env";

export class TripJackClient {
  /**
   * Review flight before booking
   * Validates fare and gets booking conditions
   */
  async review(payload: any) {
    const response = await axios.post(
      `${envConfig.TRIPJACK.BASE_URL}/fms/v1/review`,
      payload,
      {
           headers: {
             "Content-Type": "application/json",
             apikey: envConfig.TRIPJACK.API_KEY,
           },
           timeout: 20000
         }
    );
    return response.data;
  }

  /**
   * Revalidate fare before final booking
   * Ensures price hasn't changed since review
   */
  async revalidate(payload: any) : Promise<any> {
    const response = await axios.post(
      `${envConfig.TRIPJACK.BASE_URL}/fms/v1/revalidate`,
      payload,
      {
         headers: {
             "Content-Type": "application/json",
             apikey: envConfig.TRIPJACK.API_KEY,
           },
        timeout: 20000
      }
    );
    return response.data;
  }
}

export const tripJackClient = new TripJackClient();
