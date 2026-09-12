import classMascotsData from './public/data/class_mascots.json';
import aspectClassesData from './public/data/aspect_classes.json';

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

export interface AspectVariantInfo {
  name: string;
  endings: ClassEndingInfo;
}

export interface AspectSubclassInfo {
  name: string;
  sub_key: string;
  preconditions: string[];
  endings: ClassEndingInfo;
  variants: AspectVariantInfo[];
}

export interface AspectClassInfo {
  name: string;
  mascot?: ClassMascotInfo | null;
  subclasses: AspectSubclassInfo[];
}

export interface AspectClassesData {
  classes: AspectClassInfo[];
  subclass_to_class: Record<string, string>;
}

export const CLASS_MASCOTS: Record<string, ClassMascotInfo> = classMascotsData as Record<string, ClassMascotInfo>;
export const ASPECT_CLASSES: AspectClassesData = aspectClassesData as AspectClassesData;

export function getParentClassName(classNameOrSubclass: string | undefined): string {
  if (!classNameOrSubclass) return '';
  const clean = classNameOrSubclass.split('[')[0];
  if (ASPECT_CLASSES.subclass_to_class[clean]) {
    return ASPECT_CLASSES.subclass_to_class[clean];
  }
  if (ASPECT_CLASSES.classes.some(c => c.name === clean)) {
    return clean;
  }
  return clean;
}

export function getAspectClass(classNameOrSubclass: string | undefined): AspectClassInfo | undefined {
  if (!classNameOrSubclass) return undefined;
  const parentName = getParentClassName(classNameOrSubclass);
  return ASPECT_CLASSES.classes.find(c => c.name === parentName);
}

export function getAspectSubclass(subclassName: string | undefined): AspectSubclassInfo | undefined {
  if (!subclassName) return undefined;
  const clean = subclassName.split('[')[0];
  const parent = getAspectClass(clean);
  return parent?.subclasses.find(s => s.name === clean);
}

export function getAllAspectClasses(): AspectClassInfo[] {
  return ASPECT_CLASSES.classes;
}

export function getClassMascot(className: string | undefined): string | undefined {
  if (!className) return undefined;
  if (CLASS_MASCOTS[className]) return CLASS_MASCOTS[className].present;
  const baseClass = className.split('[')[0];
  if (CLASS_MASCOTS[baseClass]) return CLASS_MASCOTS[baseClass].present;
  const parent = getParentClassName(className);
  if (CLASS_MASCOTS[parent]) return CLASS_MASCOTS[parent].present;
  return undefined;
}

export function getClassEndings(className: string | undefined): ClassEndingInfo | undefined {
  if (!className) return undefined;
  if (CLASS_MASCOTS[className]?.endings) return CLASS_MASCOTS[className].endings;
  const baseClass = className.split('[')[0];
  if (CLASS_MASCOTS[baseClass]?.endings) return CLASS_MASCOTS[baseClass].endings;
  const sub = getAspectSubclass(baseClass);
  if (sub?.endings) return sub.endings;
  return undefined;
}
