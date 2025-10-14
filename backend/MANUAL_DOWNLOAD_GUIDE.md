# Manual Data Download Guide

When the automated CyberNations data download links are broken or unavailable, you can manually specify custom filenames for data downloads using one of two methods:

## Method 1: Manual Download Script (Recommended)

The easiest way is to use the `manual-download.ts` script:

```bash
cd backend
npx tsx manual-download.ts <type> <filename>
```

### Arguments:
- `type`: The data type to download (`nation`, `aid`, or `war`)
- `filename`: The exact filename from CyberNations assets

### Examples:

```bash
# Download nation stats with custom filename
npx tsx manual-download.ts nation CyberNations_SE_Nation_Stats_10142025510001.zip

# Download aid stats with custom filename
npx tsx manual-download.ts aid CyberNations_SE_Aid_Stats_10142025520001.zip

# Download war stats with custom filename
npx tsx manual-download.ts war CyberNations_SE_War_Stats_10142025525001.zip
```

The script will:
1. Download the specified file from CyberNations
2. Extract the CSV data
3. Save it to the correct location (`src/data/`)
4. Update the download tracker

## Method 2: Environment Variables

You can also set environment variables to override the automatic filename generation:

1. Create or edit your `.env` file in the backend directory:

```bash
CUSTOM_NATION_STATS_FILE=CyberNations_SE_Nation_Stats_10142025510001.zip
CUSTOM_AID_STATS_FILE=CyberNations_SE_Aid_Stats_10142025520001.zip
CUSTOM_WAR_STATS_FILE=CyberNations_SE_War_Stats_10142025525001.zip
```

2. Start your server normally. The system will use these custom filenames when downloading data.

3. To return to automatic filename generation, simply remove or comment out these variables.

## Finding the Correct Filename

CyberNations data files follow this naming pattern:
```
CyberNations_SE_<Type>_<Timestamp>.zip
```

Where:
- `<Type>`: `Nation_Stats`, `Aid_Stats`, or `War_Stats`
- `<Timestamp>`: Format `MMDDYYYYXXXX` (e.g., `10142025510001`)

The timestamp includes:
- Month and day (10/14)
- Year (2025)
- File flag (51000 for nations, 52000 for aid, 52500 for wars)
- Time toggle (1 for 6am-6pm, 2 for 6pm-6am Central Time)

## Troubleshooting

If the download fails:
1. Verify the filename is correct
2. Check that the file exists at `https://www.cybernations.net/assets/<filename>`
3. Ensure you have internet connectivity
4. Check the console output for specific error messages

## When to Use This

Use manual downloads when:
- The automated download system can't find the latest files
- You know a specific file is available but the timestamp calculation is off
- You need to use an older version of the data
- The server's time calculation is incorrect

