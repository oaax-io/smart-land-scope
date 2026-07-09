-- Entferne duplizierte Standard-Geschosse (nur NULL BGF) - behalte pro (analysis_id, floor_index) das älteste
DELETE FROM public.analysis_floors a
USING public.analysis_floors b
WHERE a.analysis_id = b.analysis_id
  AND a.floor_index = b.floor_index
  AND a.gross_area_m2 IS NULL
  AND b.gross_area_m2 IS NULL
  AND a.ctid > b.ctid;