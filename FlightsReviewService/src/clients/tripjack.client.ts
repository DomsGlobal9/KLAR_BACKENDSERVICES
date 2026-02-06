import axios from "axios";

export class TripJackClient {
  /**
   * Review flight before booking
   * Validates fare and gets booking conditions
   */
  async review(payload: any) {
    const response = await axios.post(
      process.env.TRIPJACK_REVIEW_URL!,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.TRIPJACK_TOKEN}`,
          "Content-Type": "application/json"
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
  async revalidate(payload: any) {
    const response = await axios.post(
      process.env.TRIPJACK_REVALIDATE_URL!,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.TRIPJACK_TOKEN}`,
          "Content-Type": "application/json"
        },
        timeout: 20000
      }
    );
    return response.data;
  }
}

export const tripJackClient = new TripJackClient();
