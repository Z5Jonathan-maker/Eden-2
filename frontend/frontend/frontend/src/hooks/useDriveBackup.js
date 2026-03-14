/**
 * useDriveBackup — Google Drive backup orchestration for claim files.
 *
 * Fetches a claim's photos + documents, downloads each as a blob,
 * and uploads to Google Drive via the existing integration endpoint.
 * Structured naming: Eden_{ClaimNumber}_Photos_{filename}, etc.
 */
import { useState, useCallback, useRef } from 'react';
import { apiGet, apiUpload, API_URL, getAuthToken } from '@/lib/api';
import { getStorageItem, setStorageItem } from '@/lib/core';
import { toast } from 'sonner';

const BACKUP_STATUS_KEY = 'drive_backup_status';
const UPLOAD_DELAY_MS = 200; // Rate-limit delay between Drive uploads

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function useDriveBackup() {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });
  const abortRef = useRef(false);

  const getBackupStatus = useCallback((claimId) => {
    const allStatus = getStorageItem(BACKUP_STATUS_KEY, {});
    return allStatus[claimId] || null;
  }, []);

  const setBackupStatus = useCallback((claimId, status) => {
    const allStatus = getStorageItem(BACKUP_STATUS_KEY, {});
    allStatus[claimId] = { ...status, updatedAt: new Date().toISOString() };
    setStorageItem(BACKUP_STATUS_KEY, allStatus);
  }, []);

  /**
   * Backup all files for a claim to Google Drive.
   */
  const backupClaim = useCallback(async (claimId, claimNumber) => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    abortRef.current = false;

    try {
      // Phase 1: Collect all claim files
      setProgress({ current: 0, total: 0, phase: 'Collecting files...' });

      const [photosRes, docsRes] = await Promise.all([
        apiGet(`/api/inspections/claim/${claimId}/photos`, { cache: false }),
        apiGet(`/api/claims/${claimId}/documents`, { cache: false }).catch(() => ({ ok: false })),
      ]);

      const photos = photosRes.ok ? (photosRes.data?.photos || []) : [];
      const documents = docsRes.ok ? (Array.isArray(docsRes.data) ? docsRes.data : docsRes.data?.documents || []) : [];

      const allFiles = [
        ...photos.map((p) => ({
          type: 'photo',
          id: p.id,
          name: p.filename || `photo_${p.id}.jpg`,
          url: p.url?.startsWith('http') ? p.url : `/api/inspections/photos/${p.id}/image`,
          subfolder: 'Photos',
        })),
        ...documents.map((d) => ({
          type: 'document',
          id: d.id,
          name: d.name || d.filename || `doc_${d.id}`,
          url: d.url || `/api/claims/${claimId}/files/${d.id}/download`,
          subfolder: 'Documents',
        })),
      ];

      if (allFiles.length === 0) {
        toast.info('No files to backup for this claim');
        setIsBackingUp(false);
        return;
      }

      const total = allFiles.length;
      setProgress({ current: 0, total, phase: 'Uploading to Drive...' });

      const results = { success: 0, failed: 0 };
      const prefix = `Eden_${claimNumber || claimId}`;

      // Phase 2: Upload each file to Drive
      for (let i = 0; i < allFiles.length; i++) {
        if (abortRef.current) break;

        const file = allFiles[i];
        const displayName = file.name.length > 30 ? file.name.slice(0, 27) + '...' : file.name;
        setProgress({ current: i + 1, total, phase: `${displayName} (${i + 1}/${total})` });

        try {
          // Fetch file blob from backend using proper auth header
          const token = getAuthToken();
          const fileUrl = file.url.startsWith('http') ? file.url : `${API_URL}${file.url}`;

          const response = await fetch(fileUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            credentials: 'include',
          });

          if (!response.ok) {
            results.failed++;
            continue;
          }

          const blob = await response.blob();

          // Upload to Drive with structured naming
          const driveName = `${prefix}_${file.subfolder}_${file.name}`;
          const formData = new FormData();
          formData.append('file', blob, driveName);

          const uploadRes = await apiUpload('/api/integrations/google/drive/upload', formData);

          if (uploadRes.ok) {
            results.success++;
          } else {
            results.failed++;
          }
        } catch {
          results.failed++;
        }

        // Rate limit
        if (i < allFiles.length - 1) await sleep(UPLOAD_DELAY_MS);
      }

      // Save status
      setBackupStatus(claimId, {
        lastBackup: new Date().toISOString(),
        totalFiles: total,
        successCount: results.success,
        failedCount: results.failed,
        claimNumber,
      });

      if (abortRef.current) {
        toast.info(`Backup cancelled. ${results.success} files uploaded before cancellation.`);
      } else if (results.failed === 0) {
        toast.success(`All ${results.success} files backed up to Google Drive`);
      } else {
        toast.warning(`Backed up ${results.success}/${total} files. ${results.failed} failed.`);
      }
    } catch (err) {
      toast.error(`Backup failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsBackingUp(false);
      setProgress({ current: 0, total: 0, phase: '' });
    }
  }, [isBackingUp, setBackupStatus]);

  const cancelBackup = useCallback(() => {
    abortRef.current = true;
  }, []);

  return {
    backupClaim,
    cancelBackup,
    isBackingUp,
    progress,
    getBackupStatus,
  };
}
