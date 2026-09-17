#!/usr/bin/env python3
"""Tests for
  supabase/migrations/20260918120000_public_properties_view.sql      (A)
  supabase/migrations/20260918120100_property_applications_privacy.sql (B)
on a LOCAL, disposable PostgreSQL 17 (never production).

  PSQL=/opt/homebrew/opt/postgresql@17/bin/psql PGHOST=/tmp/rcpg PGPORT=55432 \\
    python3 supabase/tests/db/property_applications_test.py [A.sql] [B.sql]
"""
import datetime as dt
import json
import os
import subprocess
import sys
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = os.path.abspath(os.path.join(HERE, '..', '..', 'migrations'))
PSQL = os.environ.get('PSQL', 'psql')
DB = os.environ.get('RC_PROPAPP_DB', 'rc_property_applications_test')
A_SQL = sys.argv[1] if len(sys.argv) > 1 else os.path.join(MIG, '20260918120000_public_properties_view.sql')
B_SQL = sys.argv[2] if len(sys.argv) > 2 else os.path.join(MIG, '20260918120100_property_applications_privacy.sql')

SAFE_COLUMNS = ['id', 'title', 'description', 'location', 'property_type', 'bedrooms', 'bathrooms', 'max_guests', 'amenities',
                'categories', 'photo_urls', 'cover_photo_url', 'cover_photo_position', 'price_per_night', 'pricing_type',
                'guest_pricing_tiers', 'accepted_payment_methods', 'google_maps_url', 'latitude', 'longitude', 'address',
                'host_first_name', 'host_last_initial', 'created_at']


