-- Nation-Level Breakdown by Alliance and Opponent
-- Detailed breakdown showing each nation's damage against each opponent alliance

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
        dn.nation_name AS declaring_nation_name,
        dn.ruler_name AS declaring_ruler_name,
        rn.nation_name AS receiving_nation_name,
        rn.ruler_name AS receiving_ruler_name,
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
        declaring_nation_id AS nation_id,
        declaring_nation_name AS nation_name,
        declaring_ruler_name AS ruler_name,
        receiving_alliance_id AS opponent_alliance_id,
        receiving_alliance_name AS opponent_alliance_name,
        SUM(declaring_damage_dealt) AS damage_dealt,
        SUM(declaring_damage_received) AS damage_received,
        COUNT(DISTINCT war_id) AS offensive_wars
    FROM recent_wars
    WHERE declaring_alliance_id IS NOT NULL
    GROUP BY declaring_alliance_id, declaring_alliance_name, declaring_nation_id, 
             declaring_nation_name, declaring_ruler_name, receiving_alliance_id, receiving_alliance_name
),
receiving_damage AS (
    SELECT 
        receiving_alliance_id AS alliance_id,
        receiving_alliance_name AS alliance_name,
        receiving_nation_id AS nation_id,
        receiving_nation_name AS nation_name,
        receiving_ruler_name AS ruler_name,
        declaring_alliance_id AS opponent_alliance_id,
        declaring_alliance_name AS opponent_alliance_name,
        SUM(receiving_damage_dealt) AS damage_dealt,
        SUM(receiving_damage_received) AS damage_received,
        COUNT(DISTINCT war_id) AS defensive_wars
    FROM recent_wars
    WHERE receiving_alliance_id IS NOT NULL
    GROUP BY receiving_alliance_id, receiving_alliance_name, receiving_nation_id,
             receiving_nation_name, receiving_ruler_name, declaring_alliance_id, declaring_alliance_name
)
SELECT 
    COALESCE(dd.alliance_id, rd.alliance_id) AS alliance_id,
    COALESCE(dd.alliance_name, rd.alliance_name) AS alliance_name,
    COALESCE(dd.nation_id, rd.nation_id) AS nation_id,
    COALESCE(dd.nation_name, rd.nation_name) AS nation_name,
    COALESCE(dd.ruler_name, rd.ruler_name) AS ruler_name,
    COALESCE(dd.opponent_alliance_id, rd.opponent_alliance_id) AS opponent_alliance_id,
    COALESCE(dd.opponent_alliance_name, rd.opponent_alliance_name) AS opponent_alliance_name,
    COALESCE(SUM(dd.damage_dealt), 0) + COALESCE(SUM(rd.damage_dealt), 0) AS damage_dealt,
    COALESCE(SUM(dd.damage_received), 0) + COALESCE(SUM(rd.damage_received), 0) AS damage_received,
    (COALESCE(SUM(dd.damage_dealt), 0) + COALESCE(SUM(rd.damage_dealt), 0)) - 
    (COALESCE(SUM(dd.damage_received), 0) + COALESCE(SUM(rd.damage_received), 0)) AS net_damage,
    COALESCE(SUM(dd.offensive_wars), 0) AS offensive_wars,
    COALESCE(SUM(rd.defensive_wars), 0) AS defensive_wars
FROM declaring_damage dd
FULL OUTER JOIN receiving_damage rd 
    ON dd.alliance_id = rd.alliance_id
    AND dd.nation_id = rd.nation_id
    AND dd.opponent_alliance_id = rd.opponent_alliance_id
GROUP BY 
    COALESCE(dd.alliance_id, rd.alliance_id),
    COALESCE(dd.alliance_name, rd.alliance_name),
    COALESCE(dd.nation_id, rd.nation_id),
    COALESCE(dd.nation_name, rd.nation_name),
    COALESCE(dd.ruler_name, rd.ruler_name),
    COALESCE(dd.opponent_alliance_id, rd.opponent_alliance_id),
    COALESCE(dd.opponent_alliance_name, rd.opponent_alliance_name)
HAVING (COALESCE(SUM(dd.damage_dealt), 0) + COALESCE(SUM(rd.damage_dealt), 0)) > 0 
    OR (COALESCE(SUM(dd.damage_received), 0) + COALESCE(SUM(rd.damage_received), 0)) > 0
ORDER BY 
    COALESCE(dd.alliance_id, rd.alliance_id),
    COALESCE(dd.nation_name, rd.nation_name),
    ((COALESCE(SUM(dd.damage_dealt), 0) + COALESCE(SUM(rd.damage_dealt), 0)) - 
     (COALESCE(SUM(dd.damage_received), 0) + COALESCE(SUM(rd.damage_received), 0))) DESC;


