-- Individual War Records
-- Shows each individual war with details for expanding nation rows
-- Returns wars from both offensive and defensive perspectives

SELECT * FROM (
    SELECT 
        w.war_id,
        w.declaring_nation_id AS nation_id,
        w.declaring_alliance_id AS alliance_id,
        w.receiving_nation_id AS opponent_nation_id,
        w.receiving_alliance_id AS opponent_alliance_id,
        dn.nation_name AS nation_name,
        dn.ruler_name AS ruler_name,
        rn.nation_name AS opponent_nation_name,
        rn.ruler_name AS opponent_ruler_name,
        da.name AS alliance_name,
        ra.name AS opponent_alliance_name,
        'offensive' AS war_type,
        w.status,
        w.date,
        w.end_date,
        w.destruction,
        CASE 
            WHEN w.destruction IS NULL OR w.destruction = '' THEN 0
            WHEN w.defend_percent IS NULL OR w.defend_percent = 0 THEN 0
            ELSE CAST(REPLACE(w.destruction, ',', '') AS NUMERIC) * (COALESCE(w.defend_percent, 0) / 100.0)
        END AS damage_dealt,
        CASE 
            WHEN w.destruction IS NULL OR w.destruction = '' THEN 0
            WHEN w.attack_percent IS NULL OR w.attack_percent = 0 THEN 0
            ELSE CAST(REPLACE(w.destruction, ',', '') AS NUMERIC) * (COALESCE(w.attack_percent, 0) / 100.0)
        END AS damage_received,
        w.attack_percent,
        w.defend_percent
    FROM wars w
    INNER JOIN nations dn ON w.declaring_nation_id = dn.id
    INNER JOIN nations rn ON w.receiving_nation_id = rn.id
    LEFT JOIN alliances da ON w.declaring_alliance_id = da.id
    LEFT JOIN alliances ra ON w.receiving_alliance_id = ra.id
    WHERE 
        TO_DATE(SPLIT_PART(w.date, ' ', 1), 'MM/DD/YYYY') > TO_DATE('2/5/2026', 'MM/DD/YYYY')
        AND w.declaring_alliance_id IS NOT NULL

    UNION ALL

    SELECT 
        w.war_id,
        w.receiving_nation_id AS nation_id,
        w.receiving_alliance_id AS alliance_id,
        w.declaring_nation_id AS opponent_nation_id,
        w.declaring_alliance_id AS opponent_alliance_id,
        rn.nation_name AS nation_name,
        rn.ruler_name AS ruler_name,
        dn.nation_name AS opponent_nation_name,
        dn.ruler_name AS opponent_ruler_name,
        ra.name AS alliance_name,
        da.name AS opponent_alliance_name,
        'defensive' AS war_type,
        w.status,
        w.date,
        w.end_date,
        w.destruction,
        CASE 
            WHEN w.destruction IS NULL OR w.destruction = '' THEN 0
            WHEN w.attack_percent IS NULL OR w.attack_percent = 0 THEN 0
            ELSE CAST(REPLACE(w.destruction, ',', '') AS NUMERIC) * (COALESCE(w.attack_percent, 0) / 100.0)
        END AS damage_dealt,
        CASE 
            WHEN w.destruction IS NULL OR w.destruction = '' THEN 0
            WHEN w.defend_percent IS NULL OR w.defend_percent = 0 THEN 0
            ELSE CAST(REPLACE(w.destruction, ',', '') AS NUMERIC) * (COALESCE(w.defend_percent, 0) / 100.0)
        END AS damage_received,
        w.defend_percent AS attack_percent,
        w.attack_percent AS defend_percent
    FROM wars w
    INNER JOIN nations dn ON w.declaring_nation_id = dn.id
    INNER JOIN nations rn ON w.receiving_nation_id = rn.id
    LEFT JOIN alliances da ON w.declaring_alliance_id = da.id
    LEFT JOIN alliances ra ON w.receiving_alliance_id = ra.id
    WHERE 
        TO_DATE(SPLIT_PART(w.date, ' ', 1), 'MM/DD/YYYY') > TO_DATE('2/5/2026', 'MM/DD/YYYY')
        AND w.receiving_alliance_id IS NOT NULL
) AS war_records
ORDER BY 
    alliance_id,
    nation_id,
    opponent_alliance_id,
    damage_dealt - damage_received DESC;

