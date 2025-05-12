// server/shopifyOrders.js
import dotenv from "dotenv";
import { enqueue } from "./orderQueue.js"; // updated import
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "./.env") });

const SHOPIFY_STORE = process.env.SHOPIFY_STORE || "";
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || "";
const PRODUCT_IDS = process.env.SHOPIFY_PRODUCT_IDS || "";
const PRODUCT_ID_ARRAY = PRODUCT_IDS ? PRODUCT_IDS.split(",") : [];

if (!SHOPIFY_STORE || !SHOPIFY_ACCESS_TOKEN || PRODUCT_ID_ARRAY.length === 0) {
  console.error(
    "⚠️ Missing environment variables. Please check your .env file."
  );
  process.exit(1);
}

let isFetching = false;

async function fetchFilteredShopifyOrders(cursorIndex = null, allOrders = {}) {
  const query = `{
    orders(first: 250${
      cursorIndex ? `, after: \"${cursorIndex}\"` : ""
    }, query: "fulfillment_status:unfulfilled financial_status:paid") {
      edges {
        cursor
        node {
          id
          name
          createdAt
          lineItems(first: 250) {
            edges {
              node {
                name
                id
                quantity
                product { 
                  id
                  title
                }
                variant { 
                  id
                  title
                }
                customAttributes {
                  key
                  value
                } 
              }
            }
          }
        }
      }
      pageInfo { hasNextPage }
    }
  }`;

  try {
    console.log("🔄 Fetching Shopify orders...");
    const response = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2024-07/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      console.error(
        `❌ HTTP Error: ${response.status} - ${response.statusText}`
      );
      throw new Error(`Error fetching data: ${response.statusText}`);
    }

    const responseData = await response.json();

    if (responseData.errors) {
      console.error("⚠️ GraphQL Errors:", responseData.errors);
      throw new Error("Failed to fetch data from Shopify API.");
    }

    if (!responseData.data?.orders?.edges) {
      console.error("⚠️ Unexpected API response structure.");
      throw new Error("Shopify API response is invalid.");
    }

    console.log("🔄 Extracting and transforming order data...");
    responseData.data.orders.edges.forEach((edge) => {
      const order = edge.node;
      order.lineItems.edges.forEach((item) => {
        const productId = item.node.product?.id;
        if (PRODUCT_ID_ARRAY.includes(productId)) {
          // Convert properties to a string to include them in the key
          const propertiesString = item.node.customAttributes
            .map((attr) => `${attr.key}:${attr.value}`)
            .join("|");

          const date = new Date(order.createdAt);
          const formattedDate = date.toLocaleDateString("en-GB").split("/").join(".");

          // Create a unique order key with order name, variant ID, and properties
          const orderKey = `${order.name}_${item.node.variant?.id}_${propertiesString}`;
          if (!allOrders[orderKey]) {
            allOrders[orderKey] = {
              orderName: order.name,
              variantId: item.node.variant?.id,
              productName: item.node.product?.title,
              variantName: item.node.variant?.title,
              quantity: item.node.quantity,
              properties: item.node.customAttributes || [],
              date: formattedDate
            };
            console.log(
              `✅ New order added: ${order.name} - ${item.node.variant?.title}`
            );
          } else {
            allOrders[orderKey].quantity += item.node.quantity;
            console.log(
              `🔄 Updated order quantity for ${order.name} - ${item.node.variant?.title}: ${allOrders[orderKey].quantity}`
            );
          }
        }
      });
    });

    if (responseData.data.orders.pageInfo.hasNextPage) {
      const nextCursor =
        responseData.data.orders.edges[
          responseData.data.orders.edges.length - 1
        ].cursor;
      console.log(
        `🔄 Fetching next page of orders using cursor: ${nextCursor}`
      );
      return fetchFilteredShopifyOrders(nextCursor, allOrders);
    }

    const ordersArray = Object.values(allOrders);
    console.log("✅ Orders grouped:", ordersArray);

    if (ordersArray.length > 0) {
      console.log("🔄 Enqueuing orders...");
      ordersArray.forEach((order) => enqueue(order));
      console.log(
        "✅ Orders enqueued:",
        ordersArray.map((order) => order.orderName)
      );
    } else {
      console.log("⚠️ No orders matched the specified product IDs.");
    }

    return ordersArray;
  } catch (error) {
    console.error("❌ Error fetching Shopify orders:", error);
    throw error;
  }
}

// Initial fetch
if (!isFetching) {
  isFetching = true;
  fetchFilteredShopifyOrders()
    .then(() => {
      isFetching = false;
    })
    .catch((err) => {
      console.error("Initial fetch error:", err);
      isFetching = false;
    });
}

// Poll for new orders every minute, avoiding overlap
setInterval(() => {
  if (isFetching) {
    console.log("⏳ Already fetching orders, skipping this poll.");
    return;
  }
  isFetching = true;
  console.log("⏳ Checking for new orders...");
  fetchFilteredShopifyOrders()
    .then(() => {
      isFetching = false;
    })
    .catch((error) => {
      console.error("Error during fetch:", error);
      isFetching = false;
    });
}, 60000);

export { fetchFilteredShopifyOrders };
