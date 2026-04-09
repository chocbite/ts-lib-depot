import { ok } from "@chocbite/ts-lib-result";
import state, {
  type StateLocalRESW,
  type StateObjectHelper,
} from "@chocbite/ts-lib-state";

/**
 * Augmentable interface for declaring depot value types.
 *
 * To declare a type, use module augmentation:
 * ```ts
 * declare module "@chocbite/ts-lib-depot" {
 *   interface DepotTypeMap {
 *     color: string;
 *     size: number;
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface DepotTypeMap {}

/** Resolves to declared type names, or falls back to `string` when no types are declared. */
type DepotTypeName = keyof DepotTypeMap extends never
  ? string
  : keyof DepotTypeMap;

/** Maps a type name to its value type. Falls back to `unknown` for undeclared types. */
type DepotValueForType<T extends DepotTypeName> =
  T extends keyof DepotTypeMap ? DepotTypeMap[T] : unknown;

/** A single registered entry in the depot. */
interface DepotEntry<T extends DepotTypeName = DepotTypeName> {
  readonly value: DepotValueForType<T>;
  readonly type: T;
}

type DepotGroupEntries = Record<string, DepotEntry>;

/** A named group of depot entries. */
interface DepotGroup {
  /** The name of this group. */
  readonly name: string;
  /** The full path of this group. */
  readonly path: string;
  /** Reactive state containing all entries in this group as a path-keyed record. */
  readonly entries: StateLocalRESW<
    DepotGroupEntries,
    StateObjectHelper<DepotGroupEntries>,
    DepotGroupEntries
  >;
  /** Register a value at the given path with a declared type. */
  register<T extends DepotTypeName>(
    path: string,
    value: DepotValueForType<T>,
    type: T,
  ): void;
  /** Unregister the value at the given path. */
  unregister(path: string): void;
  /** Get the entry at the given path, or undefined if not registered. */
  get<T extends DepotTypeName>(path: string): DepotEntry<T> | undefined;
  /** Check if a path is registered. */
  has(path: string): boolean;
}

type DepotGroupMap = Record<string, DepotGroup>;

/** The main depot instance. */
interface Depot {
  /** Get or create a named group. Repeated calls with the same name return the same group. */
  group(name: string): DepotGroup;
  /** Reactive state containing all groups as a name-keyed record. */
  readonly groups: StateLocalRESW<
    DepotGroupMap,
    StateObjectHelper<DepotGroupMap>,
    DepotGroupMap
  >;
  /** Get the full path for a group and entry path. */
  path(group: string, entry: string): string;
}

function upsert<T>(
  obj: { get: Record<string, T>; add(key: string, val: T): void; change(key: string, val: T): void },
  key: string,
  value: T,
): void {
  if (obj.get[key] !== undefined) {
    obj.change(key, value);
  } else {
    obj.add(key, value);
  }
}

function create_group(name: string, parent_path: string): DepotGroup {
  const owner = state.resw<
    DepotGroupEntries,
    DepotGroupEntries,
    StateObjectHelper<DepotGroupEntries>
  >(state.o.help(ok<DepotGroupEntries>({})));

  const path = parent_path ? `${parent_path}/${name}` : name;

  const group: DepotGroup = {
    name,
    path,
    entries: owner.state as DepotGroup["entries"],
    register<T extends DepotTypeName>(
      entry_path: string,
      value: DepotValueForType<T>,
      type: T,
    ): void {
      upsert(owner.object, entry_path, { value, type } as DepotEntry);
    },
    unregister(entry_path: string): void {
      if (owner.object.get[entry_path] !== undefined) {
        owner.object.remove(entry_path);
      }
    },
    get<T extends DepotTypeName>(
      entry_path: string,
    ): DepotEntry<T> | undefined {
      const entries = owner.object.get;
      const entry = entries[entry_path];
      if (entry === undefined) return undefined;
      return entry as DepotEntry<T>;
    },
    has(entry_path: string): boolean {
      return owner.object.get[entry_path] !== undefined;
    },
  };

  return group;
}

function create_depot(): Depot {
  const groups_owner = state.resw<
    DepotGroupMap,
    DepotGroupMap,
    StateObjectHelper<DepotGroupMap>
  >(state.o.help(ok<DepotGroupMap>({})));

  const group_instances = new Map<string, DepotGroup>();

  const depot: Depot = {
    groups: groups_owner.state as Depot["groups"],
    group(name: string): DepotGroup {
      let grp = group_instances.get(name);
      if (grp) return grp;

      grp = create_group(name, "");
      group_instances.set(name, grp);
      groups_owner.object.add(name, grp);
      return grp;
    },
    path(group: string, entry: string): string {
      return `${group}/${entry}`;
    },
  };

  return depot;
}

const depot: Depot = create_depot();

export {
  depot,
  type Depot,
  type DepotGroup,
  type DepotEntry,
  type DepotTypeMap,
  type DepotTypeName,
  type DepotValueForType,
};
export default depot;
