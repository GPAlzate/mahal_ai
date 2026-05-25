ALTER TABLE public.users
  ADD COLUMN username text;

ALTER TABLE public.users
  ADD CONSTRAINT users_username_key UNIQUE (username);

ALTER TABLE public.users
  ADD CONSTRAINT users_username_format CHECK (
    username IS NULL OR username ~ '^(?!.*[-_]{2})[a-z0-9_-]{3,20}$'
  );

CREATE INDEX idx_users_username ON public.users (username) WHERE deleted_at IS NULL;
