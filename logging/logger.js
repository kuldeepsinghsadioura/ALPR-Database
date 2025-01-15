import fs from "fs";
import path from "path";
import winston from "winston";
import Transport from "winston-transport";

class LimitedLineTransport extends Transport {
  constructor(opts) {
    super(opts);
    this.filename = opts.filename;
    this.maxLines = opts.maxLines;
  }

  log(info, callback) {
    try {
      let lines = [];
      if (fs.existsSync(this.filename)) {
        lines = fs
          .readFileSync(this.filename, "utf8")
          .split("\n")
          .filter(Boolean);
      }
      lines.push(JSON.stringify(info));

      // Keep only last maxLines
      if (lines.length > this.maxLines) {
        lines = lines.slice(-this.maxLines);
      }

      fs.writeFileSync(this.filename, lines.join("\n") + "\n");
    } catch (error) {
      console.error("Error writing to log file:", error);
    }
    callback();
  }
}

if (typeof window === "undefined" && !global.__loggerInitialized) {
  const LOG_DIR = path.join(process.cwd(), "logs");
  const LOG_FILE = path.join(LOG_DIR, "app.log");
  const MAX_LINES = 1000;

  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (error) {
    console.error("Failed to create logs directory:", error);
  }

  // Configure winston with JSON format
  const logger = winston.createLogger({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new LimitedLineTransport({
        filename: LOG_FILE,
        maxLines: MAX_LINES,
      }),
    ],
  });

  // Store original console methods
  const originalMethods = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
  };

  // Override console methods
  console.log = (...args) => {
    logger.info(args.join(" "));
    originalMethods.log(...args);
  };

  console.error = (...args) => {
    logger.error(args.join(" "));
    originalMethods.error(...args);
  };

  console.warn = (...args) => {
    logger.warn(args.join(" "));
    originalMethods.warn(...args);
  };

  global.__loggerInitialized = true;
}
