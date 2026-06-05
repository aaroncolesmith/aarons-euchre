function normalize(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Returns a stable, deterministic ID for a player or bot based on their display name.
 * IDs are derived by normalizing the name — no whitelist required.
 * The 6 original user names (Aaron, Polina, Gray-Gray, etc.) and all 6 bot names
 * produce the same IDs as the prior hardcoded map, so no data migration is needed.
 */
export function getStableUserId(name: string | null, isBot: boolean): string | null {
    if (!name) return null;
    const prefix = isBot ? 'bot' : 'user';
    return `${prefix}_${normalize(name)}`;
}
