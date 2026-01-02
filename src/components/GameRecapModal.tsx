import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy } from 'lucide-react';
import { GameState } from '../types/game';

interface GameRecapModalProps {
    isOpen: boolean;
    onClose: () => void;
    gameState: GameState;
}

export const GameRecapModal = ({ isOpen, onClose, gameState }: GameRecapModalProps) => {
    const [hoveredHand, setHoveredHand] = useState<number | null>(null);

    const stats = useMemo(() => {
        if (!gameState.history || gameState.history.length === 0) return [];

        return gameState.players.map((player, index) => {
            const team = (index === 0 || index === 2) ? 1 : 2;

            // Aggregate stats from history
            const playerStats = gameState.history.reduce((acc, hand) => {
                // Tricks Taken
                const tricks = hand.tricksWon[player.id] || 0;

                // Hand Won (Team)
                const handWon = hand.winningTeam === team;

                // Euchres Made (Opponent called, my team won)
                // winningTeam is 1 or 2. trumpCallerIndex is 0-3.
                // Caller Team:
                const callerTeam = (hand.trumpCallerIndex === 0 || hand.trumpCallerIndex === 2) ? 1 : 2;
                const isEuchre = handWon && callerTeam !== team;

                // Loners Won
                const isLonerWon = hand.isLoner && handWon && hand.trumpCallerIndex === index && hand.pointsScored[team === 1 ? 'team1' : 'team2'] >= 4;

                // Loner Call
                const isLonerCall = hand.isLoner && hand.trumpCallerIndex === index;

                return {
                    tricksTaken: acc.tricksTaken + tricks,
                    handsWon: acc.handsWon + (handWon ? 1 : 0),
                    euchresMade: acc.euchresMade + (isEuchre ? 1 : 0),
                    lonersWon: acc.lonersWon + (isLonerWon ? 1 : 0),
                    lonersCalled: acc.lonersCalled + (isLonerCall ? 1 : 0),
                    totalTricks: acc.totalTricks + 5 // 5 tricks per hand
                };
            }, { tricksTaken: 0, handsWon: 0, euchresMade: 0, lonersWon: 0, lonersCalled: 0, totalTricks: 0 });

            // Hand Win %
            const handWinPct = Math.round((playerStats.handsWon / gameState.history.length) * 100);

            // Tricks %
            const trickPct = Math.round((playerStats.tricksTaken / (gameState.history.length * 5)) * 100);

            // Composite Score for MVP
            const score = (playerStats.tricksTaken * 2) + (playerStats.euchresMade * 5) + (playerStats.lonersWon * 10) + (handWinPct / 2);

            return {
                ...player,
                ...playerStats,
                handWinPct,
                trickPct,
                score
            };
        });
    }, [gameState]);

    const { mvp, lvp } = useMemo(() => {
        if (stats.length === 0) return { mvp: null, lvp: null };
        const sorted = [...stats].sort((a, b) => b.score - a.score);
        return { mvp: sorted[0], lvp: sorted[sorted.length - 1] };
    }, [stats]);

    const chartData = useMemo(() => {
        let t1Score = 0;
        let t2Score = 0;
        const data = [{ hand: 0, t1: 0, t2: 0 }];

        gameState.history.forEach((h, i) => {
            t1Score += h.pointsScored.team1;
            t2Score += h.pointsScored.team2;
            data.push({ hand: i + 1, t1: t1Score, t2: t2Score });
        });
        return data;
    }, [gameState.history]);

    // Graph Dimensions
    const width = 100;
    const height = 50;
    const padding = 5;
    // UPDATED: Add + 1 to yMax for headroom
    const yMax = Math.max(10, ...chartData.map(d => Math.max(d.t1, d.t2))) + 1;
    const xMax = chartData.length > 1 ? chartData.length - 1 : 1;

    const getX = (i: number) => padding + (i / xMax) * (width - 2 * padding);
    const getY = (score: number) => height - padding - (score / yMax) * (height - 2 * padding);

    const t1Path = chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.t1)}`).join(' ');
    const t2Path = chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.t2)}`).join(' ');

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink/20 backdrop-blur-sm animate-in fade-in font-hand">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="bg-paper w-full max-w-4xl max-h-[90vh] rounded-[2rem] border-4 border-ink shadow-sketch-ink-lg flex flex-col overflow-hidden relative"
                    >
                        {/* Close Button */}
                        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-ink-dim hover:text-ink transition-colors z-20">
                            <X size={24} />
                        </button>

                        <div className="p-6 md:p-10 overflow-y-auto custom-scrollbar">
                            <h2 className="text-3xl font-black text-brand-dark mb-1">GAME RECAP</h2>
                            <div className="text-lg font-bold text-ink mb-6 flex gap-4">
                                {mvp && <span className="text-brand">MVP: {mvp.name}</span>}
                                <span className="text-ink-dim">|</span>
                                {lvp && <span className="text-ink-dim">LVP: {lvp.name}</span>}
                            </div>

                            {/* Stats Table */}
                            <div className="bg-paper-dim rounded-2xl border-2 border-brand/20 p-4 mb-6 overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[500px]">
                                    <thead>
                                        <tr className="text-xs font-black text-ink-dim uppercase tracking-widest border-b-2 border-brand/10">
                                            <th className="pb-3 pl-2">Player</th>
                                            <th className="pb-3 text-center">Hand Win %</th>
                                            <th className="pb-3 text-center">Tricks</th>
                                            <th className="pb-3 text-center">Trick %</th>
                                            <th className="pb-3 text-center">Euchres</th>
                                            <th className="pb-3 text-center">Loners</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.map((s, i) => (
                                            <tr key={i} className="border-b border-brand/5 last:border-0 hover:bg-white/50 transition-colors">
                                                <td className="py-3 pl-2 font-bold text-ink flex items-center gap-2">
                                                    {s.name}
                                                    {mvp?.id === s.id && <Trophy size={14} className="text-brand" />}
                                                </td>
                                                <td className="py-3 text-center font-black text-brand-dim">{s.handWinPct}%</td>
                                                <td className="py-3 text-center font-bold text-ink">{s.tricksTaken}</td>
                                                <td className="py-3 text-center text-ink-dim">{s.trickPct}%</td>
                                                <td className="py-3 text-center text-red-500 font-bold">{s.euchresMade}</td>
                                                <td className="py-3 text-center text-ink">{s.lonersWon}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Score Graph */}
                            <div
                                className="bg-paper rounded-2xl border-2 border-brand p-6 relative h-64 pl-8"
                                onMouseLeave={() => setHoveredHand(null)}
                            >
                                <div className="absolute top-4 right-4 flex flex-col items-end text-xs font-bold gap-1 z-10">
                                    <div className="flex items-center gap-2 text-brand-dark">
                                        {gameState.teamNames.team1} <div className="w-8 h-1 bg-brand-dark rounded-full"></div>
                                    </div>
                                    <div className="flex items-center gap-2 text-red-500">
                                        {gameState.teamNames.team2} <div className="w-8 h-1 bg-red-500 rounded-full"></div>
                                    </div>
                                </div>

                                <div className="absolute bottom-1 w-full text-center text-xs font-black text-brand tracking-widest pl-8 pointer-events-none">HAND</div>

                                {/* Tooltip - UPDATED positioning */}
                                {hoveredHand !== null && chartData[hoveredHand] && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="absolute z-20 bg-paper/95 backdrop-blur border-2 border-ink shadow-lg rounded-xl p-3 text-xs font-black pointer-events-none min-w-[120px]"
                                        style={{
                                            left: `${(getX(hoveredHand) / width) * 100}%`,
                                            top: `${(getY(Math.max(chartData[hoveredHand].t1, chartData[hoveredHand].t2)) / height) * 100}%`,
                                            transform: `translate(${hoveredHand > (chartData.length / 2) ? '-105%' : '5%'}, -50%)`
                                        }}
                                    >
                                        <div className="text-brand-dim uppercase tracking-widest mb-1 text-[10px]">Hand {chartData[hoveredHand].hand}</div>
                                        <div className="flex flex-col gap-0.5 whitespace-nowrap">
                                            <div className="text-brand-dark flex justify-between gap-3">
                                                <span>{gameState.teamNames.team1}:</span>
                                                <span>{chartData[hoveredHand].t1}</span>
                                            </div>
                                            <div className="text-red-500 flex justify-between gap-3">
                                                <span>{gameState.teamNames.team2}:</span>
                                                <span>{chartData[hoveredHand].t2}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                                    {/* Score Label on Y Axis */}
                                    <text
                                        transform="rotate(-90)"
                                        x={-height / 2}
                                        y={padding - 3}
                                        textAnchor="middle"
                                        className="text-[3px] font-black text-brand tracking-widest fill-current"
                                        style={{ fontFamily: 'inherit' }}
                                    >
                                        SCORE
                                    </text>

                                    {/* Axes */}
                                    <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="currentColor" className="text-brand" strokeWidth="0.5" strokeLinecap="round" />
                                    <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" className="text-brand" strokeWidth="0.5" strokeLinecap="round" />

                                    {/* Target Line (10 Points) */}
                                    <line
                                        x1={padding}
                                        y1={getY(10)}
                                        x2={width - padding}
                                        y2={getY(10)}
                                        stroke="currentColor"
                                        className="text-brand-dim"
                                        strokeWidth="0.3"
                                        strokeDasharray="1.5 1.5"
                                    />

                                    {/* Lines */}
                                    <path d={t1Path} fill="none" stroke="currentColor" className="text-brand-dark" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d={t2Path} fill="none" stroke="currentColor" className="text-red-500" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />

                                    {/* Dots with Hit Area */}
                                    {chartData.map((d, i) => (
                                        <g key={i} onMouseEnter={() => setHoveredHand(i)} className="cursor-crosshair group">
                                            {/* Invisible Heat Target */}
                                            <rect
                                                x={getX(i) - 2}
                                                y={padding}
                                                width="4"
                                                height={height - 2 * padding}
                                                fill="transparent"
                                            />
                                            {/* Guide Line on Hover */}
                                            {hoveredHand === i && (
                                                <line
                                                    x1={getX(i)} y1={padding} x2={getX(i)} y2={height - padding}
                                                    stroke="currentColor" strokeWidth="0.2" className="text-ink-dim" strokeDasharray="1 1"
                                                />
                                            )}
                                            <circle cx={getX(i)} cy={getY(d.t1)} r="1" className="fill-brand-dark group-hover:r-[1.5] transition-all" />
                                            <circle cx={getX(i)} cy={getY(d.t2)} r="1" className="fill-red-500 group-hover:r-[1.5] transition-all" />
                                        </g>
                                    ))}
                                </svg>
                            </div>

                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
