import { normalizeBookId } from '../data/books';
import { isJsonRecord, detectContent } from './contentImporter';
import { createLibraryIdentity, fingerprintLibraryJson, fingerprintLibraryText, serializeLibraryJson } from './libraryIdentity';
import { libraryIdentityInput } from './libraryImport';
import type { LibrarySnapshot } from './libraryImport';
import { LIBRARY_BACKUP_FORMAT, LIBRARY_BACKUP_VERSION } from '../models/LibraryBackup';
import type { LibraryBackup, LibraryBackupBody, LibraryBackupCounts } from '../models/LibraryBackup';
import type { LibraryDependency, LibraryIdentityInput } from '../models/Library';
import { LIBRARY_STORES, validateLibraryRecord } from '../services/libraryDatabase';

export class LibraryBackupError extends Error {
  constructor(public readonly code: 'invalid-data' | 'incompatible' | 'integrity', message: string) { super(message); this.name = 'LibraryBackupError'; }
}
const fail = (message: string): never => { throw new LibraryBackupError('invalid-data', message); };
const requireValue = (condition: unknown, message: string): void => { if (!condition) fail(message); };
const string = (value: unknown): value is string => typeof value === 'string';
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(string);
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const date = (value: unknown): boolean => string(value) && Number.isFinite(Date.parse(value));
const integer = (value: unknown): boolean => Number.isSafeInteger(value) && Number(value) >= 0;
const hash = (value: unknown): boolean => string(value) && /^sha256:v1:[a-f0-9]{64}$/.test(value);
const abilities = (value: unknown): boolean => Array.isArray(value) && value.every(item => ['str','dex','con','int','wis','cha'].includes(item));
const record = isJsonRecord;
const optional = (object: Record<string, unknown>, key: string, check: (value: unknown) => boolean): boolean => !Object.hasOwn(object,key) || check(object[key]);
const list = (value: unknown, check: (item: unknown) => boolean): boolean => Array.isArray(value) && value.every(check);

function identityFromId(id: unknown): boolean {
  if (!string(id) || !id.startsWith('library:v1:')) return false;
  try {
    const parts = JSON.parse(id.slice(11));
    if (!Array.isArray(parts) || parts.length !== 9) return false;
    const [provider, namespace, category, name, source, cls, sub, level, originalKey] = parts;
    if (!string(namespace)) return false;
    const input = { provider, namespace: namespace || undefined, category, name, source,
      ...(cls === null ? {} : { classOwner: { name: cls[0], source: cls[1] } }),
      ...(sub === null ? {} : { subclassOwner: { name: sub[0], source: sub[1] } }),
      ...(level === null ? {} : { level }), ...(originalKey === null ? {} : { originalKey }) };
    const result = createLibraryIdentity(input as LibraryIdentityInput);
    return result.success && result.identity.id === id;
  } catch { return false; }
}
const choice = (value: unknown): boolean => record(value) && string(value.id) && string(value.name) && string(value.description) && integer(value.count) && list(value.options, item => record(item) && string(item.id) && string(item.name) && optional(item,'description',string));
const metadata = (value: unknown): boolean => record(value) && ['srd','5etools','homebrew','custom'].includes(String(value.provider)) && string(value.originalName) && string(value.originalSource) && optional(value,'originalReference',string) && optional(value,'hasUnresolvedCopy',item=>typeof item==='boolean');
const feature = (value: unknown): boolean => record(value) && string(value.id) && string(value.name) && string(value.description) && Number.isInteger(value.levelRequired) && Number(value.levelRequired)>=1 && Number(value.levelRequired)<=20 &&
  optional(value,'choices',item=>list(item,choice)) && optional(value,'bookId',string) && optional(value,'importMetadata',metadata) && optional(value,'structuredEntries',Array.isArray);
const subclass = (value: unknown): boolean => record(value) && string(value.id) && string(value.name) && string(value.description) && string(value.bookId) && ['2014','2024'].includes(String(value.ruleset)) && list(value.features,feature) && optional(value,'shortName',string) && optional(value,'importMetadata',metadata) && optional(value,'structuredEntries',Array.isArray);

