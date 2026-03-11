import { motion } from 'framer-motion';
import { useGame } from '../../store/GameStore';
import { BOT_NAMES_POOL } from '../../store/reducers/utils';
import { CardComponent } from './CardComponent';

export const PlayerSeat = ({
    index,
    position,
    isCurrentTurn,
    isDealer,
    isAnimatingDealer = false,
    inLobby = false
}: {
    index: number;
    position: 'bottom' | 'top' | 'left' | 'right';
    isCurrentTurn: boolean;
    isDealer: boolean;
    isAnimatingDealer?: boolean;
    inLobby?: boolean;
}) => {
    const { state, dispatch } = useGame();
    const player = state.players[index];
    const isTrumpCaller = state.trumpCallerIndex === index && state.phase !== 'lobby';

    const posClasses = {
        bottom: "bottom-24 md:bottom-32 left-1/2 -translate-x-1/2",
        top: "top-24 md:top-32 left-1/2 -translate-x-1/2",
        left: "left-6 md:left-10 top-1/2 -translate-y-1/2 -rotate-90 origin-center",
        right: "right-6 md:right-10 top-1/2 -translate-y-1/2 rotate-90 origin-center"
    };

    if (!player.name && inLobby) {
        return (
            <div className={`absolute ${posClasses[position]} flex flex-col items-center gap-3 z-20 group`}>
                <div className="flex flex-col gap-2">
                    <button
                        onClick={() => dispatch({ type: 'SIT_PLAYER', payload: { seatIndex: index, name: state.currentViewPlayerName! } })}
                        className="bg-brand/10 hover:bg-brand/20 text-brand-dark px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-brand-dim transition-all"
                    >
                        Sit Here
                    </button>
                    <button
                        onClick={() => {
                            const activeBotNames = state.players.map(p => p.name).filter(n => n && BOT_NAMES_POOL.includes(n));
                            const availableBots = BOT_NAMES_POOL.filter((n: string) => !activeBotNames.includes(n));
                            const botName = availableBots[Math.floor(Math.random() * availableBots.length)] || 'Bot ' + Math.random().toString().substr(2, 3);
                            dispatch({ type: 'ADD_BOT', payload: { seatIndex: index, botName } });
                        }}
                        className="bg-paper hover:bg-paper-dim text-ink-dim px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-ink-dim/50 transition-all"
                    >
                        Add Bot
                    </button>
                </div>
                {/* Seat Label (N/S/E/W) */}
                <div className="absolute -bottom-6 text-[8px] font-black text-emerald-200 uppercase tracking-widest">
                    {position === 'bottom' ? 'South' : position === 'left' ? 'West' : position === 'top' ? 'North' : 'East'}
                </div>
            </div>
        );
    }

    if (!player.name) return null;

    return (
        <motion.div
            className={`absolute ${posClasses[position]} flex flex-col items-center gap-1 z-0`}
        >
            <motion.div
                className={`relative w-auto h-auto flex flex-col items-center justify-center`}
            >
                {/* Caller Badge */}
                {isTrumpCaller && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute -top-7 bg-paper text-cyan-600 text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-wider border-2 border-cyan-500 shadow-sm z-30 whitespace-nowrap"
                    >
                        Caller
                    </motion.div>
                )}

                {/* Dealer Badge */}
                {isDealer && !isAnimatingDealer && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-6 -right-5 bg-paper text-amber-500 text-xs font-black w-7 h-7 rounded-full flex items-center justify-center border-2 border-amber-500 shadow-sm z-30"
                    >
                        D
                    </motion.div>
                )}

                {/* UPCARD centered */}
                {isDealer && !isAnimatingDealer && state.phase === 'bidding' && state.biddingRound === 1 && state.upcard && (
                    <motion.div
                        layoutId={state.upcard.id}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`absolute ${position === 'bottom' ? 'bottom-full mb-4' : 'top-full mt-4'} left-1/2 -translate-x-1/2 z-20 pointer-events-none`}
                    >
                        <div className="relative">
                            <CardComponent card={state.upcard} size="sm" rotation={position === 'top' ? 195 : 15} disabled />
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-paper text-brand-dark text-[8px] font-black px-2 py-0.5 rounded shadow-sm border border-brand-dim whitespace-nowrap z-30">
                                UPCARD
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Remove Player (Lobby) */}
                {player.isComputer && inLobby && (
                    <button
                        onClick={() => dispatch({ type: 'REMOVE_PLAYER', payload: { seatIndex: index } })}
                        className="absolute -top-2 -left-4 bg-paper text-red-500 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border border-red-200 hover:border-red-500 transition-all z-10 shadow-sm"
                    >
                        ✕
                    </button>
                )}

                {/* Player Name */}
                <div className={`
                    font-hand font-black text-xl uppercase tracking-tight whitespace-nowrap px-4 py-2 rounded-xl transition-all duration-300
                    ${isCurrentTurn || isAnimatingDealer
                        ? 'text-brand bg-brand/10 border-4 border-brand shadow-[4px_4px_0px_0px_rgba(16,185,129,0.5)] scale-110'
                        : 'text-ink-dim border-2 border-transparent'}
                `}>
                    {player.name}
                </div>

                {/* Cards Left */}
                {!inLobby && player.name !== state.currentViewPlayerName && state.phase !== 'randomizing_dealer' && (
                    <div className="flex gap-1 justify-center mt-1">
                        {[0, 1, 2, 3, 4].map((i) => {
                            const hasCard = i < player.hand.length;
                            return (
                                <div
                                    key={i}
                                    className={`
                                        w-3 h-5 rounded-[2px] transition-all
                                        ${hasCard
                                            ? 'bg-paper border-2 border-brand'
                                            : 'bg-transparent border-2 border-brand-dim/50'}
                                    `}
                                />
                            );
                        })}
                    </div>
                )}

                {/* Tricks Won (Hand) */}
                {!inLobby && state.phase !== 'randomizing_dealer' && ['playing', 'waiting_for_trick', 'scoring'].includes(state.phase) && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -bottom-2 -right-6 bg-paper text-brand text-sm font-black w-7 h-7 rounded-full flex items-center justify-center border-2 border-brand shadow-sketch-brand font-hand tabular-nums"
                    >
                        {state.tricksWon[player.id] || 0}
                    </motion.div>
                )}
            </motion.div>

            <div className="hidden">
                {position === 'bottom' ? 'South' : position === 'left' ? 'West' : position === 'top' ? 'North' : 'East'}
            </div>
        </motion.div>
    );
};
