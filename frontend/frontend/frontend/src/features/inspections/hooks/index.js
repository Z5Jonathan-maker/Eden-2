/**
 * Inspections Feature - Hooks Index
 * 
 * Export all inspection-related hooks for easy importing
 */

export { useCameraStream, CAMERA_ERRORS } from './useCameraStream';
export { usePhotoCapture } from './usePhotoCapture';
export { useInspectionPhotos } from './useInspectionPhotos';
export { useInspectionSession } from './useInspectionSession';

// Re-export for convenience
export { default as useCameraStreamHook } from './useCameraStream';
export { default as usePhotoCaptureHook } from './usePhotoCapture';
export { default as useInspectionPhotosHook } from './useInspectionPhotos';
export { default as useInspectionSessionHook } from './useInspectionSession';