/** Contrôle de structure des résultats dérivés, sans réexécuter ni modifier les règles. */
function payload(value: unknown): boolean {
  if (!record(value) || !record(value.data)) return false;
  const data = value.data;
  if (!string(data.id) || !string(data.name)) return false;
  switch (value.category) {
    case 'classFeature': case 'subclassFeature': return feature(data);
    case 'subclass': return subclass(data);
    case 'class': return string(data.description) && string(data.bookId) && ['2014','2024'].includes(String(data.ruleset)) && [6,8,10,12].includes(Number(data.hitDie)) && number(data.hitDie) && abilities(data.primaryAbilities) && abilities(data.savingThrows) &&
      list(data.proficiencies,item=>record(item)&&['armor','weapon','tool','savingThrow','skill'].includes(String(item.type))&&string(item.id)) && list(data.features,feature) && list(data.subclasses,subclass) && Number.isInteger(data.subclassLevel) && Number(data.subclassLevel)>=1 && Number(data.subclassLevel)<=20 && optional(data,'skillChoices',choice) && optional(data,'importMetadata',metadata) && optional(data,'structuredEntries',Array.isArray) &&
      optional(data,'spellcasting',item=>record(item)&&abilities([item.ability])&&['full','half','third','pact'].includes(String(item.type))&&['prepared','known'].includes(String(item.preparation)));
    case 'background': return string(data.description) && string(data.bookId) && data.ruleset==='2024' && abilities(data.abilityOptions) && strings(data.skillProficiencies) && string(data.originFeatId) && optional(data,'toolProficiency',string) && optional(data,'equipment',strings);
    case 'feat': return string(data.description) && string(data.bookId) && data.ruleset==='2024' && ['origin','general','fighting-style','epic-boon'].includes(String(data.category)) && optional(data,'repeatable',item=>typeof item==='boolean') &&
      optional(data,'prerequisites',item=>record(item)&&optional(item,'minimumLevel',integer)&&optional(item,'ability',a=>abilities([a]))&&optional(item,'minimumAbilityScore',number)&&optional(item,'requiredFeatIds',strings)) &&
      optional(data,'abilityIncrease',item=>record(item)&&abilities(item.abilities)&&number(item.amount)&&number(item.maximum));
    case 'equipment': return string(data.bookId) && (Object.hasOwn(data,'attackType') ?
      ['simple','martial'].includes(String(data.category)) && ['melee','ranged'].includes(String(data.attackType)) && string(data.damage) && string(data.damageType) && strings(data.properties) && ['cleave','graze','nick','push','sap','slow','topple','vex'].includes(String(data.mastery)) :
      ['weapon','armor','shield','tool','adventuring-gear','focus','pack','other'].includes(String(data.category)) && optional(data,'description',string)&&optional(data,'weight',number)&&optional(data,'costGP',number));
    case 'species': {
      const trait = (item: unknown): boolean => record(item)&&string(item.id)&&string(item.name)&&string(item.description)&&optional(item,'levelRequired',integer)&&optional(item,'effects',effects=>list(effects,effect=>{
        if (!record(effect)) return false;
        switch(effect.type) {
          case 'darkvision': return number(effect.range);
          case 'resistance': return ['acid','bludgeoning','cold','fire','force','lightning','necrotic','piercing','poison','psychic','radiant','slashing','thunder'].includes(String(effect.damageType));
          case 'speed': return ['walk','fly','swim','climb'].includes(String(effect.movement))&&number(effect.value);
          case 'proficiency': return string(effect.proficiencyId);
          case 'bonus': return abilities([effect.ability])&&number(effect.value);
          default:return false;
        }
      }));
      return string(data.bookId)&&string(data.description)&&['2014','2024'].includes(String(data.ruleset))&&number(data.speed)&&list(data.sizes,item=>['Small','Medium'].includes(String(item)))&&list(data.traits,trait)&&optional(data,'choices',items=>list(items,item=>record(item)&&string(item.id)&&string(item.name)&&string(item.description)&&integer(item.count)&&list(item.options,option=>record(option)&&string(option.id)&&string(option.name)&&string(option.description)&&optional(option,'traits',traits=>list(traits,trait)))));
    }
    default: return false;
  }
}

