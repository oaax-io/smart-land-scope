import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeWirtschaft, type FloorInput } from "@/lib/wirtschaft-engine";
import {
  buildEngineInput,
  defaultWirtschaftMode,
  zoneSuggestion,
  type FloorRow,
  type WirtschaftMode,
  type WirtschaftRow,
} from "@/lib/wirtschaft-input";

export { buildEngineInput, defaultWirtschaftMode } from "@/lib/wirtschaft-input";

/**
 * Lädt Analyse, Geschosse und Wirtschaftlichkeits-Parameter und rechnet NUR über computeWirtschaft().
 * paramsOverride: ungespeicherte Live-Eingaben aus der Card (überschreiben die DB-Zeile).
 */
export function useWirtschaft(
  analysisId: string,
  mode: WirtschaftMode,
  floorsOverride?: FloorInput[],
  paramsOverride?: WirtschaftRow,
) {
  const analysisQ = useQuery({
    queryKey: ["analysis", analysisId],
    queryFn: async () => {
      const { data, error } = await supabase.from("analyses").select("*").eq("id", analysisId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const floorsQ = useQuery({
    queryKey: ["floors-wirt", analysisId],
    queryFn: async () => {
      const { data } = await supabase
        .from("analysis_floors")
        .select("floor_index,gross_area_m2,floor_height_m")
        .eq("analysis_id", analysisId);
      return (data ?? []) as FloorRow[];
    },
  });
  const wirtQ = useQuery({
    queryKey: ["wirtschaft-params", analysisId],
    queryFn: async () => {
      const { data } = await supabase.from("analysis_wirtschaft").select("*").eq("analysis_id", analysisId).maybeSingle();
      return data as (WirtschaftRow & Record<string, unknown>) | null;
    },
  });

  const value = useMemo(() => {
    if (!analysisQ.data) return null;
    const row = { ...(wirtQ.data ?? {}), ...(paramsOverride ?? {}) } as WirtschaftRow;
    const input = buildEngineInput(analysisQ.data, floorsQ.data ?? [], row, mode, floorsOverride);
    return { input, result: computeWirtschaft(input), zone: zoneSuggestion(analysisQ.data) };
  }, [analysisQ.data, floorsQ.data, wirtQ.data, paramsOverride, mode, floorsOverride]);

  return {
    ...value,
    savedParams: wirtQ.data,
    savedParamsLoaded: wirtQ.isFetched,
    floorRows: floorsQ.data,
    autoMode: defaultWirtschaftMode(floorsQ.data),
    isLoading: analysisQ.isLoading || floorsQ.isLoading || wirtQ.isLoading,
  };
}
