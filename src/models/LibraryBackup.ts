import type { LibraryFingerprint } from './Library';
import type { LibrarySnapshot } from '../engine/libraryImport';

export const LIBRARY_BACKUP_FORMAT = 'atelier-aventuriers:library-backup' as const;
export const LIBRARY_BACKUP_VERSION = 1 as const;
export interface LibraryBackupBody {
  format: typeof LIBRARY_BACKUP_FORMAT;
  formatVersion: typeof LIBRARY_BACKUP_VERSION;
  exportedAt: string;
  compatibility: {
    databaseName: 'atelier-aventuriers:library';
    databaseVersion: 1;
    recordVersion: 1;
    identityVersion: 1;
    canonicalization: 'atelier-json-v1';
  };
  data: LibrarySnapshot;
}
export interface LibraryBackup extends LibraryBackupBody {
  integrity: { algorithm: 'SHA-256'; value: LibraryFingerprint };
}
export type LibraryBackupCounts = Record<keyof LibrarySnapshot, number>;
export interface LibraryRestorePreview {
  backup: LibraryBackup;
  counts: LibraryBackupCounts;
  destinationEmpty: boolean;
}
