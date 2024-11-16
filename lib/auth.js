import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const AUTH_FILE = path.join(process.cwd(), "auth", "auth.json");
const MAX_SESSIONS_PER_USER = 5;
const SESSION_EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 hours

export function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Add a helper function to sanitize user agent strings
function sanitizeUserAgent(userAgent) {
  return userAgent ? userAgent.substring(0, 255) : "Unknown Device";
}

// Initialize auth file with default values
const defaultAuthConfig = {
  password: null,
  apiKey: null,
  sessions: {},
};

// Function to clean up expired sessions
async function cleanupExpiredSessions(config) {
  const now = Date.now();
  let cleanupPerformed = false;

  for (const [sessionId, session] of Object.entries(config.sessions)) {
    if (now > session.expiresAt) {
      delete config.sessions[sessionId];
      cleanupPerformed = true;
    }
  }

  if (cleanupPerformed) {
    await updateAuthConfig(config);
  }

  return cleanupPerformed;
}

export async function initializeAuth() {
  try {
    await fs.mkdir(path.dirname(AUTH_FILE), { recursive: true });

    let currentConfig;

    try {
      // Try to read existing config
      const data = await fs.readFile(AUTH_FILE, "utf-8");
      currentConfig = JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is invalid, start with defaults
      currentConfig = { ...defaultAuthConfig };
    }

    // Check if we need to set/update the password
    const envPassword = process.env.ADMIN_PASSWORD;
    if (
      envPassword &&
      (!currentConfig.password || process.env.FORCE_PASSWORD_UPDATE)
    ) {
      currentConfig.password = hashPassword(envPassword);
    }

    // Ensure we have an API key
    if (!currentConfig.apiKey) {
      currentConfig.apiKey = crypto.randomBytes(32).toString("hex");
    }

    // Ensure we have a sessions object
    if (!currentConfig.sessions) {
      currentConfig.sessions = {};
    }

    // Clean up any expired sessions during initialization
    await cleanupExpiredSessions(currentConfig);

    // Write the config back to file
    await fs.writeFile(AUTH_FILE, JSON.stringify(currentConfig, null, 2));

    // console.log("Auth system initialized successfully");
    return currentConfig;
  } catch (error) {
    console.error("Error initializing auth:", error);
    throw error;
  }
}

export async function getAuthConfig() {
  try {
    // Try to read the file
    try {
      const data = await fs.readFile(AUTH_FILE, "utf-8");
      const config = JSON.parse(data);

      // Clean up expired sessions when reading config
      // Only perform cleanup occasionally to reduce disk writes
      if (Math.random() < 0.1) {
        // 10% chance of cleanup on each read
        await cleanupExpiredSessions(config);
      }

      return config;
    } catch (error) {
      // If file doesn't exist or is invalid, initialize it
      console.log("Auth file not found or invalid, initializing...");
      return await initializeAuth();
    }
  } catch (error) {
    console.error("Error reading auth config:", error);
    throw error;
  }
}

export async function updateAuthConfig(newConfig) {
  try {
    await fs.writeFile(AUTH_FILE, JSON.stringify(newConfig, null, 2));
  } catch (error) {
    console.error("Error updating auth config:", error);
    throw error;
  }
}

export async function createSession() {
  try {
    const config = await getAuthConfig();

    // Either use existing session or create new one
    if (config.currentSession && config.currentSession.expiresAt > Date.now()) {
      return config.currentSession.id;
    }

    const sessionId = crypto.randomBytes(32).toString("hex");
    config.currentSession = {
      id: sessionId,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_EXPIRATION_TIME,
    };

    await updateAuthConfig(config);
    return sessionId;
  } catch (error) {
    console.error("Error creating session:", error);
    throw error;
  }
}

export async function verifySession(sessionId) {
  try {
    const config = await getAuthConfig();
    const session = config.currentSession;

    if (!session || session.id !== sessionId) return false;
    if (Date.now() > session.expiresAt) {
      config.currentSession = null;
      await updateAuthConfig(config);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error verifying session:", error);
    return false;
  }
}

export async function getSessionInfo(sessionId) {
  try {
    const config = await getAuthConfig();
    const session = config.sessions[sessionId];

    if (!session) return null;

    return {
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      lastUsed: session.lastUsed,
      expiresAt: session.expiresAt,
    };
  } catch (error) {
    console.error("Error getting session info:", error);
    return null;
  }
}