def args(db):
    return [PSQL, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-U', os.environ.get('PGUSER', 'postgres'), '-d', db]


def run(sql, db=DB):
    p = subprocess.run(args(db), input=sql, capture_output=True, text=True)
    return p.returncode, p.stdout.strip(), p.stderr.strip()


def q(sql):
    rc, out, err = run(sql)
    if rc != 0:
        raise RuntimeError(err[:300])
    return out


def as_role(role, sql, user=None):
    claims = {'role': role}
    if user:
        claims.update({'sub': user['id'], 'email': user['email']})
    return run(f"do $c$ begin perform set_config('request.jwt.claims', '{json.dumps(claims)}', false); end $c$;\nset role {role};\n{sql}")


def denied(res):
    return res[0] != 0 and ('permission denied' in res[2] or 'row-level security' in res[2])


def last(res):
    return res[1].splitlines()[-1] if res[1] else ''


HOST_A = {'id': str(uuid.uuid4()), 'email': 'host.a@example.test'}
HOST_B = {'id': str(uuid.uuid4()), 'email': 'host.b@example.test'}
GUEST = {'id': str(uuid.uuid4()), 'email': 'guest@example.test'}
OTHER_GUEST = {'id': str(uuid.uuid4()), 'email': 'other.guest@example.test'}
P = {}
BK = {}


def insert_property(key, status, host_email):
    P[key] = str(uuid.uuid4())
    q(f"insert into public.property_applications (id, status, host_email, host_first_name, host_last_name, host_phone, title, property_type, location, bedrooms, bathrooms, max_guests, description, price_per_night, address, ical_url, rejection_note) "
      f"values ('{P[key]}', '{status}', '{host_email}', 'Nino', 'Beridze', '+995555000111', 'T {key}', 'cottage', 'Kazbegi', 1, 1, 2, 'D', 100, 'Street 1', 'https://ical.example/secret', 'internal note');")


def setup():
    run(f'drop database if exists {DB}', db='postgres')
    run(f'create database {DB}', db='postgres')
    for f in (os.path.join(HERE, 'bootstrap.sql'), os.path.join(HERE, 'prod_structure.sql'),
              os.path.join(MIG, '20260917160000_booking_no_overlap.sql'),
              os.path.join(MIG, '20260918100000_public_unavailable_ranges.sql'),
              os.path.join(MIG, '20260918100100_block_tables_privacy.sql'),
              A_SQL, B_SQL, A_SQL, B_SQL):
        p = subprocess.run(args(DB) + ['-f', f], capture_output=True, text=True)
        if p.returncode != 0:
            raise RuntimeError(f'{os.path.basename(f)}: {p.stderr[:400]}')
    for u in (HOST_A, HOST_B, GUEST, OTHER_GUEST):
        q(f"insert into auth.users (id, email, email_confirmed_at) values ('{u['id']}', '{u['email']}', now());")
    insert_property('A', 'approved', 'Host.A@Example.test')
    insert_property('A_PENDING', 'pending', HOST_A['email'])
    insert_property('B', 'approved', HOST_B['email'])
    insert_property('REJ', 'rejected', HOST_B['email'])
    insert_property('HID', 'hidden', HOST_B['email'])
    today = dt.date.fromisoformat(q("select (timezone('UTC', now()))::date"))
    def booking(key, prop, status, days_ahead, guest):
        ci = today + dt.timedelta(days=days_ahead)
        BK[key] = q(f"insert into public.bookings (property_id, check_in, check_out, status, user_email, customer_id, property_title, total_price) "
                    f"values ('{P[prop]}', '{ci}', '{ci + dt.timedelta(days=2)}', '{status}', '{guest['email']}', '{guest['id']}', 'T', 1) returning id;")
    booking('tomorrow', 'A', 'confirmed', 1, GUEST)
    booking('later', 'A', 'confirmed', 10, GUEST)
    booking('pending', 'A', 'pending_host_approval', 20, GUEST)


RESULTS = []


def check(name):
    def deco(fn):
        def wrapper():
            try:
                fn()
                RESULTS.append((name, True, ''))
            except AssertionError as e:
                RESULTS.append((name, False, str(e)))
            except Exception as e:  # noqa: BLE001
                RESULTS.append((name, False, f'error: {str(e)[:300]}'))
        return wrapper
    return deco


@check('anon cannot read property_applications at all (any column)')
def t_anon_table():
    for cols in ('*', 'id', 'host_email', 'host_phone', 'address', 'admin_token', 'title'):
        assert denied(as_role('anon', f'select {cols} from public.property_applications;')), cols


@check('view exposes exactly the safe column list; private columns do not exist on it')
def t_view_columns():
    cols = q("select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='public_properties'").split(',')
    assert cols == SAFE_COLUMNS, cols
    for private in ('host_email', 'host_phone', 'host_last_name', 'admin_token', 'ical_url', 'rejection_note', 'status', 'agreement_status', 'sms_notifications_enabled'):
        res = as_role('anon', f'select {private} from public.public_properties;')
        assert res[0] != 0 and 'does not exist' in res[2], private


@check('view shows only approved listings; last name is reduced to the initial; anon and authenticated can read it')
def t_view_rows():
    for role, user in (('anon', None), ('authenticated', GUEST)):
        res = as_role(role, "select id || '|' || host_last_initial from public.public_properties order by id;", user)
        assert res[0] == 0, res[2][:200]
        rows = set(res[1].splitlines())
        assert rows == {f"{P['A']}|B", f"{P['B']}|B"}, rows
    dump = last(as_role('anon', 'select json_agg(v)::text from public.public_properties v;'))
    for secret in ('host.a@', 'host.b@', '+995555000111', 'Beridze', 'ical.example', 'internal note'):
        assert secret.lower() not in dump.lower(), secret
    assert q("select has_table_privilege('anon','public.public_properties','INSERT')") == 'f'


@check('host A reads own rows (all columns but admin_token), never host B\'s')
def t_owner_read():
    res = as_role('authenticated', 'select id, host_email, host_phone, address, ical_url, rejection_note from public.property_applications order by id;', HOST_A)
    assert res[0] == 0, res[2][:200]
    ids = {line.split('|')[0] for line in res[1].splitlines()}
    assert ids == {P['A'], P['A_PENDING']}, ids
    assert denied(as_role('authenticated', 'select admin_token from public.property_applications;', HOST_A)), 'admin_token readable'
    assert denied(as_role('authenticated', 'select * from public.property_applications;', HOST_A)), 'select * must fail (admin_token not granted)'


@check('authenticated non-owners (guests) see no rows and no private columns')
def t_guest_read():
    res = as_role('authenticated', 'select count(*) from public.property_applications;', GUEST)
    assert res[0] == 0 and last(res) == '0', res
    res = as_role('authenticated', f"select host_email from public.property_applications where id = '{P['B']}';", HOST_A)
    assert res[0] == 0 and res[1] == '', 'host A read host B email'


@check('host can edit listing fields of own rows only; cannot change status, admin_token or host_email')
def t_owner_update():
    ok = as_role('authenticated', f"update public.property_applications set title = 'New', price_per_night = 150, photo_urls = '{{}}' where id = '{P['A']}' returning id;", HOST_A)
    assert ok[0] == 0 and last(ok) == P['A'], ok[2][:200]
    for col, val in (('status', "'approved'"), ('admin_token', 'gen_random_uuid()'), ('host_email', "'x@example.test'"), ('approved_at', 'now()'), ('agreement_status', "'received'")):
        res = as_role('authenticated', f"update public.property_applications set {col} = {val} where id = '{P['A_PENDING']}';", HOST_A)
        assert denied(res), f'{col} updatable'
    assert q(f"select status from public.property_applications where id = '{P['A_PENDING']}'") == 'pending'
    other = as_role('authenticated', f"update public.property_applications set title = 'Hijack' where id = '{P['B']}' returning id;", HOST_A)
    assert other[0] == 0 and other[1] == '', 'updated host B row'
    assert q(f"select title from public.property_applications where id = '{P['B']}'") == 'T B'
    # An UPDATE without WHERE/RETURNING is checked only against the UPDATE policy.
    as_role('authenticated', "update public.property_applications set description = 'mass edit';", HOST_A)
    assert q(f"select description from public.property_applications where id = '{P['B']}'") == 'D', 'mass update reached host B row'
    assert q(f"select description from public.property_applications where id = '{P['A']}'") == 'mass edit'


@check('no direct inserts or deletes by anon/authenticated (cannot self-approve); service role submission path works')
def t_insert():
    cols = "status, host_email, host_first_name, host_last_name, host_phone, title, property_type, location, bedrooms, bathrooms, max_guests, description, price_per_night"
    vals = "'approved', 'x@example.test', 'F', 'L', '1', 'T', 'cottage', 'X', 1, 1, 1, 'D', 1"
    for role, user in (('anon', None), ('authenticated', HOST_A)):
        assert denied(as_role(role, f'insert into public.property_applications ({cols}) values ({vals});', user)), role
        assert denied(as_role(role, f"delete from public.property_applications where id = '{P['A']}';", user)), role
    pending_vals = vals.replace("'approved'", "'pending'")
    rc, out, err = as_role('service_role', f"insert into public.property_applications ({cols}) values ({pending_vals}) returning status;")
    assert rc == 0 and last((rc, out, err)) == 'pending', err[:200]


@check('service role has full access')
def t_service():
    rc, out, err = as_role('service_role', f"select count(*), count(admin_token) from public.property_applications;\nupdate public.property_applications set status = 'approved' where id = '{P['REJ']}';\nupdate public.property_applications set status = 'rejected' where id = '{P['REJ']}';")
    assert rc == 0, err[:200]


@check('is_property_owner, get_unavailable_ranges and the no-overlap functions still work')
def t_functions():
    assert last(as_role('authenticated', f"select public.is_property_owner('{P['A']}');", HOST_A)) == 't'
    assert last(as_role('authenticated', f"select public.is_property_owner('{P['B']}');", HOST_A)) == 'f'
    res = as_role('anon', f"select count(*) from public.get_unavailable_ranges('{P['A']}');")
    assert res[0] == 0 and int(last(res)) >= 2, res
    rc, out, err = as_role('service_role', f"select public.create_booking_checked('{{\"property_id\":\"{P['B']}\",\"check_in\":\"2099-03-01\",\"check_out\":\"2099-03-03\",\"status\":\"confirmed\",\"user_email\":\"g@example.test\",\"property_title\":\"T\",\"total_price\":1}}'::jsonb) ->> 'id';")
    assert rc == 0 and last((rc, out, err)), err[:200]


@check('host still reads bookings of own property through the bookings policy (sub-select on property_applications)')
def t_dependent_policy():
    # The existing bookings policy compares host_email with the JWT email exactly
    # (unchanged here), so use the listing whose stored email matches exactly.
    q(f"insert into public.bookings (property_id, check_in, check_out, status, user_email, property_title, total_price) values ('{P['A_PENDING']}', '2099-05-01', '2099-05-03', 'cancelled', 'g2@example.test', 'T', 1);")
    res = as_role('authenticated', f"select count(*) from public.bookings where property_id = '{P['A_PENDING']}';", HOST_A)
    assert res[0] == 0 and last(res) == '1', res
    res = as_role('authenticated', f"select count(*) from public.bookings where property_id = '{P['A_PENDING']}';", HOST_B)
    assert res[0] == 0 and last(res) == '0', res


@check('get_booking_host_contact: only the booking\'s guest, confirmed, from the day before check-in')
def t_contact():
    res = as_role('authenticated', f"select host_email || '|' || host_phone from public.get_booking_host_contact('{BK['tomorrow']}');", GUEST)
    assert res[0] == 0 and last(res) == 'Host.A@Example.test|+995555000111', res
    for label, bid, user in (('too early', BK['later'], GUEST), ('not confirmed', BK['pending'], GUEST), ('other guest', BK['tomorrow'], OTHER_GUEST),
                             ('host of another property', BK['tomorrow'], HOST_B), ('unknown booking', str(uuid.uuid4()), GUEST)):
        res = as_role('authenticated', f"select count(*) from public.get_booking_host_contact('{bid}');", user)
        assert res[0] == 0 and last(res) == '0', label
    assert denied(as_role('anon', f"select * from public.get_booking_host_contact('{BK['tomorrow']}');"))


TESTS = [t_anon_table, t_view_columns, t_view_rows, t_owner_read, t_guest_read, t_owner_update, t_insert, t_service, t_functions, t_dependent_policy, t_contact]


def main():
    setup()
    for t in TESTS:
        t()
    for name, ok, err in RESULTS:
        print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  [{err}]" if err else ''))
    ok = all(r[1] for r in RESULTS)
    print('ALL PASS' if ok else 'FAILURES')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
