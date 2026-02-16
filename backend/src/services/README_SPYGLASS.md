# Spyglass Integration

## Overview
The spyglass service parses spy intelligence data from `backend/src/data/spyglass.txt` to extract warchest information and display it in the wars view.

## Components

### Backend
- **`spyglassService.ts`**: Parses the raw spyglass.txt file to extract:
  - Nation name
  - Ruler name
  - Alliance
  - Strength
  - Warchest (in dollars)
  - Days since last update

### Data Model
Updated `Nation` interface to include:
- `warchest?: number` - The nation's treasury amount in dollars
- `spyglassLastUpdated?: number` - How many days old the spy data is

### Integration
The `warManagementService.ts` now:
1. Loads spyglass data on each request
2. Matches nations by ruler + nation name (case-insensitive)
3. Adds warchest info to:
   - Main alliance nations
   - Attacking nations (in war records)
   - Defending nations (in war records)

### Frontend Display
The `WarManagementTable` component displays warchest information:
- **Main nation column**: Shows warchest and days old below the NS/Tech info
- **War columns**: Shows warchest for attacking/defending nations if available
- **Format**: Uses green text for warchest amount (e.g., $19.1B) with gray "(4d)" for days old

## Data File Format
The `spyglass.txt` file should follow this format:
```
1. Nation Name
Ruler: Ruler Name
Alliance: Alliance Name
Strength: 123,456.789
Warchest: $12,345,678,901
Last Updated: 4 days old
```

## Usage Notes
- Warchest data is optional - if not available, it simply won't display
- The parser is case-insensitive for matching nations
- Data freshness is indicated by the number of days in parentheses
- The service loads data on each API request, so updates to spyglass.txt are immediately reflected

