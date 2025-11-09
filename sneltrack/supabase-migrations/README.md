# Supabase Migrations voor Notes Functionaliteit

## Setup Instructies

1. **Maak de tabellen aan** in Supabase SQL Editor:
   - Open je Supabase project dashboard
   - Ga naar SQL Editor
   - Voer `001_create_notes_tables.sql` uit
   - Voer `002_create_rls_policies.sql` uit

2. **Enable Realtime** in Supabase Dashboard:
   - Ga naar Database → Replication
   - Enable Realtime voor `notes` table
   - Enable Realtime voor `note_items` table

3. **Environment Variables** toevoegen aan `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

4. **Test de functionaliteit**:
   - Maak een nieuwe notitie aan
   - Voeg items toe
   - Test real-time updates door dezelfde notitie in meerdere browsers te openen
   - Test share functionaliteit door een share token te genereren

## Database Schema

### notes table
- `id` (uuid, primary key)
- `name` (text, not null)
- `content` (text, nullable)
- `project_id` (text, nullable) - verwijst naar Firestore project ID
- `share_token` (uuid, unique, nullable) - voor gedeelde toegang
- `created_by` (text, not null) - username
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### note_items table
- `id` (uuid, primary key)
- `note_id` (uuid, foreign key naar notes)
- `text` (text, not null)
- `checked` (boolean, default false)
- `checked_by` (text, nullable) - username
- `created_by` (text, not null) - username
- `position` (integer, default 0) - voor sortering
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

## RLS Policies

**POC Setup (Minimale Security):**
- Anon users kunnen alle notes en items beheren (RLS policies staan alles toe)
- Security checks worden gedaan in applicatie code:
  - `created_by` wordt gezet bij create operaties
  - Delete operaties checken `created_by` in de query
  - Update operaties vertrouwen op de applicatie logica
- Server-side gebruikt service role key (bypasses RLS)
- Client-side gebruikt anon key met permissive RLS policies voor real-time testing

**Voor Production:**
- Versterk RLS policies om alleen eigen data toe te staan
- Implementeer proper authentication (Supabase Auth of custom JWT)
- Voeg extra security checks toe in applicatie code

