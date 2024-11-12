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
  getPlateReads
} from '@/lib/db';


export async function handleGetTags() {
  return await dbGetTags();
}

export async function handleCreateTag(tagName, color) {
  return await dbCreateTag(tagName, color);
}

export async function handleDeleteTag(tagName) {
  return await dbDeleteTag(tagName);
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