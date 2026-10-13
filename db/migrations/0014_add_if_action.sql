-- The IF action: runs one of two branches depending on a condition read from
-- the tablet (text on screen, the page, the signed-in user, or a script).
-- The condition itself is configured on the step in the flow.
INSERT INTO "test_actions" ("title", "has_confirmation", "confirmation_timeout", "action_timeout", "icon")
SELECT 'IF', false, NULL::integer, 5, 'faCodeFork'
WHERE NOT EXISTS (
  SELECT 1 FROM "test_actions" a WHERE a."title" = 'IF'
);
