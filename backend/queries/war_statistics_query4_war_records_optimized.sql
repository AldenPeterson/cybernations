-- Optimized Individual War Records
-- Uses computed columns to avoid runtime calculation overhead

WITH date_filter AS (
    SELECT TO_DATE('2/5/2026', 'MM/DD/YYYY') AS cutoff_date
)
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
        w.declaring_damage_dealt AS damage_dealt,
        w.declaring_damage_received AS damage_received,
        w.attack_percent,
        w.defend_percent
    FROM wars w
    INNER JOIN nations dn ON w.declaring_nation_id = dn.id
    INNER JOIN nations rn ON w.receiving_nation_id = rn.id
    LEFT JOIN alliances da ON w.declaring_alliance_id = da.id
    LEFT JOIN alliances ra ON w.receiving_alliance_id = ra.id
    CROSS JOIN date_filter df
    WHERE 
        TO_DATE(SPLIT_PART(w.date, ' ', 1), 'MM/DD/YYYY') > df.cutoff_date
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
        w.receiving_damage_dealt AS damage_dealt,
        w.receiving_damage_received AS damage_received,
        w.defend_percent AS attack_percent,
        w.attack_percent AS defend_percent
    FROM wars w
    INNER JOIN nations dn ON w.declaring_nation_id = dn.id
    INNER JOIN nations rn ON w.receiving_nation_id = rn.id
    LEFT JOIN alliances da ON w.declaring_alliance_id = da.id
    LEFT JOIN alliances ra ON w.receiving_alliance_id = ra.id
    CROSS JOIN date_filter df
    WHERE 
        TO_DATE(SPLIT_PART(w.date, ' ', 1), 'MM/DD/YYYY') > df.cutoff_date
        AND w.receiving_alliance_id IS NOT NULL
) AS war_records
ORDER BY 
    alliance_id,
    nation_id,
    opponent_alliance_id,
    damage_dealt - damage_received DESC;

