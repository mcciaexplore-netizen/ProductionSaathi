"""Check a configured database or copy a stopped local factory into empty PostgreSQL."""

import argparse
import json
import re
import sqlite3
from pathlib import Path
from pydantic import ValidationError
from .store import Store, TABLES
from .models import Factory
from .database import DatabaseUnavailable

COPY_TABLES = (
    "entities",
    "versions",
    "audit",
    "users",
    "imports",
    "events",
    "decisions",
    "import_backups",
    "solve_jobs",
    "actual_events",
    "execution_closures",
    "actual_corrections",
)


def migrate_sqlite(source, target):
    if not target.database.postgres:
        raise ValueError(
            "Migration requires PROMISEFLOW_DATABASE_URL pointing to PostgreSQL"
        )
    source = Path(source).resolve()
    if not source.is_file():
        raise ValueError("Source SQLite file does not exist")
    with sqlite3.connect(source.as_uri() + "?mode=ro", uri=True) as src:
        src.row_factory = sqlite3.Row
        src.execute("BEGIN")
        if src.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("Source database integrity check failed")
        meta = dict(src.execute("SELECT key,value FROM meta"))
        if meta.get("schema_version") not in ("4", "5", "6") or meta.get("mode") not in (
            "demo",
            "production",
        ):
            raise ValueError(
                "Source must be an initialized schema-4, schema-5 or schema-6 demo or production database"
            )
        data = {t: [] for t in TABLES}
        for row in src.execute("SELECT kind,body FROM entities"):
            if row["kind"] not in data:
                raise ValueError("Source contains unknown factory entities")
            data[row["kind"]].append(json.loads(row["body"]))
        data["settings"] = json.loads(meta["settings"])
        try:
            Factory.model_validate(data)
        except ValidationError:
            raise ValueError(
                "Source factory failed validation; repair it locally before migrating"
            ) from None
        snapshot = {
            table: [dict(r) for r in src.execute(f"SELECT * FROM {table}")]
            for table in COPY_TABLES
        }
        active = int(meta.get("active", 0))
        if active and not any(
            v["id"] == active and v["activated_at"] for v in snapshot["versions"]
        ):
            raise ValueError("Source active schedule reference is invalid")
        with target.connect() as dst:
            dst.execute("BEGIN IMMEDIATE")
            current_meta = dict(
                (r[0], r[1]) for r in dst.execute("SELECT key,value FROM meta")
            )
            if (
                current_meta.get("revision") != "0"
                or current_meta.get("active") != "0"
                or "mode" in current_meta
            ):
                raise ValueError(
                    "Destination has already been initialized; use a new private schema"
                )
            for table in (*COPY_TABLES, "sessions", "solve_cache"):
                if dst.execute(f"SELECT 1 FROM {table} LIMIT 1").fetchone():
                    raise ValueError("Destination is not empty; no data was replaced")
            for table, rows in snapshot.items():
                if not rows:
                    continue
                columns = list(rows[0])
                if not all(re.fullmatch(r"[a-z_]+", c) for c in columns):
                    raise ValueError("Unexpected source column")
                dst.executemany(
                    f"INSERT INTO {table} ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})",
                    [tuple(r[c] for c in columns) for r in rows],
                )
            dst.executemany(
                "INSERT INTO meta VALUES (?,?) ON CONFLICT (key) DO UPDATE SET value=excluded.value",
                list(meta.items()),
            )
            dst.execute(
                "UPDATE solve_jobs SET status='INTERRUPTED', error='Database migrated; submit again' WHERE status IN ('QUEUED','RUNNING')"
            )
            for table in ("versions", "audit", "decisions", "actual_events"):
                dst.execute(
                    f"SELECT setval(pg_get_serial_sequence(?, 'id'), COALESCE(MAX(id),1), MAX(id) IS NOT NULL) FROM {table}",
                    (f'"{target.database.schema}"."{table}"',),
                )
            counts = {
                table: dst.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                for table in COPY_TABLES
            }
            if any(counts[t] != len(snapshot[t]) for t in COPY_TABLES):
                raise ValueError("Migration row-count verification failed")
            target.audit(
                dst,
                "database administrator",
                "Migrated SQLite to PostgreSQL",
                {"tables": counts, "active_version": active, "sessions_copied": False},
            )
            return {"mode": meta["mode"], "active_version": active, "counts": counts}


LOCKED_OUT_ROLES = ("PUBLIC", "anon", "authenticated", "service_role")


def rls_report(db, schema):
    """Confirm the lockdown applied by Database.initialize() actually holds on
    the live server, rather than trusting it was never reverted by a manual
    grant made through the Supabase dashboard after the fact."""
    disabled = [
        r[0]
        for r in db.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname=? AND rowsecurity=false",
            (schema,),
        )
    ]
    grants = [
        {"grantee": r[0], "table": r[1], "privilege": r[2]}
        for r in db.execute(
            "SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants"
            " WHERE table_schema=? AND grantee=ANY(?)",
            (schema, list(LOCKED_OUT_ROLES)),
        )
    ]
    return {
        "rls_disabled_tables": disabled,
        "unexpected_grants": grants,
        "rls_locked_down": not disabled and not grants,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["check", "migrate"])
    parser.add_argument(
        "--source", help="Stopped local SQLite database to copy; never modified"
    )
    args = parser.parse_args()
    try:
        store = Store()
        if args.action == "migrate":
            if not args.source:
                raise ValueError("Specify --source with the stopped local database")
            print(json.dumps(migrate_sqlite(args.source, store), indent=2))
        else:
            with store.connect() as db:
                db.execute("SELECT 1").fetchone()
                report = {
                    "connected": True,
                    "database": "postgresql" if store.database.postgres else "sqlite",
                    "schema": (
                        store.database.schema if store.database.postgres else None
                    ),
                    "revision": store.revision(db),
                    "active_version": store.active_id(db),
                }
                if store.database.postgres:
                    report.update(rls_report(db, store.database.schema))
                print(json.dumps(report, indent=2))
    except (DatabaseUnavailable, ValueError, sqlite3.Error):
        raise SystemExit(
            "Database setup failed. Check the server-only connection, permissions and source/destination requirements. No credentials are printed."
        ) from None


if __name__ == "__main__":
    main()
