export const getCardJitter = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return (hash % 10) - 5;
};

export const getPositionJitter = (id: string) => {
    let hashX = 0;
    let hashY = 0;
    for (let i = 0; i < id.length; i++) {
        hashX = id.charCodeAt(i) + ((hashX << 5) - hashX);
        hashY = id.charCodeAt(id.length - 1 - i) + ((hashY << 5) - hashY);
    }
    return {
        x: (hashX % 20) - 10,
        y: (hashY % 20) - 10
    };
};
