// server/orderQueue.js
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import os from "os";
import pkg from "pdf-to-printer";
import { exec } from "child_process";
import logToFile from "./logger.js";

const { print } = pkg;

// Global order storage for dashboard
let pendingOrders = [];
let completedOrders = [];

// The processing queue
const Queue = [];

// Get the current directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROCESSED_LABELS_DIR = path.join(__dirname, "../../labels");

// Ensure the directory exists for storing labels
if (!fs.existsSync(PROCESSED_LABELS_DIR)) {
  fs.mkdirSync(PROCESSED_LABELS_DIR, { recursive: true });
  console.log(
    `✅ Created directory for processed labels: ${PROCESSED_LABELS_DIR}`
  );
}

// Function to sanitize filenames
function sanitizeFilename(filename) {
  return filename.replace(/[<>:"/\\|?*]/g, "_");
}

export function enqueue(order) {
  console.log(
    `🔄 Attempting to enqueue order: ${order.orderName} - ${order.variantName}`
  );

  order.printingStatus = "Wunsch wird geprüft!";

  // Sanitize order name
  const sanitizedOrderName = sanitizeFilename(order.orderName);

  for (let i = 0; i < order.quantity; i++) {
    const labelFileName = `${sanitizedOrderName}_${i + 1}-${
      order.quantity
    }.pdf`;
    const labelPath = path.join(PROCESSED_LABELS_DIR, labelFileName);

    console.log(`📄 Checking label file path: ${labelPath}`);

    // Check if label file exists and avoid duplicate entries
    if (
      !fs.existsSync(labelPath) &&
      !Queue.some(
        (q) =>
          q.orderName === order.orderName &&
          q.variantName === order.variantName &&
          q.index === i + 1
      )
    ) {
      // Add to our queue and to the pending orders array for the dashboard
      Queue.push({ ...order, index: i + 1 });
      pendingOrders.push({
        orderName: order.orderName,
        productName: order.productName,
        variantName: order.variantName,
        quantity: order.quantity,
        status: "Pending",
        printingStatus: "wird gedruckt", // Initialize printingStatus
        index: i + 1,
      });
      console.log(
        `✅ Order added to queue: ${order.orderName} (${i + 1}/${
          order.quantity
        })`
      );
    } else {
      console.log(
        `⚠️ Skipping duplicate label: ${order.orderName} (${i + 1}/${
          order.quantity
        })`
      );
    }
  }
}

function dequeue() {
  console.log("🔄 Dequeuing the next order...");
  return Queue.shift();
}

export function processQueue() {
  if (Queue.length === 0) {
    console.log("⏳ Queue is empty. Waiting for new orders...");
    return;
  }

  const order = dequeue();
  console.log(
    `🔄 Processing order: ${order.orderName} (${order.index}/${order.quantity})`
  );

  generateLabel(order)
    .then(() => {
      console.log(
        `✅ Label generated: ${order.orderName} (${order.index}/${order.quantity})`
      );
      // Remove the processed order from pendingOrders and add it to completedOrders
      pendingOrders = pendingOrders.filter(
        (o) => !(o.orderName === order.orderName && o.index === order.index)
      );
      // completedOrders.push({
      //   orderName: order.orderName,
      //   quantity: order.quantity,
      //   status: "Completed",
      //   index: order.index,
      // });
    })
    .catch((err) => {
      console.error("❌ Error generating label:", err);
    });
}

async function generateLabel(order) {
  console.log(
    `🔄 Generating label for order: ${order.orderName} - ${order.variantName} (${order.index}/${order.quantity})`
  );
  console.log("Order Properties: ", order.properties);

  // Generate QR Code and save to a temporary file
  const tempQRPath = path.join(os.tmpdir(), `${order.orderName}_qr.png`);
  await QRCode.toFile(tempQRPath, order.orderName, { margin: 0 });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [162, 90], margin: 0 });
    const labelFileName = `${order.orderName}_${order.index}-${order.quantity}.pdf`;
    const labelPath = path.join(PROCESSED_LABELS_DIR, labelFileName);
    const writeStream = fs.createWriteStream(labelPath);
    doc.pipe(writeStream);

    const leftColumnStartX = 5;
    doc
      .font("Helvetica-Bold")
      .fontSize(6)
      .text(order.orderName, leftColumnStartX, 5, {
        width: 45,
        align: "center",
      })
      .text(order.productName, leftColumnStartX, 14, {
        width: 45,
        align: "center",
      })
      .text(order.variantName, leftColumnStartX, 23, {
        width: 45,
        align: "center",
      });

    doc.image(tempQRPath, leftColumnStartX + 5, 33, {
      width: 35,
      height: 35,
      align: "center",
    });
    doc
      .fontSize(6)
      .text(`DD.MM.YY     ${order.index}/${order.quantity}`, 5, 78);

    // Render properties in the right column
    let yPosition = 5;
    const maxHeight = 85;
    const propertyFontSize = 5;
    const textWidth = 95;
    doc.font("Helvetica").fontSize(propertyFontSize);
    order.properties.forEach(({ key, value }) => {
      if (value) {
        const cleanedKey = key.replace(/^Sorte\s*/, "");
        const propertyText = `${cleanedKey}: ${value}`;
        const textHeight = doc.heightOfString(propertyText, {
          width: textWidth,
        });
        if (yPosition + textHeight <= maxHeight) {
          doc.text(propertyText, 55, yPosition, { width: textWidth });
          yPosition += textHeight + 2;
        }
      }
    });

    doc.end();

    writeStream.on("finish", () => {
      console.log(`✅ Label file created: ${labelPath}`);
      printPDF(labelPath, order);
      resolve();
    });

    writeStream.on("error", (err) => {
      console.error("❌ Error generating label PDF:", err);
      reject(err);
    });
  });
}

async function printPDF(filePath, order) {
  logToFile(`🖨️ Attempting to print ${filePath}...`);

  // Set initial status to "Printing"
  order.printingStatus = "Printing";

  try {
    await print(filePath, {
      paperSize: "custom", // or whatever name you saved
      orientation: "landscape",
      scale: "noscale",
      silent: true,
    });
    logToFile(`Print job sent for ${filePath}`);
    order.printingStatus = "Wunsch wurde erfüllt!";

    // Now that printing succeeded, move the order from pending to completed
    moveOrderToCompleted(order);

    console.log(`✅ Print job sent for ${filePath}`);
  } catch (error) {
    logToFile(`Error printing ${filePath}: ${error.message}`);
    order.printingStatus = `Failed: ${error.message}`;
    // Update pendingOrders instead of removing it
    pendingOrders.push(order)
    console.error(`❌ Error printing ${filePath}:`, error);
  }
}

export { printPDF };

// Process the queue every 5 seconds
setInterval(processQueue, 5000);

// Expose helper functions to get orders status
export function getPendingOrders() {
  return pendingOrders;
}

export function getCompletedOrders() {
  return completedOrders;
}

function moveOrderToCompleted(order) {
  // Remove the order from pendingOrders
  pendingOrders = pendingOrders.filter(
    (o) => !(o.orderName === order.orderName && o.index === order.index)
  );

  // Add it to the completedOrders
  completedOrders.push(order);
}
