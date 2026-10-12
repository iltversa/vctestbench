-- Built-in action definitions the editor and bridge depend on.
-- Without these a new database has no actions, so no flow can be built.
-- Idempotent: a title that already exists is left untouched.

INSERT INTO "test_actions" ("title", "has_confirmation", "confirmation_timeout", "action_timeout", "icon")
SELECT v.title, v.has_confirmation, v.confirmation_timeout, v.action_timeout, v.icon
FROM (VALUES
  ('PASTE',          false, NULL::integer, 5, 'faPaste'),
  ('AUTHENTICATION', false, NULL::integer, 5, 'faUser'),
  ('CLICK',          false, NULL::integer, 5, NULL),
  ('DELAY',          false, NULL::integer, 5, NULL),
  ('CONFIRMATION',   true,  5,             5, 'faCheck'),
  ('SAVE',           false, NULL::integer, 5, 'faCheck')
) AS v(title, has_confirmation, confirmation_timeout, action_timeout, icon)
WHERE NOT EXISTS (
  SELECT 1 FROM "test_actions" a WHERE a."title" = v.title
);
--> statement-breakpoint
INSERT INTO "confirmation_options" ("action_id", "value", "isSelected")
SELECT a."id", o.value, o.is_selected
FROM "test_actions" a
CROSS JOIN (VALUES ('YES', true), ('NO', false)) AS o(value, is_selected)
WHERE a."title" = 'CONFIRMATION'
  AND NOT EXISTS (
    SELECT 1 FROM "confirmation_options" c WHERE c."action_id" = a."id"
  );
