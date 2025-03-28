// server/index.js
import express from "express";
import cors from "cors";
import "./shopifyOrders.js"; // Ensure Shopify orders are fetched
import { getPendingOrders, getCompletedOrders } from "./orderQueue.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors()); // Enable CORS if your frontend runs on a different port

// API endpoint to return orders
app.get("/orders", (req, res) => {
  res.json({
    pending: getPendingOrders(),
    completed: getCompletedOrders(),
  });
});

app.listen(PORT, () => {
  console.log(`Express server is running on port ${PORT}`);
});
