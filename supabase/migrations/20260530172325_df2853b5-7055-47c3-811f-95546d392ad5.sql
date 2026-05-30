DO $run$
DECLARE s text;
BEGIN
  SELECT body INTO s FROM public._sqlbuf WHERE id = 1; EXECUTE s;
  SELECT body INTO s FROM public._sqlbuf WHERE id = 2; EXECUTE s;
END
$run$;
DROP TABLE IF EXISTS public._sqlbuf;
DROP TABLE IF EXISTS public._whoami;