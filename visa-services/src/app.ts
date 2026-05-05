// import express from "express";

// import visaRoutes from "./routes/visa-routes";





// const app = express();



// app.use(express.json());
// app.use(cors(...)); 
// app.use("/api/visa", visaRoutes);

// export default app;

import express from "express";
import cors from "cors";
import visaRoutes from "./routes/visa-routes";

const app = express();

app.use(express.json());

// ✅ CORS (correct syntax)
// app.use(
//   cors({
//     origin: "http://localhost:5173",
//     credentials: true,
//   })
// );

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5009"],
    credentials: true,
  })
);

// ✅ test route
app.get("/", (req, res) => {
  res.send("Backend working");
});

// ✅ routes
app.use("/api/visa", visaRoutes);

export default app;