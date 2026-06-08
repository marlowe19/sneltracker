import { test, expect } from "@playwright/test";
import {
  navigateToUserPage,
  openDayModal,
  closeDayModal,
  createEntryViaApi,
  createE2eProject,
  createManualEntry,
  deleteEntryViaApi,
  deleteProjectById,
  acceptNextConfirm,
  expandEntryCard,
  expectEntryTimesConsistent,
  fetchDayEntries,
  findEntryCard,
  formatDayDateLocal,
  getCollapsedDurationText,
  getEntryForm,
  getTodayDayIndex,
  localDayDateTimeIso,
  parseDurationString,
  saveExpandedEntry,
  stopAllRunningTimers,
  switchDayTab,
  waitForApiCalls,
} from "./helpers/test-helpers";

test.describe("Day entry duration & time sync @mobile", () => {
  let project;
  const createdEntryIds = [];

  test.beforeEach(async ({ page }) => {
    await navigateToUserPage(page);
    await stopAllRunningTimers(page);
    project = await createE2eProject(page);
    await page.reload();
    await waitForApiCalls(page);
    createdEntryIds.length = 0;
  });

  test.afterEach(async ({ page }) => {
    for (const entryId of createdEntryIds) {
      await deleteEntryViaApi(page, entryId);
    }
    await deleteProjectById(page, project?.id);
    await stopAllRunningTimers(page);
  });

  async function seedEntryWithStartAndEnd(
    page,
    { startH, startM, endH, endM, hourlyRate = 55 }
  ) {
    const startTime = localDayDateTimeIso(startH, startM);
    const endTime = localDayDateTimeIso(endH, endM);
    const durationMs =
      new Date(endTime).getTime() - new Date(startTime).getTime();

    const entry = await createEntryViaApi(page, {
      startTime,
      endTime,
      durationMs,
      projectId: project.id,
      hourlyRate,
    });

    createdEntryIds.push(entry.id);
    return entry;
  }

  function formatClock(hours, minutes) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  test("should save duration-only edit on entry with start and end times @smoke", async ({
    page,
  }) => {
    await seedEntryWithStartAndEnd(page, {
      startH: 11,
      startM: 42,
      endH: 16,
      endM: 42,
    });

    await page.reload();
    await waitForApiCalls(page);
    await openDayModal(page, getTodayDayIndex());
    await switchDayTab(page, "entries");

    const card = await expandEntryCard(page, {
      projectName: project.name,
      start: "11:42",
      end: "16:42",
      duration: "5:00",
    });
    const form = getEntryForm(card);

    await expect(form.startTime).toHaveValue("11:42");
    await expect(form.endTime).toHaveValue("16:42");
    await expect(form.duration).toHaveValue("5:00");

    await form.duration.fill("4:57");

    const { entry, patchBody } = await saveExpandedEntry(page);

    expect(patchBody.duration_ms).toBe(parseDurationString("4:57"));
    expect(patchBody.start_time).toBeTruthy();
    expect(patchBody.end_time).toBeTruthy();
    expectEntryTimesConsistent(entry);

    await expect(form.duration).toHaveValue("4:57");
    await expect(form.startTime).toHaveValue("11:42");
    await expect(form.endTime).toHaveValue("16:39");

    const collapsedCard = findEntryCard(page, {
      projectName: project.name,
      start: "11:42",
    });
    expect(await getCollapsedDurationText(collapsedCard)).toBe("4:57");
  });

  test("should persist duration-only edit after closing and reopening modal", async ({
    page,
  }) => {
    const seeded = await seedEntryWithStartAndEnd(page, {
      startH: 11,
      startM: 43,
      endH: 16,
      endM: 43,
    });

    await page.reload();
    await waitForApiCalls(page);
    await openDayModal(page, getTodayDayIndex());
    const card = await expandEntryCard(page, {
      projectName: project.name,
      start: "11:43",
      duration: "5:00",
    });
    await getEntryForm(card).duration.fill("3:30");
    await saveExpandedEntry(page);
    await closeDayModal(page);

    await openDayModal(page, getTodayDayIndex());
    await switchDayTab(page, "entries");

    const collapsedCard = findEntryCard(page, {
      projectName: project.name,
      start: "11:43",
    });
    expect(await getCollapsedDurationText(collapsedCard)).toBe("3:30");

    const entries = await fetchDayEntries(page, formatDayDateLocal());
    const updated = entries.find((e) => e.id === seeded.id);
    expect(updated).toBeTruthy();
    expect(updated.duration_ms).toBe(parseDurationString("3:30"));
    expectEntryTimesConsistent(updated);
  });

  test("should update end time field live when duration is edited", async ({
    page,
  }) => {
    await seedEntryWithStartAndEnd(page, {
      startH: 11,
      startM: 44,
      endH: 16,
      endM: 44,
    });

    await page.reload();
    await waitForApiCalls(page);
    await openDayModal(page, getTodayDayIndex());

    const card = await expandEntryCard(page, {
      projectName: project.name,
      start: "11:44",
      duration: "5:00",
    });
    const form = getEntryForm(card);
    await form.duration.fill("2:15");

    await expect(form.endTime).toHaveValue("13:59");
    await expect(form.startTime).toHaveValue("11:44");
  });

  test("should recalculate duration when start and end times are edited", async ({
    page,
  }) => {
    await seedEntryWithStartAndEnd(page, {
      startH: 11,
      startM: 45,
      endH: 14,
      endM: 45,
    });

    await page.reload();
    await waitForApiCalls(page);
    await openDayModal(page, getTodayDayIndex());

    const card = await expandEntryCard(page, {
      projectName: project.name,
      start: "11:45",
      end: "14:45",
      duration: "3:00",
    });
    const form = getEntryForm(card);
    await form.startTime.fill("10:00");
    await form.endTime.fill("12:30");

    const { entry, patchBody } = await saveExpandedEntry(page);

    expect(patchBody.start_time).toBeTruthy();
    expect(patchBody.end_time).toBeTruthy();
    expect(patchBody.duration_ms).toBe(parseDurationString("2:30"));
    expectEntryTimesConsistent(entry);

    await expect(form.duration).toHaveValue("2:30");

    const collapsedCard = findEntryCard(page, {
      projectName: project.name,
      start: "10:00",
    });
    expect(await getCollapsedDurationText(collapsedCard)).toBe("2:30");
  });

  test("should edit duration on re-opened manual entry that has stored start time", async ({
    page,
  }) => {
    await openDayModal(page, getTodayDayIndex());
    await createManualEntry(page, {
      duration: "1:00",
      projectName: project.name,
      projectId: project.id,
    });

    const entriesAfterCreate = await fetchDayEntries(page, formatDayDateLocal());
    const created = entriesAfterCreate.find((e) => e.project_id === project.id);
    expect(created).toBeTruthy();
    createdEntryIds.push(created.id);
    expect(created.start_time).toBeTruthy();

    const card = await expandEntryCard(page, {
      projectName: project.name,
      duration: "1:00",
    });
    const form = getEntryForm(card);
    await expect(form.duration).toHaveValue("1:00");

    await form.duration.fill("1:45");
    const { entry } = await saveExpandedEntry(page);

    expect(entry.duration_ms).toBe(parseDurationString("1:45"));
    expectEntryTimesConsistent(entry);

    const collapsedCard = findEntryCard(page, {
      projectName: project.name,
    });
    expect(await getCollapsedDurationText(collapsedCard)).toBe("1:45");
  });

  test("should keep start time fixed when only duration changes", async ({
    page,
  }) => {
    const seeded = await seedEntryWithStartAndEnd(page, {
      startH: 11,
      startM: 46,
      endH: 16,
      endM: 46,
    });

    await page.reload();
    await waitForApiCalls(page);
    await openDayModal(page, getTodayDayIndex());

    const card = await expandEntryCard(page, {
      projectName: project.name,
      start: "11:46",
      duration: "5:00",
    });
    await getEntryForm(card).duration.fill("4:57");

    const { entry } = await saveExpandedEntry(page);

    const originalStart = new Date(seeded.start_time).getTime();
    const updatedStart = new Date(entry.start_time).getTime();
    expect(updatedStart).toBe(originalStart);

    expect(entry.duration_ms).toBe(parseDurationString("4:57"));
    expectEntryTimesConsistent(entry);
    expect(formatClock(
      new Date(entry.end_time).getHours(),
      new Date(entry.end_time).getMinutes()
    )).toBe("16:43");
  });

  test("should fix inconsistent duration vs start/end on duration edit", async ({
    page,
  }) => {
    const startTime = localDayDateTimeIso(11, 47);
    const endTime = localDayDateTimeIso(16, 47);
    const inconsistentDurationMs = parseDurationString("4:57");

    const entry = await createEntryViaApi(page, {
      startTime,
      endTime,
      durationMs: inconsistentDurationMs,
      projectId: project.id,
    });
    createdEntryIds.push(entry.id);

    expect(entry.duration_ms).toBe(inconsistentDurationMs);
    expect(
      new Date(endTime).getTime() - new Date(startTime).getTime()
    ).not.toBe(inconsistentDurationMs);

    await page.reload();
    await waitForApiCalls(page);
    await openDayModal(page, getTodayDayIndex());

    const card = await expandEntryCard(page, {
      projectName: project.name,
      start: "11:47",
      end: "16:47",
    });
    await getEntryForm(card).duration.fill("5:00");

    const { entry: fixed } = await saveExpandedEntry(page);
    expectEntryTimesConsistent(fixed);
    expect(fixed.duration_ms).toBe(parseDurationString("5:00"));
  });

  test("should delete entry after duration edit tests cleanup path", async ({
    page,
  }) => {
    await openDayModal(page, getTodayDayIndex());
    await createManualEntry(page, {
      duration: "0:45",
      projectName: project.name,
      projectId: project.id,
    });

    const card = await expandEntryCard(page, {
      projectName: project.name,
      duration: "0:45",
    });
    acceptNextConfirm(page);
    await card.getByRole("button", { name: "Verwijderen" }).click();
    await waitForApiCalls(page);
    await expect(card).not.toBeVisible();
  });
});
