'use server'

import { 
  getAvailableTags,
  createTag,
  updateTagColor,
  deleteTag,
  updateKnownPlate,
  removeKnownPlate,
  addTagToPlate,
  removeTagFromPlate,
  getPlateHistory,
  getPlateReads,
  getAllPlates,
  getPlateInsights,
  getKnownPlates,
  togglePlateFlag,
  getMetrics,
  getFlaggedPlates,
  removePlate
} from '@/lib/db';
import { 
  getNotificationPlates as getNotificationPlatesDB,
  addNotificationPlate as addNotificationPlateDB,
  toggleNotification as toggleNotificationDB,
  deleteNotification as deleteNotificationDB
} from '@/lib/db';


import { revalidatePath } from 'next/cache'
import fs from 'fs/promises'
import yaml from 'js-yaml'
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import crypto from 'crypto';
import { getConfig, saveConfig } from '@/lib/settings'
import { getAuthConfig, updateAuthConfig, hashPassword, createSession } from '@/lib/auth'


export async function handleGetTags() {
  return await dbGetTags();
}

export async function handleCreateTag(tagName, color) {
  return await dbCreateTag(tagName, color);
}

export async function handleDeleteTag(tagName) {
  return await dbDeleteTag(tagName);
}

export async function getDashboardMetrics() {
  return await getMetrics();
}


// Tag Management Actions
// export async function getTags() {
//   try {
//     return { success: true, data: await getAvailableTags() };
//   } catch (error) {
//     console.error('Error getting tags:', error);
//     return { success: false, error: 'Failed to get tags' };
//   }
// }

// export async function addTag(formData) {
//   try {
//     const name = formData.get('name');
//     const color = formData.get('color') || '#808080';
//     const tag = await createTag(name, color);
//     return { success: true, data: tag };
//   } catch (error) {
//     console.error('Error creating tag:', error);
//     return { success: false, error: 'Failed to create tag' };
//   }
// }

// export async function removeTag(formData) {
//   try {
//     const name = formData.get('name');
//     await deleteTag(name);
//     return { success: true };
//   } catch (error) {
//     console.error('Error deleting tag:', error);
//     return { success: false, error: 'Failed to delete tag' };
//   }
// }

export async function updateTag(formData) {
  try {
    const name = formData.get('name');
    const color = formData.get('color');
    const tag = await updateTagColor(name, color);
    return { success: true, data: tag };
  } catch (error) {
    console.error('Error updating tag:', error);
    return { success: false, error: 'Failed to update tag color' };
  }
}

export async function deleteTagFromPlate(formData) {
  try {
    const plateNumber = formData.get('plateNumber');
    const tagName = formData.get('tagName');
    await removeTagFromPlate(plateNumber, tagName);
    return { success: true };
  } catch (error) {
    console.error('Error removing tag from plate:', error);
    return { success: false, error: 'Failed to remove tag from plate' };
  }
}

export async function deletePlate(formData) {
  try {
    const plateNumber = formData.get('plateNumber');
    await removeKnownPlate(plateNumber);
    return { success: true };
  } catch (error) {
    console.error('Error removing known plate:', error);
    return { success: false, error: 'Failed to remove plate' };
  }
}

export async function deletePlateFromDB(formData) {
  try {
    const plateNumber = formData.get('plateNumber');
    await removePlate(plateNumber);
    return { success: true };
  } catch (error) {
    console.error('Error removing known plate:', error);
    return { success: false, error: 'Failed to remove plate' };
  }

}


// Data Fetching Actions
export async function getKnownPlatesList() {
  try {
    return { success: true, data: await getKnownPlates() };
  } catch (error) {
    console.error('Error getting known plates:', error);
    return { success: false, error: 'Failed to get known plates' };
  }
}



// Tag Management
export async function getTags() {
  try {
    return { success: true, data: await getAvailableTags() };
  } catch (error) {
    console.error('Error getting tags:', error);
    return { success: false, error: 'Failed to get tags' };
  }
}

export async function addTag(formData) {
  try {
    const name = formData.get('name');
    const color = formData.get('color') || '#808080';
    const tag = await createTag(name, color);
    return { success: true, data: tag };
  } catch (error) {
    console.error('Error creating tag:', error);
    return { success: false, error: 'Failed to create tag' };
  }
}


