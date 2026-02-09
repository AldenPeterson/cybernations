-- Alliance Summary with Opponent Breakdown
-- Shows total damage between alliance pairs
-- Combines A vs B and B vs A into single row, normalized by alliance ID

WITH recent_wars AS (
    SELECT 
        w.war_id,
        w.declaring_nation_id,
        w.receiving_nation_id,
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
        END AS receiving_damage_dealt,
        da.name AS declaring_alliance_name,
        ra.name AS receiving_alliance_name
    FROM wars w
    INNER JOIN nations dn ON w.declaring_nation_id = dn.id
    INNER JOIN nations rn ON w.receiving_nation_id = rn.id
    LEFT JOIN alliances da ON w.declaring_alliance_id = da.id
    LEFT JOIN alliances ra ON w.receiving_alliance_id = ra.id
    WHERE TO_DATE(SPLIT_PART(w.date, ' ', 1), 'MM/DD/YYYY') > TO_DATE('2/5/2026', 'MM/DD/YYYY')
),
declaring_damage AS (
    SELECT 
        declaring_alliance_id AS alliance_id,
        declaring_alliance_name AS alliance_name,
        receiving_alliance_id AS opponent_alliance_id,
        receiving_alliance_name AS opponent_alliance_name,
        SUM(declaring_damage_dealt) AS damage_dealt
    FROM recent_wars
    WHERE declaring_alliance_id IS NOT NULL
    GROUP BY declaring_alliance_id, declaring_alliance_name, receiving_alliance_id, receiving_alliance_name
),
receiving_damage AS (
    SELECT 
        receiving_alliance_id AS alliance_id,
        receiving_alliance_name AS alliance_name,
        declaring_alliance_id AS opponent_alliance_id,
        declaring_alliance_name AS opponent_alliance_name,
        SUM(receiving_damage_dealt) AS damage_dealt
    FROM recent_wars
    WHERE receiving_alliance_id IS NOT NULL
    GROUP BY receiving_alliance_id, receiving_alliance_name, declaring_alliance_id, declaring_alliance_name
),
all_alliance_pairs AS (
    SELECT alliance_id AS alliance1_id, opponent_alliance_id AS alliance2_id,
           alliance_name AS alliance1_name, opponent_alliance_name AS alliance2_name, damage_dealt AS damage
    FROM declaring_damage WHERE alliance_id IS NOT NULL AND opponent_alliance_id IS NOT NULL
    UNION ALL
    SELECT alliance_id AS alliance1_id, opponent_alliance_id AS alliance2_id,
           alliance_name AS alliance1_name, opponent_alliance_name AS alliance2_name, damage_dealt AS damage
    FROM receiving_damage WHERE alliance_id IS NOT NULL AND opponent_alliance_id IS NOT NULL
),
normalized_pairs AS (
    SELECT 
        LEAST(alliance1_id, alliance2_id) AS alliance1_id,
        GREATEST(alliance1_id, alliance2_id) AS alliance2_id,
        CASE WHEN alliance1_id < alliance2_id THEN alliance1_name ELSE alliance2_name END AS alliance1_name,
        CASE WHEN alliance1_id < alliance2_id THEN alliance2_name ELSE alliance1_name END AS alliance2_name,
        damage
    FROM all_alliance_pairs
)
SELECT 
    alliance1_id AS alliance_id,
    alliance1_name AS alliance_name,
    alliance2_id AS opponent_alliance_id,
    alliance2_name AS opponent_alliance_name,
    SUM(damage) AS total_damage,
    COUNT(*) AS nations_involved
FROM normalized_pairs
GROUP BY alliance1_id, alliance2_id, alliance1_name, alliance2_name
HAVING SUM(damage) > 0
ORDER BY SUM(damage) DESC;

