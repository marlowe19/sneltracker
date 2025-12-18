import { NextResponse } from "next/server";
import { getUserCalendarEvents } from "@/lib/googleCalendar";
import { getActiveProjectsForAgenda } from "@/lib/supabase/services/agendaService";
import { getHolidaysInRange } from "@/lib/holidays";
import OpenAI from "openai";
import { auth0 } from "@/lib/auth/auth0";

export const dynamic = "force-dynamic";

let openaiInstance = null;

function getOpenAIClient() {
  if (openaiInstance) {
    return openaiInstance;
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  openaiInstance = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return openaiInstance;
}

async function generatePlanning(weekInput) {
  const openai = getOpenAIClient();
  console.log(JSON.stringify(weekInput, null, 2));
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini"; // Note: Set OPENAI_MODEL=gpt-5.1 or another model name if you have access

  const SYSTEM_PROMPT = `
Je bent een slimme werkplanner voor een zzp'er in de bouw/schilderbranche.
Je taak is om een weekplanning te maken op basis van projecten, taken, prioriteiten,
deadlines, reistijd en beschikbaarheid.

BELANGRIJK:
- Respecteer werkuren en bestaande kalenderblokken.
- Respecteer de werkvoorkeuren van de gebruiker. start om 8:00 uur en eindig om 16:00 uur bijvoorbeeld
- Houd rekening met reistijd tussen locaties en maak reistijd aparte agenda-items.
- Elke klus heeft opstarttijd en tijd voor opruimen/netjes achterlaten.
- Plan geen twee klussen op dezelfde dag als er geen tijd is voor reistijd ertussen.
- Gebruik projecten, prioriteit en deadlines om de volgorde te bepalen.
- Gebruik realistische blokken op basis van minimale en maximale blokgrootte per taak.
- De output MOET strikt een geldige JSON zijn volgens het gevraagde schema.
- GEEN extra tekst, GEEN uitleg, ALLEEN JSON.
`;

  const USER_PROMPT = `
Plan de komende week op basis van de meegegeven data.

Data (in JSON):
${JSON.stringify(weekInput)}

De output moet strikt het volgende JSON-format hebben zonder extra tekst:

{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "items": [
        {
          "id": "string",
          "type": "task|travel|break",
          "projectId": "string|null",
          "taskId": "string|null",
          "title": "string",
          "start": "ISO-8601",
          "end": "ISO-8601",
          "locationId": "string|null",
          "notes": "string|null"
        }
      ]
    }
  ]
}

Geef ALLEEN de JSON terug, zonder markdown, zonder uitleg.
`;

  const response = await openai.responses.create({
    model: model,
    input: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: USER_PROMPT,
      },
    ],
    text: {
      format: {
        name: "PlanningResponse",
        type: "json_schema",

        schema: {
          type: "object",
          properties: {
            days: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date: { type: "string" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        type: {
                          type: "string",
                          enum: ["task", "travel", "break"],
                        },
                        projectId: {
                          type: ["string", "null"],
                        },
                        taskId: {
                          type: ["string", "null"],
                        },
                        title: { type: "string" },
                        start: { type: "string" },
                        end: { type: "string" },
                        locationId: {
                          type: ["string", "null"],
                        },
                        notes: {
                          type: ["string", "null"],
                        },
                      },
                      required: [
                        "id",
                        "type",
                        "title",
                        "start",
                        "end",
                        "projectId",
                        "taskId",
                        "locationId",
                        "notes",
                      ],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["date", "items"],
                additionalProperties: false,
              },
            },
          },
          required: ["days"],
          additionalProperties: false,
        },
        strict: true,
      },
    },
  });

  // Response body als JSON object ophalen
  // For Responses API with structured output, the response structure may be different
  // Check if output_text exists (simple text) or output array (structured)
  let jsonText;
  if (response.output_text) {
    jsonText = response.output_text;
  } else if (response.output && response.output.length > 0) {
    // Structured output might be in output array
    jsonText =
      typeof response.output[0] === "string"
        ? response.output[0]
        : JSON.stringify(response.output[0]);
  } else {
    throw new Error("Unexpected response format from OpenAI API");
  }

  console.log(jsonText);
  const planning = JSON.parse(jsonText);

  return planning;
}

