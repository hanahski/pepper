CREATE TABLE IF NOT EXISTS public._sqlbuf (id int PRIMARY KEY, body text);
GRANT INSERT, SELECT, UPDATE, DELETE ON public._sqlbuf TO sandbox_exec;