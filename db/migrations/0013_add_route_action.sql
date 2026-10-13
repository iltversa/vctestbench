-- The ROUTE action: checks which page of the Sandbox app the tablet is on.
-- The route itself is configured on the step in the flow.
INSERT INTO "test_actions" ("title", "has_confirmation", "confirmation_timeout", "action_timeout", "icon")
SELECT 'ROUTE', false, NULL::integer, 5, 'faLocationDot'
WHERE NOT EXISTS (
  SELECT 1 FROM "test_actions" a WHERE a."title" = 'ROUTE'
);
