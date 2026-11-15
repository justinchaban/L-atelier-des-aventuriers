import type { LibraryContentId, LibraryFingerprint } from './Library';

export interface LibraryDiagnostic {
  severity:'error'|'warning'|'info';
  code:string;
  message:string;
  contentId?:LibraryContentId;
  revisionHash?:LibraryFingerprint;
  importId?:LibraryFingerprint;
}
export interface LibraryDiagnosticReport {
  checkedAt:string;
  diagnostics:LibraryDiagnostic[];
  counts:{error:number;warning:number;info:number};
  structurallyValid:boolean;
}
export interface LibraryDeletionReference {
  source:'active-dependency'|'revision'|'conversion'|'original';
  ownerId?:LibraryContentId;
  ownerName:string;
  revisionHash?:LibraryFingerprint;
  importId?:LibraryFingerprint;
  pointer?:string;
  message:string;
}
export interface LibraryDeletionImpact {
  contentId:LibraryContentId;
  name:string;
  allowed:boolean;
  reasons:string[];
  references:LibraryDeletionReference[];
  dependents:{id:LibraryContentId;name:string;direct:boolean}[];
  revisionsToDelete:LibraryFingerprint[];
  conversionsToDelete:number;
  dependenciesToDelete:number;
  originalsPreserved:number;
}
