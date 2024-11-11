// app/actions/tagActions.js
'use server'

import { addTag, removeTag } from '@/lib/db'

export async function addTagAction(plateNumber, tagName) {
  await addTag(plateNumber, tagName)
}

export async function removeTagAction(plateNumber, tagName) {
  await removeTag(plateNumber, tagName)
}