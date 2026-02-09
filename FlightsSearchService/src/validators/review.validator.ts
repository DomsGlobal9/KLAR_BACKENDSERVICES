import { isExpired } from "../utils/time.util";

export function validateReviewResponse(response: any) {
  if (!response.status?.success || response.status.httpStatus !== 200) {
    throw new Error("Review API failed");
  }

  if (response.errors?.length) {
    throw new Error(response.errors[0].description);
  }

  if (response.conditions?.st && response.conditions?.sct) {
    if (isExpired(response.conditions.sct, response.conditions.st)) {
      throw new Error("Review session expired");
    }
  }
}
