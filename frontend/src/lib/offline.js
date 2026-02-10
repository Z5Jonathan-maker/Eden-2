import { set, get, del, keys } from 'idb-keyval';

const PHOTOS_KEY_PREFIX = 'rapid_capture_photos_';

export const OfflineService = {
  /**
   * Save a photo (blob + metadata) to IndexedDB
   * @param {string} claimId 
   * @param {object} photo 
   */
  async savePhoto(claimId, photo) {
    if (!claimId || !photo) return;
    const key = `${PHOTOS_KEY_PREFIX}${claimId}`;
    const currentPhotos = (await get(key)) || [];
    
    // Check if photo already exists
    const index = currentPhotos.findIndex(p => p.id === photo.id);
    if (index >= 0) {
      currentPhotos[index] = photo;
    } else {
      currentPhotos.push(photo);
    }
    
    await set(key, currentPhotos);
  },

  /**
   * Get all photos for a claim
   * @param {string} claimId 
   * @returns {Promise<Array>}
   */
  async getPhotos(claimId) {
    if (!claimId) return [];
    const key = `${PHOTOS_KEY_PREFIX}${claimId}`;
    return (await get(key)) || [];
  },

  /**
   * Delete a specific photo
   * @param {string} claimId 
   * @param {string} photoId 
   */
  async deletePhoto(claimId, photoId) {
    if (!claimId || !photoId) return;
    const key = `${PHOTOS_KEY_PREFIX}${claimId}`;
    const currentPhotos = (await get(key)) || [];
    const newPhotos = currentPhotos.filter(p => p.id !== photoId);
    await set(key, newPhotos);
  },

  /**
   * Clear all photos for a claim (e.g., after successful upload)
   * @param {string} claimId 
   */
  async clearPhotos(claimId) {
    if (!claimId) return;
    const key = `${PHOTOS_KEY_PREFIX}${claimId}`;
    await del(key);
  },
  
  /**
   * Get all claims that have offline photos
   * @returns {Promise<Array<string>>}
   */
  async getClaimsWithOfflineData() {
    const allKeys = await keys();
    return allKeys
      .filter(k => typeof k === 'string' && k.startsWith(PHOTOS_KEY_PREFIX))
      .map(k => k.replace(PHOTOS_KEY_PREFIX, ''));
  }
};
