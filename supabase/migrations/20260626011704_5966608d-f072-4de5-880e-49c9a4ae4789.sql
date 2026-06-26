
ALTER TABLE public.knowledge_entries ALTER COLUMN verified SET DEFAULT true;
ALTER TABLE public.regulation_rules ALTER COLUMN verified SET DEFAULT true;
UPDATE public.knowledge_entries SET verified = true WHERE verified = false;
UPDATE public.regulation_rules SET verified = true WHERE verified = false;
