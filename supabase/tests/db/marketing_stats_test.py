#!/usr/bin/env python3
"""Privacy and access tests for

  supabase/migrations/20260918140000_marketing_weekly_stats.sql

Runs against a LOCAL, disposable PostgreSQL 17 (never production):

  PSQL=/opt/homebrew/opt/postgresql@17/bin/psql PGHOST=/tmp/rcpg PGPORT=55432 \\
    python3 supabase/tests/db/marketing_stats_test.py [stats.sql]

The database `rc_marketing_test` is rebuilt from bootstrap.sql, prod_structure.sql
and the migration under test. Exit 0 = all pass.
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
DB = os.environ.get('RC_MARKETING_DB', 'rc_marketing_test')
STATS_SQL = sys.argv[1] if len(sys.argv) > 1 else os.path.join(MIG, '20260918140000_marketing_weekly_stats.sql')

VIEW = 'marketing_weekly_stats'
HOST_EMAIL = 'host.private@example.test'
GUEST_EMAIL = 'guest.private@example.test'
GUEST_NAME = 'Nino Privatesurname'
HOST_PHONE = '+995599123456'


def args(db):
    return [PSQL, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-U', os.environ.get('PGUSER', 'postgres'), '-d', db]


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


def as_role(role, sql):
    prefix = (f"do $cfg$ begin perform set_config('request.jwt.claims', '{json.dumps({'role': role})}', false); end $cfg$;\n"
              f"set role {role};\n")
    return run(prefix + sql)


def setup():
    run('drop database if exists ' + DB, db='postgres')
    run('create database ' + DB, db='postgres')
    run_file(os.path.join(HERE, 'bootstrap.sql'))
    run_file(os.path.join(HERE, 'prod_structure.sql'))
    run_file(STATS_SQL)


def seed():
    props = []
    for i, (status, location, cats, price) in enumerate((
        ('approved', 'Batumi, Adjara', "{Mountain,Forest}", 100),
        ('approved', 'Batumi, Adjara', "{Mountain}", 200),
        ('approved', 'Kazbegi, Mtskheta-Mtianeti', "{Winery}", 300),
        ('pending', 'Kutaisi, Imereti', "{Mountain}", 999),
        ('rejected', 'Mestia, Samegrelo', "{Forest}", 999),
    )):
        pid = str(uuid.uuid4())
        props.append((pid, status))
        q("insert into public.property_applications (id, status, host_email, host_phone, title, host_first_name, "
          "host_last_name, property_type, location, bedrooms, bathrooms, max_guests, description, price_per_night, "
          f"categories, created_at) values ('{pid}', '{status}', '{HOST_EMAIL}', '{HOST_PHONE}', 'T', 'Nino', "
          f"'Privatesurname', 'cottage', '{location}', 1, 1, 2, 'D', {price}, '{cats}', now() - interval '{i} days');")
    approved = [p for p, s in props if s == 'approved']
    for i, (status, days_ago, total) in enumerate((
        ('confirmed', 1, 500), ('completed', 20, 700), ('pending', 3, 900), ('cancelled', 200, 1000),
    )):
        q("insert into public.bookings (property_id, check_in, check_out, status, user_email, user_name, "
          f"property_title, total_price, created_at) values ('{approved[0]}', current_date + {10 + i * 5}, "
          f"current_date + {12 + i * 5}, '{status}', '{GUEST_EMAIL}', '{GUEST_NAME}', 'T', {total}, "
          f"now() - interval '{days_ago} days');")


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
    return res[0] != 0 and ('permission denied' in res[2] or 'row-level security' in res[2])


@test('the view carries no contact column and no row id')
def t_columns():
    cols = q(f"select string_agg(column_name, ',' order by column_name) from information_schema.columns "
             f"where table_schema='public' and table_name='{VIEW}'").split(',')
    for c in cols:
        for forbidden in ('email', 'phone', 'name', 'address', 'token', 'id'):
            assert forbidden not in c.lower() or c in ('listings_by_region', 'listings_by_category'), f'suspicious column: {c}'
    assert 'approved_listings' in cols and 'avg_booking_value' in cols, cols


@test('no seeded PII appears anywhere in the view output')
def t_no_pii_in_data():
    dump = q(f'select row_to_json(v)::text from public.{VIEW} v')
    for secret in (HOST_EMAIL, GUEST_EMAIL, 'Privatesurname', HOST_PHONE, 'host.private', 'guest.private'):
        assert secret.lower() not in dump.lower(), f'leak: {secret[:12]}'
    assert '@' not in dump, 'an @ reached the view output'


@test('anon and authenticated cannot read the view; service_role can')
def t_grants():
    for role in ('anon', 'authenticated'):
        assert denied(as_role(role, f'select * from public.{VIEW};')), role
        assert q(f"select has_table_privilege('{role}', 'public.{VIEW}', 'select')") == 'f', role
    rc, out, err = as_role('service_role', f'select approved_listings from public.{VIEW};')
    assert rc == 0, f'service role blocked: {err[:200]}'
    assert out == '3', f'approved listings: {out}'
    assert q("select bool_or(a.grantee = 0) from pg_class c, aclexplode(c.relacl) a "
             f"where c.relname = '{VIEW}'") in ('f', ''), 'PUBLIC grant present'


@test('the numbers are right: only approved listings, only real bookings')
def t_numbers():
    row = json.loads(q(f'select row_to_json(v) from public.{VIEW} v'))
    assert row['approved_listings'] == 3, row['approved_listings']
    assert row['new_listings_7d'] == 3 and row['new_listings_30d'] == 3, row
    assert row['distinct_regions'] == 2, row['distinct_regions']
    assert float(row['price_min']) == 100 and float(row['price_max']) == 300, row
    assert float(row['price_avg']) == 200, row['price_avg']
    assert row['bookings_7d'] == 2 and row['bookings_30d'] == 3 and row['bookings_90d'] == 3, row
    assert row['confirmed_bookings_all_time'] == 2, row
    assert float(row['avg_booking_value']) == 600, row['avg_booking_value']
    regions = {r['region']: r['listings'] for r in row['listings_by_region']}
    assert regions == {'Batumi, Adjara': 2, 'Kazbegi, Mtskheta-Mtianeti': 1}, regions
    cats = {c['category']: c['listings'] for c in row['listings_by_category']}
    assert cats == {'Mountain': 2, 'Forest': 1, 'Winery': 1}, cats
    assert 'Kutaisi, Imereti' not in regions, 'a pending listing leaked into the report'


@test('the view returns exactly one row, and survives an empty database')
def t_shape():
    assert q(f'select count(*) from public.{VIEW}') == '1'
    q('create table _bk_b as select * from public.bookings; create table _bk_p as select * from public.property_applications;')
    q('delete from public.bookings; delete from public.property_applications;')
    row = json.loads(q(f'select row_to_json(v) from public.{VIEW} v'))
    assert row['approved_listings'] == 0 and row['listings_by_region'] == [] and row['price_avg'] is None, row
    q('insert into public.property_applications select * from _bk_p; insert into public.bookings select * from _bk_b;')
    q('drop table _bk_b; drop table _bk_p;')
    assert q(f'select approved_listings from public.{VIEW}') == '3', 'restore failed'


@test('the view runs with owner rights, like public_properties')
def t_owner_rights():
    opts = q(f"select coalesce(array_to_string(c.reloptions, ','), '') from pg_class c where c.relname = '{VIEW}'")
    assert 'security_invoker=true' not in opts.replace(' ', ''), opts


TESTS = [t_columns, t_no_pii_in_data, t_grants, t_numbers, t_shape, t_owner_rights]


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
