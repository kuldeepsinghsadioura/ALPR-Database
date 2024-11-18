import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";

const CONFIG_FILE = path.join(process.cwd(), "config", "settings.yaml");

// Default configuration with fallback values
const DEFAULT_CONFIG = {
  general: {
    maxRecords: 2000,
    ignoreNonPlate: false,
  },
  mqtt: {
    broker: "",
    topic: "alpr/plates",
  },
  database: {
    host: "db:5432",
    name: "postgres",
    user: "postgres",
    password: "password",
  },
  push: {
    server: "",
    credentials: "",
  },
};

// Get initial values from environment
function getInitialEnvConfig() {
  return {
    general: {
      maxRecords: process.env.MAX_RECORDS
        ? parseInt(process.env.MAX_RECORDS)
        : DEFAULT_CONFIG.general.maxRecords,
      ignoreNonPlate: process.env.IGNORE_NON_PLATE
        ? process.env.IGNORE_NON_PLATE === "true"
        : DEFAULT_CONFIG.general.ignoreNonPlate,
    },
    mqtt: {
      broker: process.env.MQTT_BROKER || DEFAULT_CONFIG.mqtt.broker,
      topic: process.env.MQTT_TOPIC || DEFAULT_CONFIG.mqtt.topic,
    },
    database: {
      host: process.env.DB_HOST || DEFAULT_CONFIG.database.host,
      name: process.env.DB_NAME || DEFAULT_CONFIG.database.name,
      user: process.env.DB_USER || DEFAULT_CONFIG.database.user,
      password: process.env.DB_PASSWORD || DEFAULT_CONFIG.database.password,
    },
    push: {
      server: process.env.PUSH_SERVER || DEFAULT_CONFIG.push.server,
      credentials:
        process.env.PUSH_CREDENTIALS || DEFAULT_CONFIG.push.credentials,
    },
  };
}

async function ensureConfigDir() {
  const configDir = path.dirname(CONFIG_FILE);
  try {
    await fs.access(configDir);
  } catch {
    await fs.mkdir(configDir, { recursive: true });
  }
}

async function readConfigFile() {
  try {
    const fileContents = await fs.readFile(CONFIG_FILE, "utf8");
    console.log("Reading config file:", fileContents);
    const config = yaml.load(fileContents);
    console.log("Parsed config:", config);
    return config;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("No config file found");
      return null;
    }
    throw error;
  }
}

async function initializeConfigFile() {
  console.log("Initializing config file with environment values");
  const initialConfig = getInitialEnvConfig();
  const yamlString = yaml.dump(initialConfig);
  await ensureConfigDir();
  await fs.writeFile(CONFIG_FILE, yamlString, "utf8");
  return initialConfig;
}

export async function getConfig() {
  try {
    let fileConfig = await readConfigFile();

    // If no config file exists, initialize it with environment/default values
    if (!fileConfig) {
      console.log("Creating initial config file from environment variables");
      fileConfig = await initializeConfigFile();
      return fileConfig;
    }

    // If config file exists, use it with defaults as fallback
    const finalConfig = {
      general: { ...DEFAULT_CONFIG.general, ...fileConfig.general },
      mqtt: { ...DEFAULT_CONFIG.mqtt, ...fileConfig.mqtt },
      database: { ...DEFAULT_CONFIG.database, ...fileConfig.database },
      push: { ...DEFAULT_CONFIG.push, ...fileConfig.push },
    };

    console.log("Using existing config file:", finalConfig);
    return finalConfig;
  } catch (error) {
    console.error("Error reading config:", error);
    return getInitialEnvConfig(); // Fallback to env/defaults only on error
  }
}

// Helper function to check if this is the first run
export async function isFirstRun() {
  try {
    await fs.access(CONFIG_FILE);
    return false;
  } catch {
    return true;
  }
}

export async function saveConfig(newConfig) {
  try {
    // Ensure all required fields exist by merging with defaults
    const configToSave = {
      general: {
        ...DEFAULT_CONFIG.general,
        ...newConfig.general,
      },
      mqtt: {
        ...DEFAULT_CONFIG.mqtt,
        ...newConfig.mqtt,
      },
      database: {
        ...DEFAULT_CONFIG.database,
        ...newConfig.database,
      },
      push: {
        ...DEFAULT_CONFIG.push,
        ...newConfig.push,
      },
    };

    await ensureConfigDir();
    const yamlString = yaml.dump(configToSave);
    await fs.writeFile(CONFIG_FILE, yamlString, "utf8");

    return { success: true, data: configToSave };
  } catch (error) {
    console.error("Error saving config:", error);
    return { success: false, error: "Failed to save configuration" };
  }
}
