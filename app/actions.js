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
  getMetrics
} from '@/lib/db';
import fs from 'fs/promises'
import yaml from 'js-yaml'

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

export async function getLatestPlateReads() {
  try {
    return { success: true, data: await getPlateReads() };
  } catch (error) {
    console.error('Error getting plate reads:', error);
    return { success: false, error: 'Failed to get plate reads' };
  }
}

export async function getPlates() {
  try {
    return { success: true, data: await getAllPlates() };
  } catch (error) {
    console.error('Error getting plates database:', error);
    return { success: false, error: 'Failed to get plates database' };
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

const CONFIG_FILE = './config.yaml'

export async function getConfig() {
  try {
    const fileContents = await fs.readFile(CONFIG_FILE, 'utf8')
    return yaml.load(fileContents)
  } catch (error) {
    console.error('Error reading config file:', error)
    return {}
  }
}

export async function saveConfig(config) {
  try {
    const yamlString = yaml.dump(config)
    await fs.writeFile(CONFIG_FILE, yamlString, 'utf8')
    return { success: true }
  } catch (error) {
    console.error('Error writing config file:', error)
    return { success: false, error: error.message }
  }
}