export function libraryBackupCounts(data: LibrarySnapshot): LibraryBackupCounts {
  return { imports:data.imports.length, contents:data.contents.length, revisions:data.revisions.length, dependencies:data.dependencies.length };
}

/** Validation de cache réutilisable en consultation ; ne certifie aucune mécanique. */
export function validateLibraryConversion(value: unknown, category: string, contentId: string, revisionHash: string): void {
  requireValue(record(value) && value.recordVersion === 1 && value.contentId === contentId && value.revisionHash === revisionHash, 'Conversion incohérente.');
  const conversion = value as Record<string, unknown>;
  requireValue(record(conversion.converter) && string(conversion.converter.id) && conversion.converter.id.trim() && string(conversion.converter.version) && conversion.converter.version.trim(), 'Convertisseur invalide.');
  requireValue(Array.isArray(conversion.dependencies), 'Dépendances de conversion invalides.');
  for (const edge of conversion.dependencies as unknown[]) validateLibraryRecord('dependencies', edge);
  requireValue(record(conversion.result), 'Résultat invalide.');
  const result = conversion.result as Record<string, unknown>;
  if (result.status === 'converted') requireValue(strings(result.warnings) && payload(result.payload) && record(result.payload) && result.payload.category === category, 'Données converties invalides.');
  else requireValue(['unresolved', 'unsupported', 'failed'].includes(String(result.status)) && strings(result.issues), 'État de conversion invalide.');
}
/** Trie seulement les collections des magasins ; l'ordre interne des tableaux est préservé. */
export function canonicalLibrarySnapshot(data: LibrarySnapshot): LibrarySnapshot {
  const sorted = <T>(items: T[]): T[] => [...items].sort((a,b)=> {
    const first=serializeLibraryJson(a), second=serializeLibraryJson(b);
    return first<second?-1:first>second?1:0;
  });
  return {imports:sorted(data.imports),contents:sorted(data.contents),revisions:sorted(data.revisions),dependencies:sorted(data.dependencies)};
}

