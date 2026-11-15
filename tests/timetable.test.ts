import { describe, expect, it } from "vitest";
import { eventsOn, hasWeek, nowInfo, toMinutes, weekDays, weekOf } from "@/lib/timetable";

describe("timetable data", () => {
  it("gives a group its own TD (Lundi 26/10, G3: TD Algo 08:30)", () => {
    const evs = eventsOn("2026-10-26", "G3");
    const tdAlgo = evs.find((e) => e.type === "td" && e.subject === "algo");
    expect(tdAlgo).toMatchObject({ start: "08:30", end: "10:15", prof: "H. BOUTGOULA", room: "4 Med" });
    // another group's TD in the same slot is not included
    expect(eventsOn("2026-10-26", "G4").some((e) => e.type === "td" && e.subject === "algo")).toBe(false);
  });

  it("gives a section cours to every group of that section only", () => {
    for (const g of ["G1", "G2", "G3", "G4"]) {
      expect(eventsOn("2026-10-26", g)).toContainEqual(
        expect.objectContaining({ type: "cours", subject: "ana", start: "10:30", room: "Amphi 1" }),
      );
    }
    const g5 = eventsOn("2026-10-26", "G5").filter((e) => e.type === "cours");
    expect(g5).toEqual([expect.objectContaining({ subject: "ana", start: "08:30", room: "Amphi 2" })]);
  });

  it("includes the Mécanique TP with its own times", () => {
    const tp = eventsOn("2026-10-28", "G3").find((e) => e.type === "tp");
    expect(tp).toMatchObject({ start: "10:30", end: "12:30", prof: "OUBBAD / SADIK", title: "TP Mécanique du point" });
    expect(eventsOn("2026-10-28", "G4").some((e) => e.type === "tp")).toBe(false);
  });

  it("sorts events by start time", () => {
    const starts = eventsOn("2026-10-27", "G1").map((e) => e.start ?? "99");
    expect(starts).toEqual([...starts].sort());
    expect(starts).toEqual(["10:30", "12:30", "14:45"]); // TD Électro, TP Méca, TD Algèbre
  });

  it("marks the 31 October holiday", () => {
    expect(eventsOn("2026-10-31", "G1")).toEqual([expect.objectContaining({ type: "off", title: "Fête de l'Unité" })]);
    expect(eventsOn("2026-11-18", "G5")).toEqual([expect.objectContaining({ type: "off", title: "Fête de l'Indépendance" })]);
  });

  it("flags dates inside the (estimated) exam window", () => {
    const exam = eventsOn("2027-01-15", "G6").find((e) => e.type === "exam");
    expect(exam).toMatchObject({ semester: "S1", approx: true });
    expect(eventsOn("2027-01-25", "G6").some((e) => e.type === "exam")).toBe(false);
  });
});

describe("week helpers", () => {
  it("finds the Monday and knows which weeks exist", () => {
    expect(weekOf("2026-10-29")).toBe("2026-10-26");
    expect(weekOf("2026-11-01")).toBe("2026-10-26"); // Sunday belongs to the same week
    expect(weekDays("2026-10-26")).toHaveLength(7);
    expect(hasWeek("2026-10-26")).toBe(true);
    expect(hasWeek("2026-11-02")).toBe(false);
  });

  it("knows what is happening now and what comes next", () => {
    const during = nowInfo("2026-10-26", toMinutes("09:00"), "G3");
    expect(during.current?.subject).toBe("algo");
    expect(during.minutesLeft).toBe(75);
    expect(during.next?.event.subject).toBe("ana");

    const evening = nowInfo("2026-10-30", toMinutes("20:00"), "G3");
    expect(evening.current).toBeNull();
    // Saturday is a holiday and nothing is transcribed after that week yet
    expect(evening.next).toBeNull();
  });
});