export const GET = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;

    if (!user) {
      return NextResponse.json({ error: "user is required" }, { status: 400 });
    }

    // Calculate date range: today to 14 days later
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoWeeksLater = new Date(today);
    twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
    twoWeeksLater.setHours(23, 59, 59, 999);

    // Fetch calendar events
    const calendarEvents = await getUserCalendarEvents(
      user,
      today,
      twoWeeksLater
    );

    // Fetch active projects with all planning data
    const projects = await getActiveProjectsForAgenda(
      user,
      today,
      twoWeeksLater
    );

    // Get holidays in range
    const holidays = getHolidaysInRange(today, twoWeeksLater);
    const holidaysFormatted = holidays.map((h) => {
      const date = new Date(h);
      date.setHours(0, 0, 0, 0);
      return date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
    });
    // Build response
    return NextResponse.json({
      calendarEvents,
      projects,
      users: [
        {
          name: user,
          workPreferences: {
            workdayStart: 8,
            minBlockDurationMinutes: 2,
            workdayEnd: 16,
            workdays: [1, 2, 3, 4, 5], // Mon-Fri
            timeZone: "Europe/Amsterdam",
            maxFocusHoursPerDay: 6,
            minBreakMinutesBetweenBlocks: 15,
          },
        },
      ],
      workPreferences: {
        workdayStart: 9,
        workdayEnd: 17,
        workdays: [1, 2, 3, 4, 5], // Mon-Fri
      },
      holidays: holidaysFormatted,
      dateRange: {
        start: today.toISOString().split("T")[0],
        end: twoWeeksLater.toISOString().split("T")[0],
      },
    });
  } catch (error) {
    console.error("Error fetching agenda data:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch agenda data",
        message: error.message,
      },
      { status: 500 }
    );
  }
});

export const POST = auth0.withApiAuthRequired(async (req, context) => {
  try {
    const session = await auth0.getSession(req);
    const user = session.user.sub;

    if (!user) {
      return NextResponse.json({ error: "user is required" }, { status: 400 });
    }

    // Calculate date range: today to 14 days later
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoWeeksLater = new Date(today);
    twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
    twoWeeksLater.setHours(23, 59, 59, 999);

    // Fetch calendar events
    const calendarEvents = await getUserCalendarEvents(
      user,
      today,
      twoWeeksLater
    );

    // Fetch active projects with all planning data
    const projects = await getActiveProjectsForAgenda(
      user,
      today,
      twoWeeksLater
    );
    console.log(JSON.stringify(projects, null, 2));
    // Get holidays in range
    const holidays = getHolidaysInRange(today, twoWeeksLater);
    const holidaysFormatted = holidays.map((h) => {
      const date = new Date(h);
      date.setHours(0, 0, 0, 0);
      return date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
    });

    // Build weekInput object
    const weekInput = {
      calendarEvents,
      projects,
      users: [
        {
          name: user,
          homeZipCode: "1234AB",
          workPreferences: {
            workdayStart: 8,
            minBlockDurationMinutes: 2,
            workdayEnd: 16,
            workdays: [1, 2, 3, 4, 5], // Mon-Fri
            timeZone: "Europe/Amsterdam",
            maxFocusHoursPerDay: 6,
            minBreakMinutesBetweenBlocks: 15,
          },
        },
      ],
      workPreferences: {
        workdayStart: 9,
        workdayEnd: 17,
        workdays: [1, 2, 3, 4, 5], // Mon-Fri
      },
      holidays: holidaysFormatted,
      dateRange: {
        start: today.toISOString().split("T")[0],
        end: twoWeeksLater.toISOString().split("T")[0],
      },
    };

    // Generate planning using OpenAI
    const planning = await generatePlanning(weekInput);

    // Return both raw data and generated planning
    return NextResponse.json({
      planning,
      calendarEvents,
      projects,
      users: weekInput.users,
      workPreferences: weekInput.workPreferences,
      holidays: holidaysFormatted,
      dateRange: weekInput.dateRange,
    });
  } catch (error) {
    console.error("Error generating planning:", error);
    return NextResponse.json(
      {
        error: "Failed to generate planning",
        message: error.message,
      },
      { status: 500 }
    );
  }
});
