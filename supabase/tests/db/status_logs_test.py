#!/usr/bin/env python3
"""Tests for supabase/migrations/20260918110000_status_logs_privacy.sql on a
LOCAL, disposable PostgreSQL 17 (never production).

  PSQL=/opt/homebrew/opt/postgresql@17/bin/psql PGHOST=/tmp/rcpg PGPORT=55432 \\
    python3 supabase/tests/db/status_logs_test.py [migration.sql]
"""
import json
import os
import subprocess
import sys
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = os.path.join(HERE, '..', '..', 'migrations')
PSQL = os.environ.get('PSQL', 'psql')
DB = os.environ.get('RC_STATUS_LOGS_DB', 'rc_status_logs_test')
MIGRATION = sys.argv[1] if len(sys.argv) > 1 else os.path.join(MIG, '20260918110000_status_logs_privacy.sql')


def run(sql, db=DB):
    p = subprocess.run([PSQL, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-U', os.environ.get('PGUSER', 'postgres'), '-d', db], input=sql, capture_output=True, text=True)
    return p.returncode, p.stdout.strip(), p.stderr.strip()


def q(sql):
    rc, out, err = run(sql)
    if rc != 0:
        raise RuntimeError(err[:300])
    return out


def as_role(role, sql, sub=None, email=None):
    claims = {'role': role}
    if sub:
        claims.update({'sub': sub, 'email': email})
    return run(f"do $c$ begin perform set_config('request.jwt.claims', '{json.dumps(claims)}', false); end $c$;\nset role {role};\n{sql}")


def denied(res):
    return res[0] != 0 and ('permission denied' in res[2] or 'row-level security' in res[2])


RESULTS = []


def check(name, fn):
    try:
        fn()
        RESULTS.append((name, True, ''))
    except AssertionError as e:
        RESULTS.append((name, False, str(e)))
    except Exception as e:  # noqa: BLE001
        RESULTS.append((name, False, f'error: {str(e)[:200]}'))


def main():
    run(f'drop database if exists {DB}', db='postgres')
    run(f'create database {DB}', db='postgres')
    for f in (os.path.join(HERE, 'bootstrap.sql'), os.path.join(HERE, 'prod_structure.sql'), MIGRATION, MIGRATION):
        p = subprocess.run([PSQL, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', os.environ.get('PGUSER', 'postgres'), '-d', DB, '-f', f], capture_output=True, text=True)
        assert p.returncode == 0, f'{os.path.basename(f)}: {p.stderr[:300]}'
    booking = q("insert into public.bookings (property_id, check_in, check_out, status, user_email, property_title, total_price) values (null, '2099-01-01', '2099-01-02', 'cancelled', 'g@example.test', 'T', 1) returning id;")
    q(f"insert into public.booking_status_logs (booking_id, event_type, to_status, changed_by, note) values ('{booking}', 'bog_paid_pending_approval', 'pending_host_approval', 'bog_callback', 'order: secret-order-id guest@example.test');")
    guest = str(uuid.uuid4())

    def anon_no_read():
        for sql in ('select count(*) from public.booking_status_logs;', 'select note from public.booking_status_logs;'):
            assert denied(as_role('anon', sql)), sql

    def anon_no_write():
        for sql in (f"insert into public.booking_status_logs (booking_id, event_type, to_status) values ('{booking}', 'x', 'y');",
                    'update public.booking_status_logs set note = null;', 'delete from public.booking_status_logs;', 'truncate public.booking_status_logs;'):
            assert denied(as_role('anon', sql)), sql

    def authenticated_no_access():
        for sql in ('select count(*) from public.booking_status_logs;',
                    f"insert into public.booking_status_logs (booking_id, event_type, to_status) values ('{booking}', 'x', 'y');",
                    'update public.booking_status_logs set note = null;', 'delete from public.booking_status_logs;', 'truncate public.booking_status_logs;'):
            assert denied(as_role('authenticated', sql, guest, 'g@example.test')), sql

    def no_public_policy():
        assert q("select count(*) from pg_policies where tablename='booking_status_logs'") == '0'
        assert q("select has_table_privilege('anon','public.booking_status_logs','SELECT')") == 'f'
        assert q("select has_table_privilege('authenticated','public.booking_status_logs','SELECT')") == 'f'

    def service_role_reads_and_inserts():
        rc, out, err = as_role('service_role', f"insert into public.booking_status_logs (booking_id, event_type, from_status, to_status, changed_by, note) values ('{booking}', 'verify_paid_sync', 'pending_payment', 'pending_host_approval', 'system', 'n') returning 1;\nselect count(*) from public.booking_status_logs;")
        assert rc == 0, err[:200]
        assert out.splitlines()[-1] == '2', out

    def notes_unchanged():
        assert q("select count(*) from public.booking_status_logs where note like 'order: secret-order-id%'") == '1'

    for name, fn in (('anon cannot SELECT booking_status_logs', anon_no_read), ('anon cannot INSERT/UPDATE/DELETE/TRUNCATE', anon_no_write),
                     ('authenticated cannot SELECT or write', authenticated_no_access), ('no policies; no anon/authenticated SELECT privilege', no_public_policy),
                     ('service role reads and inserts (functions keep logging)', service_role_reads_and_inserts), ('existing rows untouched', notes_unchanged)):
        check(name, fn)
    for name, ok, err in RESULTS:
        print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  [{err}]" if err else ''))
    ok = all(r[1] for r in RESULTS)
    print('ALL PASS' if ok else 'FAILURES')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
