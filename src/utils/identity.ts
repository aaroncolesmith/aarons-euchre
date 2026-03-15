const USER_ID_MAP: Record<string, string> = {
    'Aaron': 'user_aaron',
    'Polina': 'user_polina',
    'Gray-Gray': 'user_gray_gray',
    'Mimi': 'user_mimi',
    'Micah': 'user_micah',
    'Cherrie': 'user_cherrie',
    'Peter-Playwright': 'user_peter_playwright',
    'TEST': 'user_test'
};

const BOT_ID_MAP: Record<string, string> = {
    'Fizz': 'bot_fizz',
    'J-Bock': 'bot_j_bock',
    'Huber': 'bot_huber',
    'Moses': 'bot_moses',
    'Wooden': 'bot_wooden',
    'Buff': 'bot_buff'
};

function normalize(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function getStableUserId(name: string | null, isBot: boolean): string | null {
    if (!name) return null;
    if (isBot) return BOT_ID_MAP[name] || `bot_${normalize(name)}`;
    return USER_ID_MAP[name] || `user_${normalize(name)}`;
}
