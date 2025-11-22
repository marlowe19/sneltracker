# Environment Variables Setup

The migration script needs access to your Supabase credentials. You have two options:

## Option 1: Create a `.env` file (Recommended)

Create a file named `.env` in the `scripts/` folder with these variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Where to find these values:**
1. Go to your Supabase Dashboard
2. Select your project
3. Go to Settings > API
4. Copy:
   - **URL** → Use for `NEXT_PUBLIC_SUPABASE_URL`
   - **service_role key** → Use for `SUPABASE_SERVICE_ROLE_KEY` ⚠️ NOT the anon key!

**Quick way:** Copy from your main app's `.env.local`:

```bash
# From the tijdregistratie folder:
cp sneltrack/.env.local scripts/.env
```

Then make sure it has these two variables.

---

## Option 2: Copy from sneltrack

If you already have environment variables in `sneltrack/.env.local`, you can just copy that file:

```bash
cd /Users/marloweantonius/Documents/myidentity/tijdregistratie
cp sneltrack/.env.local scripts/.env
```

---

## Using Different Environment Files

You can create multiple environment files for different setups:

```
scripts/
├── .env                # Default (production)
├── .env.local          # Local development
├── .env.development    # Development server
└── .env.production     # Production server
```

**Run migration with specific env file:**

```bash
# Use default .env
npm run migrate

# Use .env.local
npm run migrate:local

# Use .env.development  
npm run migrate:dev

# Use .env.production
npm run migrate:prod

# Use a custom file
ENV_FILE=.env.staging npm run migrate
```

The same pattern works for all scripts:
- `npm run backup:firebase:local` → Uses `.env.local`
- `npm run migrate:verify:dev` → Uses `.env.development`

## Verify it works

Run the verification script to test:

```bash
cd scripts
npm run migrate:verify
```

You should see:
- ✓ Loaded environment variables from .env
- ✓ Loaded backup file successfully

If you see warnings about missing environment variables, check your `.env` file.

---

## Security Note

⚠️ **NEVER commit the `.env` file to git!**

The `.env` file is already in `.gitignore` to prevent this.

The `service_role` key has full database access - keep it secret!

---

## What the script needs

The migration script will look for:
1. `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
2. `SUPABASE_SERVICE_ROLE_KEY`

If not found in `.env`, it will check `process.env` (system environment variables).

