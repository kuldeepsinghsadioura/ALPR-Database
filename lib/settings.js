import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";

const CONFIG_FILE = path.join(process.cwd(), "config", "settings.yaml");

// Get config from environment variables
function getEnvConfig() {
  return {
    general: {
      maxRecords: parseInt(process.env.MAX_RECORDS) || 2000,
      ignoreNonPlate: process.env.IGNORE_NON_PLATE === "false",
    },
    mqtt: {
      broker: process.env.MQTT_BROKER || "",
      topic: process.env.MQTT_TOPIC || "alpr/plates",
    },
    database: {
      host: process.env.DB_HOST || "db:5432",
      name: process.env.DB_NAME || "postgres",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "",
    },
    push: {
      server: process.env.PUSH_SERVER || "",
      credentials: process.env.PUSH_CREDENTIALS || "",
    },
  };
}

const DEFAULT_CONFIG = getEnvConfig();

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
    return yaml.load(fileContents);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function getConfig() {
  try {
    await ensureConfigDir();
    const fileConfig = await readConfigFile();
    const envConfig = getEnvConfig();

    // If no file exists, create it (but still use env vars for current run)
    if (!fileConfig) {
      // Write empty or default template config
      const templateConfig = {
        general: { maxRecords: 2000, ignoreNonPlate: false },
        mqtt: { broker: "", topic: "alpr/plates" },
        database: { host: "", name: "", user: "", password: "" },
        push: { server: "", credentials: "" },
      };
      const yamlString = yaml.dump(templateConfig);
      await fs.writeFile(CONFIG_FILE, yamlString, "utf8");
      return envConfig;
    }

    // Merge in this priority: ENV vars > file config > defaults
    const mergedConfig = {};
    Object.keys(DEFAULT_CONFIG).forEach((section) => {
      mergedConfig[section] = {
        ...DEFAULT_CONFIG[section], // Default values
        ...(fileConfig[section] || {}), // File values override defaults
        ...Object.fromEntries(
          // ENV values override file
          Object.entries(envConfig[section]).filter(
            ([_, value]) => value !== ""
          )
        ),
      };
    });

    return mergedConfig;
  } catch (error) {
    console.error("Error reading config:", error);
    return getEnvConfig(); // Fallback to env vars on error
  }
}

export async function saveConfig(newConfig) {
  try {
    await ensureConfigDir();
    const currentConfig = await getConfig();
    const envConfig = getEnvConfig();

    // Don't overwrite values set by environment variables
    const mergedConfig = {};
    Object.keys(currentConfig).forEach((section) => {
      mergedConfig[section] = {};
      Object.keys(currentConfig[section]).forEach((key) => {
        const envValue = envConfig[section][key];
        const newValue = newConfig[section]?.[key];

        // Don't save if value is from env var or is masked
        if (envValue !== "" && envValue === currentConfig[section][key]) {
          mergedConfig[section][key] = ""; // Keep empty in file if set by env
        } else {
          mergedConfig[section][key] =
            newValue === "••••••••"
              ? currentConfig[section][key]
              : newValue ?? currentConfig[section][key];
        }
      });
    });

    const yamlString = yaml.dump(mergedConfig);
    await fs.writeFile(CONFIG_FILE, yamlString, "utf8");
    return { success: true, data: await getConfig() }; // Return actual config including env vars
  } catch (error) {
    console.error("Error saving config:", error);
    return { success: false, error: "Failed to save configuration" };
  }
}
