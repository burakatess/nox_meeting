export interface Migration {
  id: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: '001_identity_and_audit',
    sql: `
      create table users (
        id uuid primary key default gen_random_uuid(),
        username text not null unique,
        display_name text not null,
        password_hash text not null,
        role text not null check (role in ('admin','auditor','member')),
        status text not null default 'active' check (status in ('active','disabled')),
        failed_logins int not null default 0,
        locked_until timestamptz,
        created_at timestamptz not null default now()
      );

      create table sessions (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id),
        device_name text not null,
        ip text,
        issued_at timestamptz not null default now(),
        expires_at timestamptz not null,
        revoked_at timestamptz
      );

      create table audit_events (
        seq bigint primary key,
        at timestamptz not null,
        who text not null,
        what text not null,
        where_ip text,
        result text not null,
        object_type text,
        object_id text,
        session_id text,
        device text,
        details jsonb not null default '{}',
        prev_hash text not null,
        hash text not null
      );

      create function audit_events_immutable() returns trigger as $$
      begin
        raise exception 'audit_events is append-only';
      end;
      $$ language plpgsql;

      create trigger audit_events_no_change
        before update or delete on audit_events
        for each row execute function audit_events_immutable();

      create trigger audit_events_no_truncate
        before truncate on audit_events
        for each statement execute function audit_events_immutable();
    `,
  },
];