/** Validation complète des structures, identités, originaux, empreintes et liens. Aucune écriture. */
export async function validateLibraryBackupData(value: unknown): Promise<LibrarySnapshot> {
  if (!record(value) || Object.keys(value).sort().join(',') !== [...LIBRARY_STORES].sort().join(',')) fail('Les quatre magasins sont obligatoires.');
  const data=value as unknown as LibrarySnapshot;
  for (const store of LIBRARY_STORES) {
    requireValue(Array.isArray(data[store]),`Magasin invalide : ${store}.`);
    for (const item of data[store]) {
      try { validateLibraryRecord(store,item); } catch { fail(`Enregistrement invalide dans ${store}.`); }
    }
  }
  const unique = <T>(items:T[],key:(item:T)=>string,label:string):Map<string,T> => {
    const map=new Map<string,T>();for (const item of items) { const id=key(item);requireValue(!map.has(id),`Clé dupliquée dans ${label}.`);map.set(id,item); }return map;
  };
  const documents=unique(data.imports,item=>item.id,'imports');
  const contents=unique(data.contents,item=>item.identity.id,'contents');
  const revisions=unique(data.revisions,item=>JSON.stringify([item.contentId,item.revisionHash]),'revisions');
  unique(data.dependencies,item=>JSON.stringify([item.ownerId,item.targetId,item.relation]),'dependencies');
  const parsed=new Map<string,Record<string,unknown>>();
  for(const document of data.imports) {
    requireValue(date(document.importedAt)&&document.filenames.length>0&&document.filenames.every(name=>name.trim()&&!/[\\/]/.test(name)),'Métadonnées de fichier invalides.');
    requireValue(await fingerprintLibraryText(document.originalText)===document.id,'Empreinte du fichier original incorrecte.');
    let original:unknown;try { original=JSON.parse(document.originalText); }catch { fail('Fichier JSON original corrompu.'); }
    requireValue(record(original),'Racine du fichier original invalide.');parsed.set(document.id,original as Record<string,unknown>);
  }
  for(const item of data.contents) {
    requireValue(date(item.createdAt)&&date(item.updatedAt),'Dates de contenu invalides.');
    requireValue(revisions.has(JSON.stringify([item.identity.id,item.activeRevision])),'Révision active manquante.');
  }
  const checkDependency=(edge:unknown,expectedOwner?:string):void=> {
    try { validateLibraryRecord('dependencies',edge); }catch { fail('Dépendance invalide.'); }
    const dependency=edge as LibraryDependency;
    requireValue(identityFromId(dependency.ownerId)&&identityFromId(dependency.targetId)&&contents.has(dependency.ownerId),'Identité de dépendance invalide.');
    if(expectedOwner) requireValue(dependency.ownerId===expectedOwner,'Propriétaire de dépendance incohérent.');
    // Les cibles non résolues sont légitimes, mais toute révision épinglée doit être conservée.
    if(dependency.revisionHash) requireValue(revisions.has(JSON.stringify([dependency.targetId,dependency.revisionHash])),'Révision de dépendance épinglée manquante.');
  };
  for(const revision of data.revisions) {
    requireValue(contents.has(revision.contentId)&&date(revision.createdAt),'Révision orpheline ou date invalide.');
    const identity=contents.get(revision.contentId)!.identity;
    for(const origin of revision.origins) {
      requireValue(documents.has(origin.location.importId),'Fichier original de provenance manquant.');
      requireValue(optional(origin as unknown as Record<string,unknown>,'originalReference',string),'Référence originale invalide.');
      const root=parsed.get(origin.location.importId)!;
      const tokens=origin.location.pointer.split('/').slice(1).map(token=>token.replace(/~1/g,'/').replace(/~0/g,'~'));
      requireValue(tokens.length===2&&tokens[0]===origin.originalKey&&/^(0|[1-9]\d*)$/.test(tokens[1]),'Pointeur original incompatible.');
      const entries=root[tokens[0]];
      requireValue(Object.hasOwn(root,tokens[0])&&Array.isArray(entries),'Catégorie originale absente.');
      const original=(entries as unknown[])[Number(tokens[1])];
      requireValue(record(original),'Entrée originale manquante.');
      requireValue(detectContent(root).some(group=>group.originalKey===origin.originalKey&&group.category===identity.category),'Catégorie de provenance incohérente.');
      const result=createLibraryIdentity(libraryIdentityInput(original as Record<string,unknown>,identity.category,origin.originalKey,origin.provider,origin.namespace||undefined));
      requireValue(result.success&&result.identity.id===revision.contentId,'Identité différente de l’entrée originale.');
      if(result.success)for(const key of Object.keys(result.identity) as (keyof typeof result.identity)[]) {
        requireValue(Object.hasOwn(identity,key)&&serializeLibraryJson(identity[key])===serializeLibraryJson(result.identity[key]),'Métadonnées d’identité non canoniques.');
      }
      requireValue(origin.originalName===(original as Record<string,unknown>).name&&origin.originalSource===(original as Record<string,unknown>).source&&origin.bookId===identity.bookId&&normalizeBookId(origin.originalSource)===origin.bookId,'Provenance originale incohérente.');
      requireValue(await fingerprintLibraryJson(original)===revision.revisionHash,'Empreinte de révision incorrecte.');
    }
    if(revision.dependencies!==undefined) { requireValue(Array.isArray(revision.dependencies),'Dépendances de révision invalides.');for(const edge of revision.dependencies) checkDependency(edge,revision.contentId); }
    if(revision.conversions!==undefined) {
      requireValue(Array.isArray(revision.conversions),'Conversions invalides.');
      const seen=new Set<string>();
      for(const conversion of revision.conversions) {
        requireValue(record(conversion)&&conversion.recordVersion===1&&conversion.contentId===revision.contentId&&conversion.revisionHash===revision.revisionHash,'Conversion incohérente.');
        requireValue(record(conversion.converter)&&string(conversion.converter.id)&&conversion.converter.id.trim()&&string(conversion.converter.version)&&conversion.converter.version.trim(),'Version de convertisseur invalide.');
        const key=serializeLibraryJson(conversion.converter);requireValue(!seen.has(key),'Convertisseur dupliqué.');seen.add(key);
        requireValue(Array.isArray(conversion.dependencies),'Dépendances de conversion invalides.');for(const edge of conversion.dependencies) checkDependency(edge);
        requireValue(record(conversion.result),'Résultat de conversion invalide.');
        if(conversion.result.status==='converted') requireValue(strings(conversion.result.warnings)&&payload(conversion.result.payload)&&conversion.result.payload.category===identity.category,'Données converties invalides.');
        else requireValue(['unresolved','unsupported','failed'].includes(conversion.result.status)&&strings(conversion.result.issues),'État de conversion invalide.');
      }
    }
  }
  for(const edge of data.dependencies) checkDependency(edge);
  for(const content of data.contents) {
    const active=revisions.get(JSON.stringify([content.identity.id,content.activeRevision]))!;
    if(active.dependencies!==undefined) {
      const sorted=(items:LibraryDependency[])=>items.map(serializeLibraryJson).sort();
      requireValue(JSON.stringify(sorted(active.dependencies))===JSON.stringify(sorted(data.dependencies.filter(edge=>edge.ownerId===content.identity.id))), 'Dépendances actives incohérentes.');
    }
  }
  return data;
}

