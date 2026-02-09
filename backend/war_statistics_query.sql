-- War Statistics Query
-- Shows total damages and net damage for wars declared in the last 15 days
-- Summarized by alliance with breakdown of nations and opponent alliances

WITH recent_wars AS (
    -- Filter wars declared in the last 15 days
    -- Parse the date field which is in format "MM/DD/YYYY HH:MM:SS AM/PM"
    SELECT 
        w.war_id,
        w.declaring_nation_id,
        w.receiving_nation_id,
        w.declaring_alliance_id,
        w.receiving_alliance_id,
        w.date,
        w.destruction,
        w.attack_percent,
        w.defend_percent,
        -- Parse destruction (remove commas, convert to numeric)
        CASE 
            WHEN w.destruction IS NULL OR w.destruction = '' THEN 0
            ELSE CAST(REPLACE(w.destruction, ',', '') AS NUMERIC)
        END AS total_destruction,
        -- Calculate damage dealt by declaring nation (attacker)
        -- attack_percent = damage received by attacker, defend_percent = damage dealt by attacker (to defender)
        CASE 
            WHEN w.destruction IS NULL OR w.destruction = '' THEN 0
            WHEN w.defend_percent IS NULL OR w.defend_percent = 0 THEN 0
            ELSE CAST(REPLACE(w.destruction, ',', '') AS NUMERIC) * (COALESCE(w.defend_percent, 0) / 100.0)
        END AS declaring_damage_dealt,
        -- Calculate damage received by declaring nation (attacker)
        -- attack_percent = damage received by attacker (from defender)
        CASE 
            WHEN w.destruction IS NULL OR w.destruction = '' THEN 0
            WHEN w.attack_percent IS NULL OR w.attack_percent = 0 THEN 0
            ELSE CAST(REPLACE(w.destruction, ',', '') AS NUMERIC) * (COALESCE(w.attack_percent, 0) / 100.0)
        END AS declaring_damage_received,
        -- Calculate damage dealt by receiving nation (defender)
        -- defend_percent = damage received by defender, attack_percent = damage dealt by defender (to attacker)
        CASE 
            WHEN w.destruction IS NULL OR w.destruction = '' THEN 0
            WHEN w.attack_percent IS NULL OR w.attack_percent = 0 THEN 0
            ELSE CAST(REPLACE(w.destruction, ',', '') AS NUMERIC) * (COALESCE(w.attack_percent, 0) / 100.0)
        END AS receiving_damage_dealt,
        -- Calculate damage received by receiving nation (defender)
        -- defend_percent = damage received by defender (from attacker)
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
    WHERE 
        w.is_active = true
        -- Parse date and filter for last 15 days
        -- Date format: "MM/DD/YYYY HH:MM:SS AM/PM"
        AND TO_DATE(SPLIT_PART(w.date, ' ', 1), 'MM/DD/YYYY') >= CURRENT_DATE - INTERVAL '15 days'
        AND TO_DATE(SPLIT_PART(w.date, ' ', 1), 'MM/DD/YYYY') <= CURRENT_DATE
),
-- Calculate damage from declaring alliance perspective (attacking)
-- attack_percent = damage received by attacker, defend_percent = damage dealt by attacker
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
        SUM(declaring_damage_received) AS damage_received
    FROM recent_wars
    WHERE declaring_alliance_id IS NOT NULL
    GROUP BY 
        declaring_alliance_id,
        declaring_alliance_name,
        declaring_nation_id,
        declaring_nation_name,
        declaring_ruler_name,
        receiving_alliance_id,
        receiving_alliance_name
),
-- Calculate damage from receiving alliance perspective (defending)
-- defend_percent = damage received by defender, attack_percent = damage dealt by defender
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
        SUM(receiving_damage_received) AS damage_received
    FROM recent_wars
    WHERE receiving_alliance_id IS NOT NULL
    GROUP BY 
        receiving_alliance_id,
        receiving_alliance_name,
        receiving_nation_id,
        receiving_nation_name,
        receiving_ruler_name,
        declaring_alliance_id,
        declaring_alliance_name
),
-- ============================================================================
-- QUERY 1: Alliance Summary with Opponent Breakdown
-- ============================================================================
-- Summary by alliance pair (combines A vs B and B vs A into single row)
-- Normalizes alliance pairs so they're always in the same order (smaller ID first)
all_alliance_pairs AS (
    -- Get all pairs from declaring perspective (attacking)
    SELECT 
        alliance_id AS alliance1_id,
        opponent_alliance_id AS alliance2_id,
        alliance_name AS alliance1_name,
        opponent_alliance_name AS alliance2_name,
        damage_dealt AS damage
    FROM declaring_damage
    WHERE alliance_id IS NOT NULL AND opponent_alliance_id IS NOT NULL
    
    UNION ALL
    
    -- Get all pairs from receiving perspective (defending - damage they deal back)
    SELECT 
        alliance_id AS alliance1_id,
        opponent_alliance_id AS alliance2_id,
        alliance_name AS alliance1_name,
        opponent_alliance_name AS alliance2_name,
        damage_dealt AS damage
    FROM receiving_damage
    WHERE alliance_id IS NOT NULL AND opponent_alliance_id IS NOT NULL
),
normalized_pairs AS (
    SELECT 
        -- Normalize: always use smaller ID as alliance1
        LEAST(alliance1_id, alliance2_id) AS alliance1_id,
        GREATEST(alliance1_id, alliance2_id) AS alliance2_id,
        -- Get names in normalized order
        CASE 
            WHEN alliance1_id < alliance2_id THEN alliance1_name
            ELSE alliance2_name
        END AS alliance1_name,
        CASE 
            WHEN alliance1_id < alliance2_id THEN alliance2_name
            ELSE alliance1_name
        END AS alliance2_name,
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
GROUP BY 
    alliance1_id,
    alliance2_id,
    alliance1_name,
    alliance2_name
HAVING SUM(damage) > 0
ORDER BY SUM(damage) DESC;

-- ============================================================================
-- QUERY 2: Overall Alliance Totals
-- ============================================================================
-- Summary by alliance showing total damage dealt, received, and net damage
-- Aggregates all wars (both declaring and receiving) for each alliance
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
FULL OUTER JOIN receiving_totals rt 
    ON dt.alliance_id = rt.alliance_id
WHERE (COALESCE(dt.total_damage_dealt, 0) + COALESCE(rt.total_damage_dealt, 0)) > 0 
    OR (COALESCE(dt.total_damage_received, 0) + COALESCE(rt.total_damage_received, 0)) > 0
ORDER BY ((COALESCE(dt.total_damage_dealt, 0) + COALESCE(rt.total_damage_dealt, 0)) - 
    (COALESCE(dt.total_damage_received, 0) + COALESCE(rt.total_damage_received, 0))) DESC;

-- ============================================================================
-- QUERY 3: Nation-Level Breakdown by Alliance and Opponent
-- ============================================================================
-- Detailed breakdown showing each nation's damage against each opponent alliance
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
    (COALESCE(SUM(dd.damage_received), 0) + COALESCE(SUM(rd.damage_received), 0)) AS net_damage
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

