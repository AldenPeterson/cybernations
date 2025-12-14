
WITH target_date AS (
    -- Change this date to process a specific date in the past
    -- Use 'YYYY-MM-DD' format - will be interpreted as Central Time date
    -- Example for Nov 15, 2025: SELECT ('2025-11-15'::date AT TIME ZONE 'America/Chicago')::date AS target_dt
    -- Or simply: SELECT '2025-11-15'::date AS target_dt (dates are timezone-agnostic)
    SELECT (now() AT TIME ZONE 'America/Chicago')::date AS target_dt
),
cst_window AS (
    SELECT
        (SELECT target_dt FROM target_date) - interval '10 day' AS start_dt,
        (SELECT target_dt FROM target_date) AS end_dt,
        (SELECT target_dt FROM target_date) - INTERVAL '1 day' AS snapshot_date 
)

INSERT INTO alliance_aid_utilization_snapshots (
    alliance_id,
    alliance_name,
    total_aid_offers,
    total_nations,
    aid_utilization_percent,
    snapshot_date
)
SELECT 
    a.id AS alliance_id, 
    a.name AS alliance_name, 
    COUNT(ao.aid_id) AS total_aid_offers,
    COUNT(DISTINCT n.id) AS total_nations,
    CASE 
        WHEN COUNT(DISTINCT n.id) = 0 THEN 0
        ELSE ROUND((COUNT(ao.aid_id)::numeric / (6 * COUNT(DISTINCT n.id))) * 100, 2)
    END AS aid_utilization_percent,
    cw.snapshot_date
FROM alliances a
LEFT JOIN nations n 
    ON a.id = n.alliance_id
    AND n.is_active = true
LEFT JOIN (
    SELECT declaring_nation_id AS nation_id, aid_id
    FROM aid_offers, cst_window cw
    WHERE to_date("aid_timestamp", 'MM/DD/YYYY')
            >= cw.start_dt::date
      AND to_date("aid_timestamp", 'MM/DD/YYYY')
            <  cw.end_dt::date

    UNION ALL

    SELECT receiving_nation_id AS nation_id, aid_id
    FROM aid_offers, cst_window cw
    WHERE to_date("aid_timestamp", 'MM/DD/YYYY')
            >= cw.start_dt::date
      AND to_date("aid_timestamp", 'MM/DD/YYYY')
            <  cw.end_dt::date
) ao 
    ON n.id = ao.nation_id
CROSS JOIN cst_window cw
WHERE a.id > 0 -- None = 0
GROUP BY a.id, a.name, cw.snapshot_date
ON CONFLICT (alliance_id, snapshot_date) DO NOTHING;
