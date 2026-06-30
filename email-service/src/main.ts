import app from "./app";
import { envConfig } from "./config/env.config";

const PORT = envConfig.PORT;

app.listen(PORT, () => {
  console.log(`🚀 Email Service running on port ${PORT}`);
});