export async function removeTag(formData) {
  try {
    const name = formData.get('name');
    await deleteTag(name);
    return { success: true };
  } catch (error) {
    console.error('Error deleting tag:', error);
    return { success: false, error: 'Failed to delete tag' };
  }
}

// Plate Management
export async function addKnownPlate(formData) {
  try {
    const plateNumber = formData.get('plateNumber');
    const name = formData.get('name');
    const notes = formData.get('notes') || null;

    const plate = await updateKnownPlate(plateNumber, { name, notes });
    return { success: true, data: plate };
  } catch (error) {
    console.error('Error adding known plate:', error);
    return { success: false, error: 'Failed to add known plate' };
  }
}


// Tag-Plate Management
export async function tagPlate(formData) {
  try {
    const plateNumber = formData.get('plateNumber');
    const tagName = formData.get('tagName');
    await addTagToPlate(plateNumber, tagName);
    return { success: true };
  } catch (error) {
    console.error('Error adding tag to plate:', error);
    return { success: false, error: 'Failed to add tag to plate' };
  }
}

export async function untagPlate(formData) {
  try {
    const plateNumber = formData.get('plateNumber');
    const tagName = formData.get('tagName');
    await removeTagFromPlate(plateNumber, tagName);
    return { success: true };
  } catch (error) {
    console.error('Error removing tag from plate:', error);
    return { success: false, error: 'Failed to remove tag from plate' };
  }
}

// Data Fetching
export async function getPlateHistoryData(plateNumber) {
  try {
    return { success: true, data: await getPlateHistory(plateNumber) };
  } catch (error) {
    console.error('Error getting plate history:', error);
    return { success: false, error: 'Failed to get plate history' };
  }
}

// export async function getLatestPlateReads(page = 1, pageSize = 25) {
//   const result = await getPlateReads({ page, pageSize });

//   // Ensure we return just the data array to maintain compatibility
//   return result.data;
// }



export async function getPlates() {
  try {
    return { success: true, data: await getAllPlates() };
  } catch (error) {
    console.error('Error getting plates database:', error);
    return { success: false, error: 'Failed to get plates database' };
  }
}

export async function getLatestPlateReads({
  page = 1,
  pageSize = 25,
  search = '',
  tag = 'all',
  dateRange = null
} = {}) {
  try {
    const result = await getPlateReads({ 
      page, 
      pageSize,
      filters: {
        plateNumber: search,
        tag: tag !== 'all' ? tag : undefined,
        dateRange
      }
    });

    return {
      data: result.data,
      pagination: {
        page,
        pageSize,
        total: result.pagination.total,
        pageCount: result.pagination.pageCount
      }
    };
  } catch (error) {
    console.error('Error fetching plate reads:', error);
    return {
      data: [],
      pagination: {
        page,
        pageSize,
        total: 0,
        pageCount: 0
      }
    };
  }
}

export async function fetchPlateInsights(formDataOrPlateNumber) {
  try {
    let plateNumber;
    
    if (formDataOrPlateNumber instanceof FormData) {
      plateNumber = formDataOrPlateNumber.get('plateNumber');
    } else {
      plateNumber = formDataOrPlateNumber;
    }
    
    if (!plateNumber) {
      return { success: false, error: 'Plate number is required' };
    }

    const insights = await getPlateInsights(plateNumber);
    
    return {
      success: true,
      data: {
        plateNumber: insights.plate_number,
        knownName: insights.known_name,
        notes: insights.notes,
        summary: {
          firstSeen: insights.first_seen_at,
          lastSeen: insights.last_seen_at,
          totalOccurrences: insights.total_occurrences
        },
        tags: insights.tags || [],
        timeDistribution: insights.time_distribution || [],
        recentReads: insights.recent_reads || []
      }
    };
  } catch (error) {
    console.error('Failed to get plate insights:', error);
    return { 
      success: false, 
      error: 'Failed to get plate insights' 
    };
  }
}

export async function alterPlateFlag(formData) {
  try {
    const plateNumber = formData.get('plateNumber');
    const flagged = formData.get('flagged') === 'true';
    
    const result = await togglePlateFlag(plateNumber, flagged);
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('Failed to toggle plate flag:', error);
    return {
      success: false,
      error: 'Failed to toggle plate flag'
    };
  }
}

