#!/usr/bin/env python3
"""Storage tests for
  supabase/migrations/20260920120000_storage_social_videos.sql

The social-videos bucket must be a one-way street: the public (anon, and any
signed-in user) may READ an object and may do nothing else. Every write path
into the bucket is supposed to be a signed upload URL minted server-side by the
n8n-data `reel-upload-url` action, and a signed upload is authorised by its own
token rather than by RLS — so the absence of an INSERT policy is the control,
not an oversight.

Runs against a LOCAL, disposable PostgreSQL 17 (never production):

  PSQL=/opt/homebrew/opt/postgresql@17/bin/psql PGHOST=/tmp/rcpg PGPORT=55432 \\
    python3 supabase/tests/db/social_videos_test.py [social_videos.sql]

The database `rc_social_videos_test` is rebuilt from bootstrap.sql,
prod_structure.sql and the migration under test. Exit 0 = all pass.

NOTE ON THE STAND-IN. prod_structure.sql carries a minimal storage schema, not
Supabase's real one, so `file_size_limit` and `allowed_mime_types` are asserted
as bucket METADATA here. Enforcing them is Storage's job, not Postgres's; what
this file can and does prove is the RLS half — who may touch storage.objects.
"""
import json
import os
import subprocess
import sys
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
MIG = os.path.join(ROOT, 'supabase', 'migrations')
PSQL = os.environ.get('PSQL', 'psql')
DB = os.environ.get('RC_SOCIAL_VIDEOS_DB', 'rc_social_videos_test')
SOCIAL_SQL = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    MIG, '20260920120000_storage_social_videos.sql')

BUCKET = 'social-videos'


def args(db):
    return [PSQL, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1',
            '-U', os.environ.get('PGUSER', 'postgres'), '-d', db]


def run(sql, db=DB):
    p = subprocess.run(args(db), input=sql, capture_output=True, text=True)
    return p.returncode, p.stdout.strip(), p.stderr.strip()


def q(sql):
    rc, out, err = run(sql)
    if rc != 0:
        raise RuntimeError(f'psql failed: {err[:300]}')
    return out


def run_file(path):
    p = subprocess.run(args(DB) + ['-f', path], capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f'{os.path.basename(path)} failed: {p.stderr.strip()[:500]}')


def as_role(role, sql, user=None):
    """Runs sql as anon/authenticated/service_role with Supabase-like claims."""
    claims = {'role': role}
    if user:
        claims['sub'] = user
        claims['email'] = 'someone@example.test'
    prefix = (
        f"do $cfg$ begin perform set_config('request.jwt.claims', "
        f"'{json.dumps(claims)}', false); end $cfg$;\nset role {role};\n"
    )
    return run(prefix + sql)


# ── Fixtures ─────────────────────────────────────────────────────────────────

USER = str(uuid.uuid4())
EXISTING = f'reels/2026-09-20-seeded1.mp4'


def setup():
    run('drop database if exists ' + DB, db='postgres')
    run('create database ' + DB, db='postgres')
    run_file(os.path.join(HERE, 'bootstrap.sql'))
    run_file(os.path.join(HERE, 'prod_structure.sql'))
    run_file(SOCIAL_SQL)
    # Re-running the migration must be a no-op, not an error. Every migration
    # in this repo is applied by hand against production, sometimes twice.
    run_file(SOCIAL_SQL)


def seed():
    # One object already in the bucket, written as the service role — this is
    # what a completed signed upload leaves behind.
    q(f"insert into storage.objects (bucket_id, name) values ('{BUCKET}', '{EXISTING}');")


# ── Tests ────────────────────────────────────────────────────────────────────

RESULTS = []


def test(name):
    def deco(fn):
        def wrapper():
            try:
                fn()
                RESULTS.append((name, True, ''))
            except AssertionError as e:
                RESULTS.append((name, False, str(e)))
            except Exception as e:  # noqa: BLE001
                RESULTS.append((name, False, f'error: {str(e)[:300]}'))
        wrapper.test_name = name
        return wrapper
    return deco


def denied(res):
    """A write that RLS refused: either an error, or 0 rows affected."""
    rc, out, err = res
    if rc != 0:
        return 'permission denied' in err or 'row-level security' in err
    # UPDATE/DELETE under RLS silently match nothing rather than erroring.
    return out.strip() in ('', '0')


WRITE_ROLES = ['anon', 'authenticated']


@test('the bucket exists, is public-read and declares video/mp4 + 50 MB')
def t_bucket_settings():
    row = q(
        "select public, file_size_limit, coalesce(array_to_string(allowed_mime_types, ','), '') "
        f"from storage.buckets where id = '{BUCKET}';"
    )
    assert row, 'the social-videos bucket was not created'
    public, limit, mimes = row.split('|')
    assert public == 't', f'bucket must be public-read, got public={public}'
    assert limit == '52428800', f'size limit must be 50 MB (52428800), got {limit}'
    assert mimes == 'video/mp4', f'allowed mime types must be exactly video/mp4, got {mimes!r}'


