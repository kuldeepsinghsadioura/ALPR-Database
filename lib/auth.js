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

export async function initializeAuth() {
  // Skip during build
  if (process.env.NEXT_PHASE === "build") {
    return null;
  }

  try {
    await fs.mkdir(path.dirname(AUTH_FILE), { recursive: true });

    let config;
    try {
      const data = await fs.readFile(AUTH_FILE, "utf-8");
      config = JSON.parse(data);
      return config;
    } catch (error) {
      // Only initialize if file doesn't exist
      if (error.code === "ENOENT") {
        const envPassword = process.env.ADMIN_PASSWORD;
        if (!envPassword) {
          throw new Error(
            "ADMIN_PASSWORD environment variable must be set for initial setup"
          );
        }

        config = {
          password: hashPassword(envPassword),
          apiKey: crypto.randomBytes(32).toString("hex"),
          sessions: {},
        };

        await fs.writeFile(AUTH_FILE, JSON.stringify(config, null, 2));
        return config;
      }
      throw error;
    }
  } catch (error) {
    console.error("Error initializing auth:", error);
    throw error;
  }
}

export async function getAuthConfig() {
  // Skip during build
  if (process.env.NEXT_PHASE === "build") {
    return null;
  }

  try {
    const data = await fs.readFile(AUTH_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return await initializeAuth();
  }
}

export async function updateAuthConfig(newConfig) {
  if (!newConfig) return;
  // Skip during build
  if (process.env.NEXT_PHASE === "build") {
    return;
  }

  try {
    await fs.writeFile(AUTH_FILE, JSON.stringify(newConfig, null, 2));
  } catch (error) {
    console.error("Error updating auth config:", error);
    throw error;
  }
}

export async function createSession(userAgent) {
  const config = await getAuthConfig();
  if (!config) return null;

  // Clean up expired sessions
  const now = Date.now();
  Object.entries(config.sessions).forEach(([id, session]) => {
    if (now > session.expiresAt) {
      delete config.sessions[id];
    }
  });

  // Check for session limit
  const activeSessions = Object.keys(config.sessions).length;
  if (activeSessions >= MAX_SESSIONS_PER_USER) {
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
    userAgent: sanitizeUserAgent(userAgent),
    createdAt: Date.now(),
    lastUsed: Date.now(),
    expiresAt: Date.now() + SESSION_EXPIRATION_TIME,
  };

  await updateAuthConfig(config);
  return sessionId;
}

export async function verifySession(sessionId) {
  const config = await getAuthConfig();
  if (!config) return false;

  const session = config.sessions[sessionId];
  if (!session) return false;

  const now = Date.now();
  if (now > session.expiresAt) {
    delete config.sessions[sessionId];
    await updateAuthConfig(config);
    return false;
  }

  // Update last used time
  session.lastUsed = now;
  await updateAuthConfig(config);
  return true;
}

export async function getSessionInfo(sessionId) {
  const config = await getAuthConfig();
  if (!config) return null;

  const session = config.sessions[sessionId];
  if (!session) return null;

  return {
    userAgent: session.userAgent,
    createdAt: session.createdAt,
    lastUsed: session.lastUsed,
    expiresAt: session.expiresAt,
  };
}

export async function verifyApiKey(apiKey) {
  const config = await getAuthConfig();
  if (!config) return false;

  return apiKey === config.apiKey;
}

// Helper function for verifying credentials (used in login)
export async function verifyCredentials(password) {
  const config = await getAuthConfig();
  if (!config) return false;

  return config.password === hashPassword(password);
}
