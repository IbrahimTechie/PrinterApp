// server/orderQueue.js
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import crypto from "crypto";
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

// DEV ONLY: Set this to an order name to only print that order during development
const DEV_ONLY_ORDER_NAME = null;

// Function to sanitize filenames
function sanitizeFilename(filename) {
  return filename.replace(/[<>:"/\\|?*]/g, "_");
}

export function enqueue(order) {
  // DEV ONLY: Skip orders that don't match the specified order name
  console.log("ENV DEV_ONLY_ORDER_NAME:", DEV_ONLY_ORDER_NAME, "Order:", order.orderName);
  if (DEV_ONLY_ORDER_NAME && order.orderName !== DEV_ONLY_ORDER_NAME) {
    console.log(`⚠️ Skipping order ${order.orderName} (DEV_ONLY_ORDER_NAME active)`);
    return;
  }

  console.log(
    `🔄 Attempting to enqueue order: ${order.orderName} - ${order.variantName}`
  );

  order.printingStatus = "Wunsch wird geprüft!";

  // Sanitize order name and include a short hash of properties to avoid filename collisions
  const sanitizedOrderName = sanitizeFilename(order.orderName);
  const propsHash = crypto
    .createHash("md5")
    .update(sortedProps(order.properties || []))
    .digest("hex")
    .slice(0, 8);

  for (let i = 0; i < order.quantity; i++) {
    const labelFileName = `${sanitizedOrderName}_${i + 1}-${order.quantity}_${propsHash}.pdf`;
    const labelPath = path.join(PROCESSED_LABELS_DIR, labelFileName);

    console.log(`📄 Checking label file path: ${labelPath}`);

    // Check if label file exists and avoid duplicate entries
    if (
      !fs.existsSync(labelPath) &&
      !Queue.some(
        (q) =>
          q.orderName === order.orderName &&
          q.variantName === order.variantName &&
          q.index === i + 1 &&
          sortedProps(q.properties) === sortedProps(order.properties)
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
    // Label size: 75 x 40 mm
    // Convert mm -> points for PDFKit (1 in = 72 pt, 1 in = 25.4 mm)
    const LABEL_WIDTH_MM = 75;
    const LABEL_HEIGHT_MM = 40;
    const mmToPt = (mm) => (mm / 25.4) * 72;
    const doc = new PDFDocument({
      size: [mmToPt(LABEL_WIDTH_MM), mmToPt(LABEL_HEIGHT_MM)],
      margin: 0,
    });
    const sanitizedOrderName = sanitizeFilename(order.orderName);
    const propsHash = crypto
      .createHash("md5")
      .update(sortedProps(order.properties || []))
      .digest("hex")
      .slice(0, 8);
    const labelFileName = `${sanitizedOrderName}_${order.index}-${order.quantity}_${propsHash}.pdf`;
    const labelPath = path.join(PROCESSED_LABELS_DIR, labelFileName);
    const writeStream = fs.createWriteStream(labelPath);
    doc.pipe(writeStream);

    // Layout calculations based on actual page size so content scales with PDF dimensions
    // Global horizontal shift (points) to move left column and related items to the right
    const GLOBAL_SHIFT_PT = 15;
    const leftColumnStartX = 5 + GLOBAL_SHIFT_PT;
    // Configurable sizes (change these to increase/decrease elements while preserving alignment)
    const LEFT_COLUMN_WIDTH_MM = 20; // width of left column in mm
    const HEADER_FONT_SIZE = 8; // pts for order/product/variant
    const DATE_FONT_SIZE = 7; // pts for date line
    const QR_SIZE_MM = 20; // QR size in mm

    const leftColumnWidth = mmToPt(LEFT_COLUMN_WIDTH_MM);
    const rightColumnX = leftColumnStartX + leftColumnWidth + 5;
    // Shift properties slightly to the right of the right column boundary
    const propertiesOffset = 20; // move properties this many points to the right
    const propertiesX = rightColumnX + propertiesOffset;
    const textWidth = Math.max(50, doc.page.width - propertiesX - 5);
    const maxHeight = Math.max(0, doc.page.height - 10); // leave small bottom margin
    const dateY = Math.max(10, doc.page.height - 10);

    // Spacing control between property lines (keep font size dynamic)
    const lineGap = 0.5; // smaller gap between property lines

    // Compute available vertical space for properties: from top (y=5) to just above date
    const propertiesTopY = 5;
    const propertiesAvailableHeight = Math.max(0, dateY - propertiesTopY - 6);

    // Dynamic font sizing: choose the largest font size that fits all properties
    function chooseBestFontSize(properties) {
      const MIN_FONT = 5; // smallest readable font
      const MAX_FONT = 10; // starting upper bound
      const STEP = 0.25;

      // Use Helvetica for measurements
      doc.font("Helvetica");

      for (let font = MAX_FONT; font >= MIN_FONT; font -= STEP) {
        doc.fontSize(font);
        let totalHeight = 0;
        for (const { key, value } of properties) {
          if (!value) continue;
          const cleanedKey = key.replace(/^Sorte\s*/, "");
          const propertyText = `${cleanedKey}: ${value}`;
          const h = doc.heightOfString(propertyText, { width: textWidth });
          totalHeight += h + lineGap;
          if (totalHeight > propertiesAvailableHeight) break;
        }
        if (totalHeight <= propertiesAvailableHeight) return font;
      }
      return MIN_FONT;
    }

    // Header (order/product/variant) centered in left column
    const headerTopY = 5;
    const headerLineHeight = HEADER_FONT_SIZE + 2;
    doc.font("Helvetica-Bold");
    doc.fontSize(HEADER_FONT_SIZE).text(order.orderName, leftColumnStartX, headerTopY, {
      width: leftColumnWidth,
      align: "center",
    });
    doc.fontSize(HEADER_FONT_SIZE).text(order.productName, leftColumnStartX, headerTopY + headerLineHeight, {
      width: leftColumnWidth,
      align: "center",
    });
    doc.fontSize(HEADER_FONT_SIZE).text(order.variantName, leftColumnStartX, headerTopY + headerLineHeight * 2, {
      width: leftColumnWidth,
      align: "center",
    });

    // QR size and position (centered within left column)
    const qrSizePt = mmToPt(QR_SIZE_MM);
    const qrX = leftColumnStartX + Math.max(0, (leftColumnWidth - qrSizePt) / 2);
    const qrY = headerTopY + headerLineHeight * 3 + 4; // small gap after header
    doc.image(tempQRPath, qrX, qrY, { width: qrSizePt, height: qrSizePt, align: "center" });

    // Date line at bottom-left using DATE_FONT_SIZE
    doc.fontSize(DATE_FONT_SIZE).text(`${order.date}     ${order.index}/${order.quantity}`, leftColumnStartX, dateY);

    // Render properties in the right column
    let yPosition = propertiesTopY;
    const propertyFontSize = chooseBestFontSize(order.properties);
    doc.font("Helvetica").fontSize(propertyFontSize);
    order.properties.forEach(({ key, value }) => {
      if (value) {
        const cleanedKey = key.replace(/^Sorte\s*/, "");
        const propertyText = `${cleanedKey}: ${value}`;
        const textHeight = doc.heightOfString(propertyText, {
          width: textWidth,
        });
        if (yPosition + textHeight <= maxHeight) {
          doc.text(propertyText, propertiesX, yPosition, { width: textWidth });
          yPosition += textHeight + lineGap;
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

const sortedProps = (props) => JSON.stringify([...(props || [])].sort((a, b) => a.key.localeCompare(b.key)));
