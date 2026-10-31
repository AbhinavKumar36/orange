# Moody Orange — Local Supabase Environment

This directory configures local Supabase development for the Moody Orange platform.

## Prerequisites
1. **Docker Desktop**: Docker must be running on your machine.
2. **Supabase CLI**: Install via npm (`npm install -g supabase`) or package manager (`brew install supabase/tap/supabase` or `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase`).

## Quick Start
```bash
# 1. Start the local Supabase stack
supabase start

# 2. Check service status and connection strings
supabase status

# 3. Access local services
# API Gateway:    http://localhost:54321
# PostgreSQL DB:  postgresql://postgres:postgres@localhost:54322/postgres
# Supabase Studio:http://localhost:54323
# Inbucket Mail:  http://localhost:54324

# 4. Stop when done
supabase stop
```

## Phase 1 Status
- `config.toml` is configured with deterministic ports matching the architecture specification.
- Production migrations and schema definitions are reserved for **Phase 2**.
- If Docker is not available in the current development environment, run `supabase start` once Docker is installed and running.