export async function createLibraryBackup(data: LibrarySnapshot, exportedAt = new Date().toISOString()): Promise<string> {
  // Passer par JSON fige une copie indépendante sans toucher à l'état du navigateur.
  const captured=JSON.parse(serializeLibraryJson(data));
  await validateLibraryBackupData(captured);
  requireValue(date(exportedAt),'Date d’export invalide.');
  const body: LibraryBackupBody = {format:LIBRARY_BACKUP_FORMAT,formatVersion:LIBRARY_BACKUP_VERSION,exportedAt,
    compatibility:{databaseName:'atelier-aventuriers:library',databaseVersion:1,recordVersion:1,identityVersion:1,canonicalization:'atelier-json-v1'},data:canonicalLibrarySnapshot(captured)};
  const backup:LibraryBackup={...body,integrity:{algorithm:'SHA-256',value:await fingerprintLibraryJson(body)}};
  return serializeLibraryJson(backup);
}

export async function parseLibraryBackup(text: string): Promise<LibraryBackup> {
  let value:unknown;try { value=JSON.parse(text); }catch { fail('Le fichier ne contient pas une sauvegarde JSON valide.'); }
  if(!record(value)||value.format!==LIBRARY_BACKUP_FORMAT||value.formatVersion!==1||!record(value.compatibility)||
      value.compatibility.databaseName!=='atelier-aventuriers:library'||value.compatibility.databaseVersion!==1||value.compatibility.recordVersion!==1||value.compatibility.identityVersion!==1||value.compatibility.canonicalization!=='atelier-json-v1') {
    throw new LibraryBackupError('incompatible','Format ou version de sauvegarde incompatible.');
  }
  requireValue(Object.keys(value).sort().join(',')==='compatibility,data,exportedAt,format,formatVersion,integrity','Champs de sauvegarde invalides.');
  requireValue(date(value.exportedAt)&&record(value.integrity)&&Object.keys(value.integrity).sort().join(',')==='algorithm,value'&&value.integrity.algorithm==='SHA-256'&&hash(value.integrity.value),'Métadonnées d’intégrité invalides.');
  const { integrity, ...body }=value;
  if(await fingerprintLibraryJson(body)!==(integrity as Record<string,unknown>).value) throw new LibraryBackupError('integrity','Empreinte SHA-256 incorrecte : sauvegarde altérée.');
  await validateLibraryBackupData(value.data);
  return value as unknown as LibraryBackup;
}
