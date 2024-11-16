import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";

const CONFIG_FILE = path.join(process.cwd(), "config", "settings.yaml");

// Default configuration (unchanged)
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
    host: "localhost:5432",
    name: "postgres",
    user: "postgres",
    password: "",
  },
  push: {
    server: "",
    credentials: "",
  },
};

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

    if (!fileConfig) {
      const yamlString = yaml.dump(DEFAULT_CONFIG);
      await fs.writeFile(CONFIG_FILE, yamlString, "utf8");
      return DEFAULT_CONFIG;
    }

    // Ensure all sections and fields exist by merging with defaults
    const mergedConfig = {};
    Object.keys(DEFAULT_CONFIG).forEach((section) => {
      mergedConfig[section] = {
        ...DEFAULT_CONFIG[section],
        ...(fileConfig[section] || {}),
      };
    });

    return mergedConfig;
  } catch (error) {
    console.error("Error reading config:", error);
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(newConfig) {
  try {
    await ensureConfigDir();
    const currentConfig = await getConfig();

    // Carefully merge each section, preserving masked values
    const mergedConfig = {};
    Object.keys(currentConfig).forEach((section) => {
      mergedConfig[section] = {};
      Object.keys(currentConfig[section]).forEach((key) => {
        const newValue = newConfig[section]?.[key];
        mergedConfig[section][key] =
          newValue === "••••••••"
            ? currentConfig[section][key]
            : newValue ?? currentConfig[section][key];
      });
    });

    const yamlString = yaml.dump(mergedConfig);
    await fs.writeFile(CONFIG_FILE, yamlString, "utf8");
    return { success: true, data: mergedConfig };
  } catch (error) {
    console.error("Error saving config:", error);
    return { success: false, error: "Failed to save configuration" };
  }
}
