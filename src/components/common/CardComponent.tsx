import { motion } from 'framer-motion';
import { Card } from '../../types/game';

export const CardComponent = ({
    card,
    onClick,
    disabled,
    isValid = true,
    size = 'md',
    rotation = 0
}: {
    card: Card;
    onClick?: () => void;
    disabled?: boolean;
    isValid?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'mobile';
    rotation?: number;
}) => {
    const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
    const suitSymbol = card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : card.suit === 'clubs' ? '♣' : '♠';

    const sizes = {
        sm: 'w-16 h-24 text-base',
        md: 'w-20 h-28 text-xl',
        lg: 'w-24 h-36 text-2xl',
        mobile: 'w-[77px] h-[115px] text-xl'
    };

    const valClass = isRed ? 'text-red-600' : 'text-ink';
    const invalidClass = isRed ? 'text-red-600/50' : 'text-ink/50';

    return (
        <motion.button
            layout
            disabled={disabled}
            onClick={onClick}
            whileHover={isValid && !disabled && onClick ? { scale: 1.05, transition: { type: 'spring', stiffness: 300 } } : {}}
            whileTap={isValid && !disabled && onClick ? { scale: 0.95 } : {}}
            className={`
                ${sizes[size]} rounded-[1.25rem] border-2 shadow-[0_8px_30px_rgba(0,0,0,0.5)] 
                flex flex-col items-center justify-center relative overflow-hidden transition-all duration-500
                ${isValid ? 'bg-paper border-white' : 'bg-paper/90 border-ink-dim/50/50 opacity-80'}
            `}
            style={{ rotate: rotation }}
        >
            <div className={`absolute top-2 left-3 font-black flex flex-col items-center leading-none ${isValid ? valClass : invalidClass}`}>
                <span className="text-xl uppercase">{card.rank}</span>
                <span className="-mt-1 uppercase">{suitSymbol}</span>
            </div>
            <div className={`absolute bottom-2 right-3 font-black rotate-180 flex flex-col items-center leading-none ${isValid ? valClass : invalidClass}`}>
                <span className="text-xl uppercase">{card.rank}</span>
                <span className="-mt-1 uppercase">{suitSymbol}</span>
            </div>

            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
        </motion.button>
    );
};
