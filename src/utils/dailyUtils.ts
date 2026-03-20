
/**
 * Utility functions for Hand of the Day (Daily Challenge) 
 * 
 * Rules:
 * - A challenge for date D is active from D 06:00:00 PT to D+1 05:59:59 PT.
 * - This is roughly consistent with "Daily" resets in many games to accommodate late-night players.
 */

// We use -7 as a baseline for PT (Pacific Time). 
// In a production app, we might use a library like Luxon or date-fns-tz to handle DST correctly,
// but for this implementation we will stick to a fixed 6-hour offset from a normalized "day start".
export const PT_OFFSET_HOURS = -7; 

/**
 * Returns the "Daily Challenge Date" for a given timestamp.
 * If it's before 6:00 AM PT, it's considered the previous day's challenge.
 */
export function getDailyChallengeDate(date: Date = new Date()): string {
    // Convert to PT (approximately)
    const ptDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const hours = ptDate.getHours();
    
    const resultDate = new Date(ptDate);
    if (hours < 6) {
        // Before 6 AM PT, it's still yesterday's challenge
        resultDate.setDate(resultDate.getDate() - 1);
    }
    
    // IMPORTANT: Do NOT use toISOString() here — it converts back to UTC,
    // which will flip the date for PT evening times (e.g. 7 PM PT = 2 AM UTC next day).
    // Instead, build the date string directly from the local PT date parts.
    const year = resultDate.getFullYear();
    const month = String(resultDate.getMonth() + 1).padStart(2, '0');
    const day = String(resultDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Returns true if the challenge for the given date_string ('YYYY-MM-DD') is expired.
 * A challenge for date D expires at D+1 06:00:00 PT.
 */
export function isDailyChallengeExpired(dateString: string, now: Date = new Date()): boolean {
    // The expiration date is the day AFTER the challenge date at 06:00:00 PT
    
    // Create a date object for the day after the challenge at 06:00 PT in Los Angeles time
    
    // Convert current time to a PT-comparable string or vice versa
    // Easiest way: Get the challenge date for "now". If it's ≠ dateString and "now" is AFTER, it's expired.
    
    const currentActiveDate = getDailyChallengeDate(now);
    
    if (currentActiveDate === dateString) {
        return false;
    }
    
    // If currentActiveDate is AFTER dateString, then dateString is expired.
    return currentActiveDate > dateString;
}

/**
 * Returns the time remaining for the current challenge in a human readable format
 */
export function getDailyChallengeTimeRemaining(): string {
    // Expiration is at (dateString + 1) 06:00:00 PT
    
    return "Expires at 6:00 AM PT";
}