export async function getFlagged() {
  try {
    const plates = await getFlaggedPlates();
    return plates;
  } catch (error) {
    console.error('Error fetching flagged plates:', error);
    return [];
  }
}

export async function getNotificationPlates() {
  const plates = await getNotificationPlatesDB();
  return plates;
}

export async function addNotificationPlate(formData) {
  const plateNumber = formData.get('plateNumber');
  return await addNotificationPlateDB(plateNumber);
}

export async function toggleNotification(formData) {
  const plateNumber = formData.get('plateNumber');
  const enabled = formData.get('enabled') === 'true';
  return await toggleNotificationDB(plateNumber, enabled);
}

export async function deleteNotification(formData) {
  const plateNumber = formData.get('plateNumber');
  await deleteNotificationDB(plateNumber);
}



export async function loginAction(formData) {
  const password = formData.get('password');
  if (!password) {
    return { error: 'Password is required' };
  }

  try {
    const config = await getAuthConfig();
    if (hashPassword(password) !== config.password) {
      return { error: 'Invalid password' };
    }

    const sessionId = await createSession();

    // Set the session cookie using the cookies() function
    const cookieStore = cookies(); // cookies() function for setting cookies in server actions
    cookieStore.set('session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return { success: true };
  } catch (error) {
    console.error('Login error:', error);
    return { error: 'An error occurred during login' };
  }
}

// export async function saveConfig(formData) {
//   try {
//     // Transform form data to match config structure
//     const config = {
//       general: {
//         maxRecords: parseInt(formData.maxRecords),
//         ignoreNonPlate: formData.ignoreNonPlate
//       },
//       mqtt: {
//         broker: formData.mqttBroker,
//         topic: formData.mqttTopic
//       },
//       database: {
//         host: formData.dbHost,
//         name: formData.dbName,
//         user: formData.dbUser,
//         password: formData.dbPassword
//       },
//       push: {
//         server: formData.pushServer,
//         credentials: formData.pushCredentials
//       }
//     }

//     const result = await saveSettingsConfig(config)
//     return result
//   } catch (error) {
//     console.error('Error saving config:', error)
//     return { success: false, error: 'Failed to save configuration' }
//   }
// }

export async function getSettings() {
  try {
    const config = await getConfig()
    return { success: true, data: config }
  } catch (error) {
    console.error('Error getting settings:', error)
    return { success: false, error: 'Failed to get settings' }
  }
}

export async function saveSettings(formData) {  // renamed from saveConfig to avoid confusion
  try {
    const config = {
      general: {
        maxRecords: parseInt(formData.maxRecords),
        ignoreNonPlate: formData.ignoreNonPlate
      },
      mqtt: {
        broker: formData.mqttBroker,
        topic: formData.mqttTopic
      },
      database: {
        host: formData.dbHost,
        name: formData.dbName,
        user: formData.dbUser,
        password: formData.dbPassword
      },
      push: {
        server: formData.pushServer,
        credentials: formData.pushCredentials
      }
    }

    const result = await saveConfig(config)
    return result
  } catch (error) {
    console.error('Error saving config:', error)
    return { success: false, error: 'Failed to save configuration' }
  }
}

export async function changePassword(currentPassword, newPassword) {
  try {
    const config = await getAuthConfig()
    
    if (hashPassword(currentPassword) !== config.password) {
      return { success: false, error: 'Current password is incorrect' }
    }
    
    await updateAuthConfig({
      ...config,
      password: hashPassword(newPassword)
    })
    
    return { success: true }
  } catch (error) {
    console.error('Error changing password:', error)
    return { success: false, error: 'Failed to change password' }
  }
}

export async function regenerateApiKey() {
  try {
    const config = await getAuthConfig()
    const newApiKey = crypto.randomBytes(32).toString('hex')
    
    await updateAuthConfig({
      ...config,
      apiKey: newApiKey
    })
    
    return { success: true, apiKey: newApiKey }
  } catch (error) {
    console.error('Error regenerating API key:', error)
    return { success: false, error: 'Failed to regenerate API key' }
  }
}