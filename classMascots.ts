import classMascotsData from './public/data/class_mascots.json';

export interface ClassEndingInfo {
  present: string;
  imperfective: string;
  perfective: string;
  imperative: string;
  infinitive: string;
}

export interface ClassMascotInfo {
  present: string;
  definition: string;
  corpus_id: number;
  endings?: ClassEndingInfo;
}

export const CLASS_MASCOTS: Record<string, ClassMascotInfo> = classMascotsData as Record<string, ClassMascotInfo>;

export function getClassMascot(className: string | undefined): string | undefined {
  if (!className) return undefined;
  if (CLASS_MASCOTS[className]) return CLASS_MASCOTS[className].present;
  const baseClass = className.split('[')[0];
  if (CLASS_MASCOTS[baseClass]) return CLASS_MASCOTS[baseClass].present;
  return undefined;
}

export function getClassEndings(className: string | undefined): ClassEndingInfo | undefined {
  if (!className) return undefined;
  if (CLASS_MASCOTS[className]?.endings) return CLASS_MASCOTS[className].endings;
  const baseClass = className.split('[')[0];
  if (CLASS_MASCOTS[baseClass]?.endings) return CLASS_MASCOTS[baseClass].endings;
  return undefined;
}
