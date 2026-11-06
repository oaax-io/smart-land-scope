ALTER TABLE public.analyses ADD CONSTRAINT analyses_max_height_positive CHECK (max_height IS NULL OR max_height > 0) NOT VALID;
ALTER TABLE public.analyses ADD CONSTRAINT analyses_max_floors_positive CHECK (max_floors IS NULL OR max_floors > 0) NOT VALID;
ALTER TABLE public.analyses ADD CONSTRAINT analyses_utilization_ratio_positive CHECK (utilization_ratio IS NULL OR utilization_ratio > 0) NOT VALID;
ALTER TABLE public.analyses ADD CONSTRAINT analyses_bcr_positive CHECK (building_coverage_ratio IS NULL OR building_coverage_ratio > 0) NOT VALID;
ALTER TABLE public.analyses VALIDATE CONSTRAINT analyses_max_height_positive;
ALTER TABLE public.analyses VALIDATE CONSTRAINT analyses_max_floors_positive;
ALTER TABLE public.analyses VALIDATE CONSTRAINT analyses_utilization_ratio_positive;
ALTER TABLE public.analyses VALIDATE CONSTRAINT analyses_bcr_positive;