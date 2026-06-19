
-- Status enum
CREATE TYPE public.feedback_status AS ENUM ('open','in_review','in_progress','resolved','closed','wont_fix');
CREATE TYPE public.feedback_category AS ENUM ('bug','feature','question','other');
CREATE TYPE public.feedback_priority AS ENUM ('low','medium','high','urgent');

-- Feedback table
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 3 AND 5000),
  category public.feedback_category NOT NULL DEFAULT 'other',
  priority public.feedback_priority NOT NULL DEFAULT 'medium',
  status public.feedback_status NOT NULL DEFAULT 'open',
  screenshot_path TEXT,
  page_url TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own feedback or admins see all"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Authenticated can create own feedback"
  ON public.feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners edit own, admins edit any"
  ON public.feedback FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Owners or admins delete"
  ON public.feedback FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

CREATE TRIGGER feedback_set_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX feedback_user_id_idx ON public.feedback(user_id);
CREATE INDEX feedback_status_idx ON public.feedback(status);
CREATE INDEX feedback_created_at_idx ON public.feedback(created_at DESC);

-- Comments table
CREATE TABLE public.feedback_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_comments TO authenticated;
GRANT ALL ON public.feedback_comments TO service_role;

ALTER TABLE public.feedback_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments visible to feedback owner or admins"
  ON public.feedback_comments FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.feedback f
      WHERE f.id = feedback_comments.feedback_id
        AND f.user_id = auth.uid()
    )
  );

CREATE POLICY "Owner or admin can comment"
  ON public.feedback_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND (
      public.is_platform_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.feedback f
        WHERE f.id = feedback_comments.feedback_id
          AND f.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Author or admin delete comment"
  ON public.feedback_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

CREATE INDEX feedback_comments_feedback_id_idx ON public.feedback_comments(feedback_id, created_at);
