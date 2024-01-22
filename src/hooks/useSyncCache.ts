import { Database } from "../../vendor/sqlite3@0.10.0/mod.ts";
import * as pkgutils from "../utils/pkg.ts";
import usePantry from "./usePantry.ts";
import useConfig from "./useConfig.ts";

export default async function() {
  if (Deno.build.os == 'windows') return

  const path = useConfig().cache.join('pantry.db').rm()  // delete it first so pantry instantiation doesn't use cache
  const { ls, ...pantry } = usePantry()

  const sqlite3 = (await install_sqlite())?.string
  if (!sqlite3) return
  const db = new Database(path.string, { sqlite3 })

  // unique or don’t insert what is already there or just dump tables first perhaps

  try {
    await db.transaction(async () => {
      db.exec(`
        DROP TABLE IF EXISTS provides;
        DROP TABLE IF EXISTS dependencies;
        DROP TABLE IF EXISTS companions;
        DROP TABLE IF EXISTS runtime_env;
        CREATE TABLE provides (
          project TEXT,
          program TEXT
        );
        CREATE TABLE dependencies (
          project TEXT,
          pkgspec TEXT
        );
        CREATE TABLE companions (
          project TEXT,
          pkgspec TEXT
        );
        CREATE TABLE runtime_env (
          project TEXT,
          envline TEXT
        );
        CREATE INDEX idx_project ON provides(project);
        CREATE INDEX idx_program ON provides(program);
        CREATE INDEX idx_project_dependencies ON dependencies(project);
        CREATE INDEX idx_project_companions ON companions(project);
        `);

      for await (const pkg of ls()) {
        if (!pkg.path.string.startsWith(pantry.prefix.string)) {
          // don’t cache PKGX_PANTRY_PATH additions
          continue;
        }

        try {
          const project = pantry.project(pkg.project)
          const [programs, deps, companions, yaml] = await Promise.all([
            project.provides(),
            project.runtime.deps(),
            project.companions(),
            project.yaml()
          ])

          for (const program of programs) {
            db.exec(`INSERT INTO provides (project, program) VALUES ('${pkg.project}', '${program}');`);
          }

          for (const dep of deps) {
            db.exec(`INSERT INTO dependencies (project, pkgspec) VALUES ('${pkg.project}', '${pkgutils.str(dep)}')`);
          }

          for (const companion of companions) {
            db.exec(`INSERT INTO companions (project, pkgspec) VALUES ('${pkg.project}', '${pkgutils.str(companion)}')`);
          }

          for (const [key, value] of Object.entries(yaml.runtime?.env ?? {})) {
            db.exec(`INSERT INTO runtime_env (project, envline) VALUES ('${pkg.project}', '${key}=${value}')`);
          }
        } catch {
          console.warn("corrupt yaml", pkg.path)
        }
      }
    })()
  } catch (err) {
    path.rm()
    throw err
  } finally {
    db.close();
  }
}

export async function provides(program: string) {
  const db = await _db()
  if (!db) return
  try {
   return db.sql`SELECT project FROM provides WHERE program = ${program}`.map(x => x.project);
  } finally {
    db.close()
  }
}

export async function dependencies(project: string) {
  const db = await _db()
  if (!db) return
  try {
    return db.sql`SELECT pkgspec FROM dependencies WHERE project = ${project}`.map(x => pkgutils.parse(x.pkgspec));
  } finally {
    db.close()
  }
}

export async function completion(prefix: string) {
  const db = await _db()
  try {
    return db?.prepare(`SELECT program FROM provides WHERE program LIKE '${prefix}%'`).value<[string]>()!;
  } finally {
    db?.close()
  }
}

/// is the cache available?
export function available() {
  if (Deno.build.os == 'windows') {
    return false
  } else {
    const path = useConfig().cache.join('pantry.db')
    return path.isFile()
  }
}

export async function companions(project: string) {
  const db = await _db()
  if (!db) return
  try {
    return db.sql`SELECT pkgspec FROM companions WHERE project = ${project}`.map(x => pkgutils.parse(x.pkgspec));
  } finally {
    db.close()
  }
}

export async function runtime_env(project: string) {
  const db = await _db()
  if (!db) return
  try {
    const rv: Record<string, string> = {}
    for (const {envline: line} of db.sql`SELECT envline FROM runtime_env WHERE project = ${project}`) {
      const [key, ...rest] = line.split("=")
      rv[key] = rest.join('=')
    }
    return rv
  } finally {
    db.close()
  }
}

import useCellar from "./useCellar.ts"

async function _db() {
  if (Deno.build.os == 'windows') return
  const path = useConfig().cache.join('pantry.db')
  if (!path.isFile()) return
  const sqlite = await useCellar().has({ project: "sqlite.org", constraint: new semver.Range('*') })
  if (!sqlite) return
  const ext = host().platform == 'darwin' ? 'dylib' : 'so'
  return new Database(path.string, {readonly: true, sqlite3: sqlite.path.join(`lib/libsqlite3.${ext}`).string})
}

import install from "../porcelain/install.ts"
import host from "../utils/host.ts";
import Path from "../utils/Path.ts";
import { semver } from "../../mod.ts";

async function install_sqlite(): Promise<Path | undefined> {
  const foo = await install("sqlite.org")
  for (const bar of foo) {
    if (bar.pkg.project == 'sqlite.org') {
      const ext = host().platform == 'darwin' ? 'dylib' : 'so'
      return bar.path.join(`lib/libsqlite3.${ext}`)
    }
  }
}
