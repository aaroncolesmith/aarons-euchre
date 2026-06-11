export const generateTableCode = () => {
    const part = () => Math.floor(Math.random() * 900 + 100).toString();
    return `${part()}-${part()}`;
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
