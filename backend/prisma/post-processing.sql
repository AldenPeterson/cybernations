
WITH cst_window AS (
    SELECT
        date_trunc('day', now() AT TIME ZONE 'America/Chicago') - interval '10 day' AS start_dt,
        date_trunc('day', now() AT TIME ZONE 'America/Chicago') AS end_dt,
        date_trunc('day', now() AT TIME ZONE 'America/Chicago') AS snapshot_date
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
LEFT JOIN (
    SELECT declaring_nation_id AS nation_id, aid_id
    FROM aid_offers, cst_window cw
    WHERE to_timestamp(date, 'MM/DD/YYYY HH12:MI:SS AM') AT TIME ZONE 'America/Chicago'
          >= cw.start_dt
      AND to_timestamp(date, 'MM/DD/YYYY HH12:MI:SS AM') AT TIME ZONE 'America/Chicago'
          < cw.end_dt

    UNION ALL

    SELECT receiving_nation_id AS nation_id, aid_id
    FROM aid_offers, cst_window cw
    WHERE to_timestamp(date, 'MM/DD/YYYY HH12:MI:SS AM') AT TIME ZONE 'America/Chicago'
          >= cw.start_dt
      AND to_timestamp(date, 'MM/DD/YYYY HH12:MI:SS AM') AT TIME ZONE 'America/Chicago'
          < cw.end_dt
) ao 
    ON n.id = ao.nation_id
CROSS JOIN cst_window cw
WHERE a.id > 0 -- None = 0
GROUP BY a.id, a.name, cw.snapshot_date
ON CONFLICT (alliance_id, snapshot_date) DO NOTHING;
