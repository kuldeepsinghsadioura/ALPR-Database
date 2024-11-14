import { getConfig } from "@/lib/settings";

// Cache for config to avoid repeated disk reads
let configCache = null;
let configLastLoaded = 0;
const CONFIG_CACHE_TTL = 60000; // 1 minute cache

async function getPushoverConfig() {
  // Refresh cache if expired or doesn't exist
  if (!configCache || Date.now() - configLastLoaded > CONFIG_CACHE_TTL) {
    const config = await getConfig();
    configCache = config.notifications?.pushover;
    configLastLoaded = Date.now();
  }

  if (!configCache?.app_token || !configCache?.user_key) {
    throw new Error("Pushover configuration is missing or incomplete");
  }

  return configCache;
}

async function buildNotificationPayload(plateNumber, config) {
  const basePayload = {
    token: config.app_token,
    user: config.user_key,
    title: config.title || "ALPR Alert",
    priority: config.priority || 1,
    message: `Plate ${plateNumber} has been detected`,
  };

  // Add optional configuration if present
  if (config.sound) basePayload.sound = config.sound;
  if (config.device) basePayload.device = config.device;
  if (config.url) basePayload.url = config.url;

  return basePayload;
}

export async function sendPushoverNotification(
  plateNumber,
  customMessage = null
) {
  try {
    const config = await getPushoverConfig();

    if (!plateNumber) {
      throw new Error("Plate number is required");
    }

    const payload = await buildNotificationPayload(plateNumber, config);

    // Override default message if custom message provided
    if (customMessage) {
      payload.message = customMessage;
    }

    const response = await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pushover API error: ${errorText}`);
    }

    const result = await response.json();
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Notification error:", error);
    return {
      success: false,
      error: error.message || "Failed to send notification",
    };
  }
}

// Utility to validate Pushover configuration
export async function validatePushoverConfig() {
  try {
    const config = await getPushoverConfig();

    const response = await fetch(
      "https://api.pushover.net/1/users/validate.json",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: config.app_token,
          user: config.user_key,
        }),
      }
    );

    const result = await response.json();
    return {
      success: response.ok,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}
