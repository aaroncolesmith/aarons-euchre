import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../../store/GameStore';
import { PlayerSeat } from '../common/PlayerSeat';
import { CardComponent } from '../common/CardComponent';
import { TableOverlay } from './TableOverlay';
import { StatsModal } from '../common/StatsModal';
import { BotAuditView } from './BotAuditView';
import { TrumpHandModal } from './TrumpHandModal';
import { Card } from '../../types/game';
import { getEffectiveSuit, isValidPlay } from '../../utils/rules';
import { getCardJitter, getPositionJitter } from '../../utils/jitter';

export const TableView = ({ handleNextStep }: { handleNextStep: () => void }) => {
    const { state, dispatch } = useGame();
    const [isStatsOpen, setIsStatsOpen] = useState(false);
    const [isBotAuditOpen, setIsBotAuditOpen] = useState(false);
    const [isTrumpHandOpen, setIsTrumpHandOpen] = useState(false);
    const [statsInitialTab, setStatsInitialTab] = useState<'me' | 'league' | 'trump_analytics' | 'bot_audit' | 'freeze_incidents' | 'state_management' | 'commentary'>('me');

    const myIdx = state.players.findIndex(p => p.name === state.currentViewPlayerName);

    return (
        <div className="flex-1 bg-paper rounded-[2rem] md:rounded-[3rem] border-4 border-brand shadow-sketch-brand relative flex flex-col w-full h-full overflow-hidden">
            <StatsModal isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} initialTab={statsInitialTab} />
            <BotAuditView isOpen={isBotAuditOpen} onClose={() => setIsBotAuditOpen(false)} />
            <TrumpHandModal isOpen={isTrumpHandOpen} onClose={() => setIsTrumpHandOpen(false)} />

            <div className="shrink-0 flex justify-between items-start p-5 md:p-8 bg-paper border-b-2 border-brand-dim/50 z-30">
                <div className="flex flex-col">
                    <h1 className="text-2xl md:text-3xl font-black text-brand-dark tracking-wide leading-none transition-all">
                        {state.tableName || 'The Green Table'}
                    </h1>
                    {state.tableCode && (
                        <div className="text-[10px] md:text-xs font-bold text-brand-dim mt-1 pl-1 tracking-widest font-mono">
                            {state.tableCode}
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                        {state.trump && (
                            <div className="hidden md:block w-0 h-0" />
                        )}
                        <button
                            onClick={() => setIsBotAuditOpen(true)}
                            className="bg-paper hover:bg-cyan-50 text-cyan-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 border-cyan-500 transition-all shadow-[3px_3px_0px_0px_rgba(6,182,212,0.3)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                        >
                            BOTS
                        </button>
                        <button
                            onClick={() => { setStatsInitialTab('me'); setIsStatsOpen(true); }}
                            className="bg-paper hover:bg-brand/10 text-brand-dark px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 border-brand transition-all shadow-[3px_3px_0px_0px_rgba(16,185,129,0.3)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                        >
                            STATS
                        </button>
                        <button
                            onClick={() => dispatch({ type: 'EXIT_TO_LANDING' })}
                            className="w-[34px] h-[34px] bg-paper hover:bg-red-50 text-brand-dark hover:text-red-500 rounded-xl border-2 border-brand hover:border-red-400 transition-all shadow-[3px_3px_0px_0px_rgba(16,185,129,0.3)] flex items-center justify-center active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 relative bg-paper flex flex-col items-center overflow-hidden w-full h-full scale-95 md:scale-100 origin-center">
                {/* Scoreboard */}
                <div className="flex justify-between items-center w-full px-6 md:px-12 mt-2 md:mt-6 mb-2 pointer-events-none relative z-20 shrink-0">
                    <div className="text-center">
                        <div className="text-[10px] font-black text-brand-dim uppercase tracking-widest mb-1">{state.teamNames.team1}</div>
                        <div className="text-3xl md:text-5xl font-black text-brand-dark font-hand">{state.scores.team1}</div>
                    </div>

                    {state.trump && (
                        <div className="flex flex-col items-center bg-paper px-4 py-2 rounded-2xl border-2 border-brand shadow-sketch-brand">
                            <div className="hidden md:block text-[8px] font-black text-brand-dim uppercase tracking-widest mb-0.5">TRUMP</div>
                            <div className={`text-2xl md:text-4xl font-black leading-none ${state.trump === 'hearts' || state.trump === 'diamonds' ? 'text-red-500' : 'text-ink'}`}>
                                {state.trump === 'hearts' ? '♥' : state.trump === 'diamonds' ? '♦' : state.trump === 'clubs' ? '♣' : '♠'}
                            </div>
                        </div>
                    )}

                    <div className="text-center">
                        <div className="text-[10px] font-black text-brand-dim uppercase tracking-widest mb-1">{state.teamNames.team2}</div>
                        <div className="text-3xl md:text-5xl font-black text-brand-dark font-hand">{state.scores.team2}</div>
                    </div>
                </div>

                {state.trump && (
                    <div className="absolute top-[80px] md:hidden z-30 pointer-events-auto">
                    </div>
                )}

                <TableOverlay />

                {(() => {
                    const refIdx = myIdx === -1 ? 0 : myIdx;
                    const positions: ('bottom' | 'left' | 'top' | 'right')[] = ['bottom', 'left', 'top', 'right'];

                    return [0, 1, 2, 3].map(offset => {
                        const pIdx = (refIdx + offset) % 4;
                        return (
                            <PlayerSeat
                                key={pIdx}
                                inLobby={false}
                                index={pIdx}
                                position={positions[offset]}
                                isCurrentTurn={state.currentPlayerIndex === pIdx}
                                isDealer={state.dealerIndex === pIdx}
                                isAnimatingDealer={state.displayDealerIndex === pIdx}
                            />
                        );
                    });
                })()}

                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <AnimatePresence>
                        {state.currentTrick.map((t) => {
                            const pIdx = state.players.findIndex(p => p.id === t.playerId);
                            const mIdx = state.players.findIndex(p => p.name === state.currentViewPlayerName);
                            const rIdx = mIdx === -1 ? 0 : mIdx;
                            const relativePos = (pIdx - rIdx + 4) % 4;
                            const offsets = [
                                { y: 50, r: 0 },   // Bottom
                                { x: -50, r: 90 }, // Left
                                { y: -50, r: 180 },  // Top
                                { x: 50, r: -90 }, // Right
                            ];
                            const { x = 0, y = 0, r = 0 } = offsets[relativePos] || {};
                            const jitter = getPositionJitter(t.card.id);

                            return (
                                <motion.div
                                    key={t.card.id}
                                    layoutId={t.card.id}
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1, x: x + jitter.x, y: y + jitter.y, rotate: r + getCardJitter(t.card.id) }}
                                    exit={{ scale: 0, opacity: 0 }}
                                    className="absolute"
                                >
                                    <CardComponent card={t.card} size="sm" rotation={0} disabled />
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {state.phase === 'randomizing_dealer' && (
                        <div className="bg-amber-500/10 border border-amber-500/50 px-8 py-4 rounded-[2rem] backdrop-blur-3xl animate-pulse">
                            <div className="text-amber-500 text-lg font-black uppercase tracking-tighter text-center">Choosing Dealer...</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bidding Controls Overlay */}
            <div className="absolute bottom-[160px] md:bottom-[160px] left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full px-4 md:w-auto md:px-0">
                <AnimatePresence>
                    {(() => {
                        if (state.phase === 'bidding' && state.currentPlayerIndex === myIdx) {
                            return (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="pointer-events-auto flex flex-col items-center mx-auto w-full max-w-[380px] md:max-w-2xl"
                                >
                                    {state.biddingRound === 1 ? (
                                        <div className="grid grid-cols-3 gap-3 w-full">
                                            <button onClick={() => dispatch({ type: 'MAKE_BID', payload: { suit: state.upcard!.suit, callerIndex: myIdx, isLoner: false } })} className="bg-paper hover:bg-brand/10 text-brand-dark w-full py-3 rounded-xl font-black text-xs md:text-sm uppercase tracking-wider border-2 border-brand transition-all shadow-[4px_4px_0px_0px_rgba(16,185,129,0.4)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none whitespace-nowrap">Order Up</button>
                                            <button onClick={() => dispatch({ type: 'MAKE_BID', payload: { suit: state.upcard!.suit, callerIndex: myIdx, isLoner: true } })} className="bg-paper hover:bg-brand/10 text-brand-dark w-full py-3 rounded-xl font-black text-xs md:text-sm uppercase tracking-wider border-2 border-brand transition-all shadow-[4px_4px_0px_0px_rgba(16,185,129,0.4)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none whitespace-nowrap">Go Alone</button>
                                            <button onClick={() => dispatch({ type: 'PASS_BID', payload: { playerIndex: myIdx } })} className="bg-paper hover:bg-brand/10 text-brand-dark w-full py-3 rounded-xl font-black text-xs md:text-sm uppercase tracking-wider border-2 border-brand transition-all shadow-[4px_4px_0px_0px_rgba(16,185,129,0.4)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none whitespace-nowrap">Pass</button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-4 w-full">
                                            <div className="flex gap-3">
                                                {(['hearts', 'diamonds', 'clubs', 'spades'] as const).filter(s => s !== state.upcard!.suit).map(suit => (
                                                    <div key={suit} className="flex-1 flex flex-col gap-2">
                                                        <button onClick={() => dispatch({ type: 'MAKE_BID', payload: { suit, callerIndex: myIdx, isLoner: false } })} className="bg-paper hover:bg-brand/10 text-brand-dark w-full py-3 rounded-xl font-black text-[10px] md:text-xs uppercase tracking-wider border-2 border-brand transition-all shadow-[3px_3px_0px_0px_rgba(16,185,129,0.4)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">{suit}</button>
                                                        <button onClick={() => dispatch({ type: 'MAKE_BID', payload: { suit, callerIndex: myIdx, isLoner: true } })} className="bg-paper hover:bg-brand/10 text-brand w-full py-1.5 rounded-lg font-black text-[8px] uppercase tracking-wider border border-emerald-400 transition-all shadow-[2px_2px_0px_0px_rgba(16,185,129,0.3)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none">Alone</button>
                                                    </div>
                                                ))}
                                            </div>
                                            {myIdx !== state.dealerIndex ? (
                                                <button onClick={() => dispatch({ type: 'PASS_BID', payload: { playerIndex: myIdx } })} className="bg-paper hover:bg-pink-50 text-brand-dark hover:text-pink-600 w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider border-2 border-brand hover:border-pink-500 transition-all shadow-[4px_4px_0px_0px_rgba(16,185,129,0.4)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">Pass</button>
                                            ) : (
                                                <div className="w-full bg-paper border-2 border-red-500 text-red-500 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-center animate-pulse">
                                                    STUCK THE DEALER: YOU MUST CALL
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            );
                        }

                        if (state.phase === 'scoring') {
                            return (
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="pointer-events-auto p-12 bg-ink/95 rounded-[4rem] border-2 border-brand shadow-2xl text-center backdrop-blur-3xl max-w-md"
                                >
                                    <h3 className="text-sm font-black text-brand uppercase tracking-[0.4em] mb-4 text-center">Hand Result</h3>
                                    <p className="text-4xl font-black text-white italic tracking-tighter mb-10 leading-tight">
                                        {state.overlayMessage || state.logs[0]}
                                    </p>
                                    <button
                                        onClick={() => dispatch({ type: 'FINISH_HAND' })}
                                        className="w-full bg-paper text-slate-950 font-black py-5 rounded-3xl shadow-xl text-2xl hover:scale-105 active:scale-95 transition-all"
                                    >
                                        NEXT HAND
                                    </button>
                                </motion.div>
                            );
                        }
                        return null;
                    })()}
                </AnimatePresence>
            </div>

            {/* Hand Area */}
            <div className="h-40 md:h-48 flex items-end justify-center relative mt-auto px-1 md:px-10 pt-2 pb-6 z-[60] w-full pointer-events-none">
                {(() => {
                    if (myIdx === -1 || ['scoring', 'randomizing_dealer', 'game_over', 'lobby'].includes(state.phase)) return null;

                    const myPlayer = state.players[myIdx];
                    const handSize = myPlayer.hand.length;
                    const isMyTurnToPlay = state.currentPlayerIndex === myIdx && (state.phase === 'playing' || state.phase === 'discard');

                    return (
                        <div className={`flex justify-center items-end relative mx-auto pointer-events-auto ${isMyTurnToPlay ? 'w-full max-w-[600px] px-1' : 'w-full max-w-[380px]'}`}>
                            {myPlayer.hand.map((card: Card, index: number) => {
                                let isValid = false;
                                const isPickedUpCard = state.phase === 'discard' && card.id === state.upcard?.id;

                                if (state.currentPlayerIndex === myIdx) {
                                    if (state.phase === 'discard') isValid = !isPickedUpCard;
                                    else if (state.phase === 'playing') {
                                        const leadCard = state.currentTrick.length > 0 ? state.currentTrick[0].card : null;
                                        const leadSuit = leadCard ? getEffectiveSuit(leadCard, state.trump) : null;
                                        isValid = isValidPlay(card, myPlayer.hand, leadSuit, state.trump);
                                    } else if (state.phase === 'bidding') isValid = true;
                                }

                                const overlapAmount = isMyTurnToPlay ? (handSize > 1 ? -15 : 0) : (handSize > 1 ? -46 : 0);
                                const isFirstCard = index === 0;

                                return (
                                    <div
                                        key={card.id}
                                        className="relative"
                                        style={{
                                            marginLeft: isFirstCard ? 0 : `${overlapAmount}px`,
                                            zIndex: index + 1
                                        }}
                                    >
                                        <AnimatePresence>
                                            {isPickedUpCard && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="absolute -top-12 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-xl border-2 border-white z-10 whitespace-nowrap"
                                                >
                                                    NEW CARD
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        <CardComponent
                                            card={card}
                                            size="mobile"
                                            isValid={isValid || state.phase === 'scoring'}
                                            onClick={() => {
                                                if (state.phase === 'discard' && isValid) dispatch({ type: 'DISCARD_CARD', payload: { playerIndex: myIdx, cardId: card.id } });
                                                else if (state.phase === 'playing' && isValid) dispatch({ type: 'PLAY_CARD', payload: { playerIndex: myIdx, cardId: card.id } });
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
            </div>

            {/* Step Mode Overlay */}
            {state.stepMode && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-56 p-6 bg-amber-500 text-white rounded-[2.5rem] shadow-xl text-center z-[70]">
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Step Mode</div>
                    <button onClick={handleNextStep} className="w-full font-black py-4 bg-paper/20 hover:bg-paper/30 rounded-2xl transition transform active:scale-95">NEXT ACTION →</button>
                </div>
            )}
        </div>
    );
};
