import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const AUTH_FILE = path.join(process.cwd(), "auth", "auth.json");
const MAX_SESSIONS_PER_USER = 5;
const SESSION_EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 hours

export function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function sanitizeUserAgent(userAgent) {
  return userAgent ? userAgent.substring(0, 255) : "Unknown Device";
}

const defaultAuthConfig = {
  password: null,
  apiKey: null,
  sessions: {},
};

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
      // Always check for environment password first
      const envPassword = process.env.ADMIN_PASSWORD;
      if (envPassword) {
        currentConfig.password = hashPassword(envPassword);
      } else if (!currentConfig.password) {
        // Only set default password if no env password and no existing password
        currentConfig.password = hashPassword(defaultAuthConfig.password); // Default fallback password
      }
    }

    // Ensure we have an API key
    if (!currentConfig.apiKey) {
      currentConfig.apiKey = crypto.randomBytes(32).toString("hex");
    }

    // Ensure sessions is an object, not using currentSession anymore
    if (!currentConfig.sessions || typeof currentConfig.sessions !== "object") {
      currentConfig.sessions = {};
    }

    // Remove old currentSession if it exists
    delete currentConfig.currentSession;

    // Clean up any expired sessions
    await cleanupExpiredSessions(currentConfig);

    await fs.writeFile(AUTH_FILE, JSON.stringify(currentConfig, null, 2));

    return currentConfig;
  } catch (error) {
    console.error("Error initializing auth:", error);
    throw error;
  }
}

export async function getAuthConfig() {
  try {
    let config;

    try {
      const data = await fs.readFile(AUTH_FILE, "utf-8");
      config = JSON.parse(data);
    } catch (error) {
      console.log("Auth file not found or invalid, initializing...");
      config = await initializeAuth();
    }

    // // Always override with environment password if available
    // const envPassword = process.env.ADMIN_PASSWORD;
    // if (envPassword) {
    //   config.password = hashPassword(envPassword);
    // }

    // Clean up expired sessions occasionally
    if (Math.random() < 0.1) {
      await cleanupExpiredSessions(config);
    }

    return config;
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

    // Clean up expired sessions
    await cleanupExpiredSessions(config);

    // Check number of active sessions
    const activeSessions = Object.keys(config.sessions).length;
    if (activeSessions >= MAX_SESSIONS_PER_USER) {
      // Remove oldest session if at limit
      const oldestSession = Object.entries(config.sessions).sort(
        ([, a], [, b]) => a.createdAt - b.createdAt
      )[0];
      if (oldestSession) {
        delete config.sessions[oldestSession[0]];
      }
    }

    // Create new session
    const sessionId = crypto.randomBytes(32).toString("hex");
    config.sessions[sessionId] = {
      id: sessionId,
      createdAt: Date.now(),
      lastUsed: Date.now(),
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
    const session = config.sessions[sessionId];

    if (!session) return false;

    if (Date.now() > session.expiresAt) {
      delete config.sessions[sessionId];
      await updateAuthConfig(config);
      return false;
    }

    // Update last used time
    session.lastUsed = Date.now();
    await updateAuthConfig(config);

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