@test('anon and authenticated cannot upload into the bucket')
def t_no_upload():
    for role in WRITE_ROLES:
        res = as_role(
            role,
            f"insert into storage.objects (bucket_id, name) "
            f"values ('{BUCKET}', 'reels/2026-09-20-intruder.mp4');",
            user=USER if role == 'authenticated' else None,
        )
        assert denied(res), f'{role} was able to INSERT into {BUCKET}: {res}'
    # And nothing actually landed.
    assert q(f"select count(*) from storage.objects where bucket_id = '{BUCKET}';") == '1'


@test('anon and authenticated cannot overwrite or rename an existing object')
def t_no_update():
    for role in WRITE_ROLES:
        res = as_role(
            role,
            f"update storage.objects set name = 'reels/hijacked.mp4' "
            f"where bucket_id = '{BUCKET}';",
            user=USER if role == 'authenticated' else None,
        )
        assert denied(res), f'{role} was able to UPDATE in {BUCKET}: {res}'
    assert q(f"select name from storage.objects where bucket_id = '{BUCKET}';") == EXISTING


@test('anon and authenticated cannot delete an object')
def t_no_delete():
    for role in WRITE_ROLES:
        res = as_role(
            role,
            f"delete from storage.objects where bucket_id = '{BUCKET}';",
            user=USER if role == 'authenticated' else None,
        )
        assert denied(res), f'{role} was able to DELETE from {BUCKET}: {res}'
    assert q(f"select count(*) from storage.objects where bucket_id = '{BUCKET}';") == '1'


@test('public read of an object works for anon and authenticated')
def t_public_read():
    for role in WRITE_ROLES:
        rc, out, err = as_role(
            role,
            f"select name from storage.objects where bucket_id = '{BUCKET}';",
            user=USER if role == 'authenticated' else None,
        )
        assert rc == 0, f'{role} could not read: {err[:200]}'
        assert out == EXISTING, f'{role} read {out!r}, expected {EXISTING!r}'


@test('the only policy on the bucket is a SELECT policy')
def t_only_select_policy():
    # Every policy that can apply to social-videos, by command.
    rows = q(
        "select polname || '|' || polcmd::text from pg_policy p "
        "join pg_class c on c.oid = p.polrelid "
        "join pg_namespace n on n.oid = c.relnamespace "
        "where n.nspname = 'storage' and c.relname = 'objects' "
        f"and (pg_get_expr(p.polqual, p.polrelid) like '%{BUCKET}%' "
        f"  or pg_get_expr(p.polwithcheck, p.polrelid) like '%{BUCKET}%');"
    )
    listed = [r for r in rows.split('\n') if r]
    assert listed == ['social_videos_public_read|r'], \
        f'expected exactly one SELECT (r) policy, got {listed}'


@test('the migration did not touch the other buckets\' policies')
def t_other_buckets_intact():
    rows = q(
        "select polname from pg_policy p join pg_class c on c.oid = p.polrelid "
        "join pg_namespace n on n.oid = c.relnamespace "
        "where n.nspname = 'storage' and c.relname = 'objects' order by polname;"
    )
    names = sorted(r for r in rows.split('\n') if r)
    assert names == sorted([
        'anon_upload_property_photos', 'exp_photo_all',
        'public_read_property_photos', 'social_videos_public_read',
    ]), f'policy set changed: {names}'


@test('anon cannot list objects in a bucket it has no SELECT policy for')
def t_listing_is_scoped():
    # Sanity check that the read above is the policy talking, not RLS being off:
    # avatars has no policy at all, so it must come back empty for anon.
    q("insert into storage.objects (bucket_id, name) values ('avatars', 'a.png');")
    rc, out, _ = as_role('anon', "select count(*) from storage.objects where bucket_id = 'avatars';")
    assert rc == 0 and out == '0', f'anon saw avatars objects: {out}'


TESTS = [t_bucket_settings, t_no_upload, t_no_update, t_no_delete, t_public_read,
         t_only_select_policy, t_other_buckets_intact, t_listing_is_scoped]


def main():
    setup()
    seed()
    for t in TESTS:
        t()
    for name, passed, err in RESULTS:
        print(f"{'PASS' if passed else 'FAIL'}  {name}" + (f"  [{err}]" if err else ''), flush=True)
    ok = all(p for _, p, _ in RESULTS)
    print('ALL PASS' if ok else 'FAILURES', flush=True)
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
