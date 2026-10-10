# Database Schema Reference

## Overview

MangoDash uses SQLite with the `better-sqlite3` library. The database is located at `C:\MangoDash\data\mangodash.db`.

## Tables

### households
```sql
CREATE TABLE households (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pair_code TEXT UNIQUE,
  created INTEGER
);
```
**Purpose**: Multi-household isolation

### users
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER,
  email TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'parent',
  created INTEGER
);
```
**Purpose**: User authentication and authorization

### sessions
```sql
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER,
  expires INTEGER
);
```
**Purpose**: Session management

### invites
```sql
CREATE TABLE invites (
  code TEXT PRIMARY KEY,
  household_id INTEGER,
  role TEXT DEFAULT 'parent',
  used INTEGER DEFAULT 0
);
```
**Purpose**: Household invite codes

### dashboards
```sql
CREATE TABLE dashboards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER,
  name TEXT NOT NULL,
  theme TEXT DEFAULT 'dark',
  layout TEXT DEFAULT '[]'
);
```
**Purpose**: Dashboard configurations (GridStack layouts)

### devices
```sql
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  household_id INTEGER,
  name TEXT DEFAULT 'New Display',
  dashboard_id INTEGER,
  rotate_ids TEXT DEFAULT '',
  rotate_secs INTEGER DEFAULT 60,
  kind TEXT DEFAULT 'full',
  last_seen INTEGER
);
```
**Purpose**: Paired display devices

### members
```sql
CREATE TABLE members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER,
  name TEXT,
  color TEXT DEFAULT '#e8760e',
  avatar TEXT DEFAULT '🙂',
  role TEXT DEFAULT 'kid',
  pin TEXT DEFAULT '',
  points INTEGER DEFAULT 0,
  screen_minutes INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  streak_date TEXT DEFAULT ''
);
```
**Purpose**: Family members (kids, parents)

### chores
```sql
CREATE TABLE chores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER,
  title TEXT,
  member_id INTEGER,
  points INTEGER DEFAULT 10,
  screen_minutes INTEGER DEFAULT 0,
  schedule TEXT DEFAULT 'daily',
  rotate INTEGER DEFAULT 0,
  is_bounty INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending'
);
```
**Purpose**: Chore tracking

### todos
```sql
CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER,
  list_name TEXT,
  text TEXT,
  done INTEGER DEFAULT 0,
  pos INTEGER
);
```
**Purpose**: To-do lists (grocery, meals, packages, etc.)

### settings
```sql
CREATE TABLE settings (
  household_id INTEGER,
  key TEXT,
  value TEXT,
  PRIMARY KEY (household_id, key)
);
```
**Purpose**: Household settings (OAuth tokens, preferences)

## Indexes

For performance, the following indexes are typically used:
- `users.email` - Fast login lookups
- `devices.id` - Device authentication
- `todos.list_name` - To-do list filtering
- `settings.household_id, settings.key` - Settings retrieval
