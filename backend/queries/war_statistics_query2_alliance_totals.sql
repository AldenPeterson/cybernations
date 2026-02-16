-- Overall Alliance Totals
-- Summary by alliance showing total damage dealt, received, and net damage
-- Aggregates all wars (both declaring and receiving) for each alliance

WITH recent_wars AS (
    SELECT 
        w.war_id,
        w.declaring_alliance_id,
        w.receiving_alliance_id,
        CASE 
            WHEN w.destruction IS NULL OR w.destruction = '' THEN 0
            WHEN w.defend_percent IS NULL OR w.defend_percent = 0 THEN 0
            ELSE CAST(REPLACE(w.destruction, ',', '') AS NUMERIC) * (COALESCE(w.defend_percent, 0) / 100.0)
        END AS declaring_damage_dealt,
        CASE 
            WHEN w.destruction IS NULL OR w.destruction = '' THEN 0
            WHEN w.attack_percent IS NULL OR w.attack_percent = 0 THEN 0
            ELSE CAST(REPLACE(w.destruction, ',', '') AS NUMERIC) * (COALESCE(w.attack_percent, 0) / 100.0)
        END AS declaring_damage_received,
        CASE 
            WHEN w.destruction IS NULL OR w.destruction = '' THEN 0
            WHEN w.attack_percent IS NULL OR w.attack_percent = 0 THEN 0
            ELSE CAST(REPLACE(w.destruction, ',', '') AS NUMERIC) * (COALESCE(w.attack_percent, 0) / 100.0)
        END AS receiving_damage_dealt,
        CASE 
            WHEN w.destruction IS NULL OR w.destruction = '' THEN 0
            WHEN w.defend_percent IS NULL OR w.defend_percent = 0 THEN 0
            ELSE CAST(REPLACE(w.destruction, ',', '') AS NUMERIC) * (COALESCE(w.defend_percent, 0) / 100.0)
        END AS receiving_damage_received,
        da.name AS declaring_alliance_name,
        ra.name AS receiving_alliance_name
    FROM wars w
    INNER JOIN nations dn ON w.declaring_nation_id = dn.id
    INNER JOIN nations rn ON w.receiving_nation_id = rn.id
    LEFT JOIN alliances da ON w.declaring_alliance_id = da.id
    LEFT JOIN alliances ra ON w.receiving_alliance_id = ra.id
    WHERE TO_DATE(SPLIT_PART(w.date, ' ', 1), 'MM/DD/YYYY') > TO_DATE('2/5/2026', 'MM/DD/YYYY')
),
declaring_totals AS (
    SELECT 
        declaring_alliance_id AS alliance_id,
        declaring_alliance_name AS alliance_name,
        SUM(declaring_damage_dealt) AS total_damage_dealt,
        SUM(declaring_damage_received) AS total_damage_received,
        COUNT(DISTINCT war_id) AS offensive_wars
    FROM recent_wars
    WHERE declaring_alliance_id IS NOT NULL
    GROUP BY declaring_alliance_id, declaring_alliance_name
),
receiving_totals AS (
    SELECT 
        receiving_alliance_id AS alliance_id,
        receiving_alliance_name AS alliance_name,
        SUM(receiving_damage_dealt) AS total_damage_dealt,
        SUM(receiving_damage_received) AS total_damage_received,
        COUNT(DISTINCT war_id) AS defensive_wars
    FROM recent_wars
    WHERE receiving_alliance_id IS NOT NULL
    GROUP BY receiving_alliance_id, receiving_alliance_name
)
SELECT 
    COALESCE(dt.alliance_id, rt.alliance_id) AS alliance_id,
    COALESCE(dt.alliance_name, rt.alliance_name) AS alliance_name,
    COALESCE(dt.total_damage_dealt, 0) + COALESCE(rt.total_damage_dealt, 0) AS total_damage_dealt,
    COALESCE(dt.total_damage_received, 0) + COALESCE(rt.total_damage_received, 0) AS total_damage_received,
    (COALESCE(dt.total_damage_dealt, 0) + COALESCE(rt.total_damage_dealt, 0)) - 
    (COALESCE(dt.total_damage_received, 0) + COALESCE(rt.total_damage_received, 0)) AS net_damage,
    COALESCE(dt.offensive_wars, 0) AS offensive_wars,
    COALESCE(rt.defensive_wars, 0) AS defensive_wars
FROM declaring_totals dt
FULL OUTER JOIN receiving_totals rt ON dt.alliance_id = rt.alliance_id
WHERE (COALESCE(dt.total_damage_dealt, 0) + COALESCE(rt.total_damage_dealt, 0)) > 0 
    OR (COALESCE(dt.total_damage_received, 0) + COALESCE(rt.total_damage_received, 0)) > 0
ORDER BY ((COALESCE(dt.total_damage_dealt, 0) + COALESCE(rt.total_damage_dealt, 0)) - 
    (COALESCE(dt.total_damage_received, 0) + COALESCE(rt.total_damage_received, 0))) DESC;


