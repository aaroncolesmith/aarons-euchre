export const generateTableCode = () => {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
};

export const generateTableName = () => {
    const adjectives = ['Royal', 'Green', 'Emerald', 'Sapphire', 'Golden', 'Grand', 'Classic'];
    const nouns = ['Table', 'Lounge', 'Club', 'Den', 'Bazaar', 'Parlor'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
};

export const shuffleArray = <T>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};
