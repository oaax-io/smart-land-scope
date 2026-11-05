import { describe, it, expect } from "vitest";
import {
  computeWirtschaft,
  buildFloorsFromZone,
  DEFAULT_COST,
  DEFAULT_REVENUE,
  DEFAULT_RESIDUAL,
  type EngineInput,
} from "./wirtschaft-engine";

const base = (over: Partial<EngineInput> = {}): EngineInput => ({
  parcelAreaM2: 1000,
  footprintM2: 300,
  floors: [
    { index: -1, bgfM2: 300, heightM: 3 },
    { index: 0, bgfM2: 300, heightM: 3 },
    { index: 1, bgfM2: 300, heightM: 3 },
  ],
  cost: { ...DEFAULT_COST, kennwertInklHonorare: true },
  revenue: { ...DEFAULT_REVENUE, marktpreisProM2: 8500 },
  residual: { ...DEFAULT_RESIDUAL },
  ...over,
});

const near = (a: number | null, b: number, tol = 1) => {
  expect(a).not.toBeNull();
  expect(Math.abs((a as number) - b)).toBeLessThanOrEqual(tol);
};

describe("computeWirtschaft", () => {
  it("Pflicht-Testfall mit Defaults", () => {
    const r = computeWirtschaft(base());
    near(r.bkp2.min, 2205000);
    near(r.bkp2.max, 2205000);
    near(r.bkp1, 44100);
    near(r.bkp4, 105000);
    near(r.bkp5.min, 70623);
    near(r.bkp5.max, 117705);
    near(r.bkp6.min, 121236.15);
    near(r.bkp6.max, 197744.4);
    near(r.anlagekosten.min, 2545959.15);
    near(r.anlagekosten.max, 2669549.4);
    near(r.anlagekosten.mittel, 2607754.28);
    near(r.nwf, 390, 0.001);
    near(r.erloes.total, 3315000);
    near(r.residualwertLand, 160109.8);
    expect(r.trace.length).toBeGreaterThan(10);
  });

  it("UG zählt nicht zur NWF", () => {
    const a = computeWirtschaft(base());
    const b = computeWirtschaft(
      base({ floors: [{ index: -1, bgfM2: 900, heightM: 3 }, { index: 0, bgfM2: 300, heightM: 3 }, { index: 1, bgfM2: 300, heightM: 3 }] }),
    );
    expect(b.nwf).toBe(a.nwf);
  });

  it("fehlender Marktpreis → Erlös/Residual null + Warnung", () => {
    const r = computeWirtschaft(base({ revenue: { ...DEFAULT_REVENUE, marktpreisProM2: null } }));
    expect(r.erloes.total).toBeNull();
    expect(r.residualwertLand).toBeNull();
    expect(r.warnings.some((w) => w.includes("Marktpreis"))).toBe(true);
  });

  it("kennwertInklHonorare = false erhöht BKP2 um Honorare", () => {
    const r = computeWirtschaft(base({ cost: { ...DEFAULT_COST, kennwertInklHonorare: false } }));
    near(r.bkp2.min, 2205000 * 1.12);
    near(r.bkp2.max, 2205000 * 1.15);
    expect(r.trace.some((t) => t.label === "BKP 21–28")).toBe(true);
  });

  it("Geschoss mit bgfM2 null wird ignoriert + Warnung", () => {
    const b = base();
    const r = computeWirtschaft({ ...b, floors: [...b.floors, { index: 2, bgfM2: null, heightM: 3 }] });
    expect(r.bgfOber).toBe(600);
    expect(r.warnings.some((w) => w.includes("2. OG"))).toBe(true);
  });
});

describe("buildFloorsFromZone", () => {
  const args = { parcelAreaM2: 1000, uez: null, maxFloors: 3, maxHeightM: null };
  it("AZ 1.2 bleibt 1.2, AZ 120 wird 1.2", () => {
    const a = buildFloorsFromZone({ ...args, az: 1.2 });
    const b = buildFloorsFromZone({ ...args, az: 120 });
    expect(a.footprintM2).toBeCloseTo(400);
    expect(b.footprintM2).toBeCloseTo(400);
  });

  it("nur AZ → BGF_ober = Parzelle × AZ", () => {
    const r = buildFloorsFromZone({ ...args, az: 1.2 });
    const ober = r.floors.filter((f) => f.index >= 0).reduce((s, f) => s + (f.bgfM2 ?? 0), 0);
    expect(ober).toBeCloseTo(1200);
  });

  it("ÜZ 0.5, Parzelle 1574, Höhe 21 → 7 OG à 787 m²", () => {
    const r = buildFloorsFromZone({ parcelAreaM2: 1574, uez: 0.5, az: null, maxFloors: null, maxHeightM: 21 });
    const ober = r.floors.filter((f) => f.index >= 0);
    expect(ober).toHaveLength(7);
    ober.forEach((f) => expect(f.bgfM2).toBeCloseTo(787));
    expect(r.floors.find((f) => f.index === -1)?.bgfM2).toBeCloseTo(787);
    expect(r.source).toContain("7 Obergeschosse");
  });
});
