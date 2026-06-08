# Per teamlid tarief bij activiteit bewerken (gedeelde projecten)

## Overzicht

Nieuwe tabel `project_member_activity_rates`, server-side resolutie in [`timeEntriesService.js`](sneltrack/lib/supabase/services/timeEntriesService.js), uitbreiding GET/PATCH activities-API, UI in [`ProjectActivitiesTab.js`](sneltrack/app/my/projecten/[projectId]/ProjectActivitiesTab.js) voor gedeelde projecten + `canManageActivities`, en weergave met `effective_hourly_rate` in o.a. [`TimerSectionClient.js`](sneltrack/app/my/TimerSectionClient.js). (Zie eerdere planstappen voor datamodel en API-details.)

---

## Playwright UI-tests ([`sneltrack/tests/`](sneltrack/tests/))

Stack: bestaand **`@playwright/test`** (`npm test` / `test:ui`). Patroon volgen uit [`timer.spec.js`](sneltrack/tests/timer.spec.js) en [`projects.spec.js`](sneltrack/tests/projects.spec.js), helpers uit [`tests/helpers/test-helpers.js`](sneltrack/tests/helpers/test-helpers.js).

### Nieuw bestand (voorstel)

[`sneltrack/tests/project-activities-member-rates.spec.js`](sneltrack/tests/project-activities-member-rates.spec.js) — tag bijv. `@mobile` of `@activities` voor gefilterde runs.

### Te dekken scenario’s

1. **Niet zichtbaar zonder rechten of zonder gedeeld project**  
   - Ingelogd als lid zonder `canManageActivities`: open projectdetail → tab Activiteiten → bewerken → **geen** sectie “Tarief per teamlid”.  
   - (Optioneel) niet-gedeeld project + beheerder: zelfde — geen per-lid sectie.

2. **Zichtbaar voor beheerder op gedeeld project**  
   - Navigeer naar `/my/projecten/:id`, tab “Activiteiten”, klik “Bewerken” op een regel.  
   - Verwacht: sectie **“Tarief per teamlid”** (of afgesproken `aria`/testid) met inputs gelijk aan aantal teamleden in de lijst.

3. **Invullen en opslaan (happy path)**  
   - Vul standaard uurtarief + minstens één lid-override in; trigger save (blur/Enter zoals bestaande flow).  
   - `waitForResponse` op `PATCH` naar `/my/projects/*/activities/*` met body die `member_activity_rates` bevat (of aparte assert op netwerk).  
   - Heropen bewerken: velden tonen opgeslagen waarden (eventueel na `reload` + opnieuw bewerken als state lokaal blijft).

4. **Override wissen**  
   - Leeg maken van een lid-veld → save → volgende GET toont geen override (test via herladen + bewerken, of intercept mock).

5. **Timer / effectief tarief (rook)**  
   - Indien testdata een gedeeld project + activity met verschillende `effective_hourly_rate` per gebruiker toelaat: pending timer, project kiezen, activiteit in dropdown — verwacht getoonde rate komt overeen met `effective_hourly_rate` (assert op zichtbare tekst `€xx,xx/uur`). *Alleen opnemen als stabiele testuser + seed beschikbaar is; anders `test.skip` met comment.*

### Testdata / auth

- Huidige tests gebruiken `navigateToUserPage` / `testuser` — **documenteren** welke gebruiker een **gedeeld project als owner** moet hebben en minstens **twee leden** voor zinvolle per-lid velden.  
- Zo nodig: helper `navigateToProjectActivitiesTab(page, projectId)` in `test-helpers.js` toevoegen (tab klikken via rol/tekst “Activiteiten”).

### CI / lokaal

- Geen wijziging aan `package.json` nodig tenzij nieuwe script-tag gewenst (`test:activities`).  
- Falende tests door ontbrekende seed: duidelijk `test.skip` + link naar setup in comment.

---

## Implementatietodos (referentie)

- Migration `project_member_activity_rates`
- Service + GET/PATCH + timeEntries-resolutie
- UI ProjectActivitiesTab + props `isShared`, `members`
- TimerSectionClient: `effective_hourly_rate`
- **Playwright: `project-activities-member-rates.spec.js` + helpers indien nodig**
