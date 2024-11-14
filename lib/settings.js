// lib/settings.js
import fs from 'fs/promises'
import path from 'path'
import yaml from 'js-yaml'
import { z } from 'zod'

// Use path.join to create proper file path relative to project root
const CONFIG_FILE = path.join(process.cwd(), 'config', 'settings.yaml')

// Ensure config directory exists
async function ensureConfigDir() {
  const configDir = path.dirname(CONFIG_FILE)
  try {
    await fs.access(configDir)
  } catch {
    await fs.mkdir(configDir, { recursive: true })
  }
}

// Default configuration
const DEFAULT_CONFIG = {
  general: {
    maxRecords: 200,
    ignoreNonPlate: false
  },
  mqtt: {
    broker: '',
    topic: 'alpr/plates'
  },
  database: {
    host: 'localhost',
    name: 'postgres',
    user: 'postgres',
    password: ''
  },
  push: {
    server: '',
    credentials: ''
  }
}

// Helper function to read the config file
async function readConfigFile() {
  try {
    const fileContents = await fs.readFile(CONFIG_FILE, 'utf8')
    return yaml.load(fileContents)
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return null to handle in getConfig
      return null
    }
    console.error('Error reading config file:', error)
    throw error
  }
}

export async function getConfig() {
  try {
    await ensureConfigDir()
    
    const fileConfig = await readConfigFile()
    if (!fileConfig) {
      // File doesn't exist or is empty, create it with default config
      const yamlString = yaml.dump(DEFAULT_CONFIG)
      await fs.writeFile(CONFIG_FILE, yamlString, 'utf8')
      return DEFAULT_CONFIG
    }

    // Merge with defaults to ensure all fields exist
    return { ...DEFAULT_CONFIG, ...fileConfig }
  } catch (error) {
    console.error('Error reading config:', error)
    console.warn('Could not load database config, using defaults')
    return DEFAULT_CONFIG
  }
}

export async function saveConfig(newConfig) {
  try {
    await ensureConfigDir()
    
    // Merge with existing config to prevent losing settings
    const currentConfig = await getConfig()
    const mergedConfig = {
      ...currentConfig,
      ...newConfig
    }

    // Remove any sensitive fields that were sent as "••••••••"
    Object.keys(mergedConfig).forEach(section => {
      if (typeof mergedConfig[section] === 'object') {
        Object.keys(mergedConfig[section]).forEach(key => {
          if (mergedConfig[section][key] === '••••••••') {
            mergedConfig[section][key] = currentConfig[section][key]
          }
        })
      }
    })

    const yamlString = yaml.dump(mergedConfig)
    await fs.writeFile(CONFIG_FILE, yamlString, 'utf8')
    return { success: true, data: mergedConfig }
  } catch (error) {
    console.error('Error saving config:', error)
    return { 
      success: false, 
      error: 'Failed to save configuration'
    }
  }
}