import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../../store/GameStore';
import { Player } from '../../types/game';

export const BotAuditView = ({ isOpen, onClose, inline = false }: { isOpen?: boolean; onClose?: () => void; inline?: boolean }) => {
    const { state } = useGame();

    if (!inline && !isOpen) return null;

    const content = (
        <div className={`${inline ? 'w-full' : 'relative w-full max-w-lg bg-paper rounded-[3rem] border-4 border-slate-900 shadow-sketch-ink overflow-hidden flex flex-col max-h-[80vh]'}`}>
            <div className={`p-8 border-b-4 border-slate-900 bg-amber-500/5 flex justify-between items-center transition-all ${inline ? 'rounded-t-[3rem]' : ''}`}>
                <div className="space-y-1">
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter">Bot Core Audit</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600">Decision Engine: Bible Analyst v2.1</p>
                </div>
                {!inline && onClose && (
                    <button onClick={onClose} className="w-10 h-10 rounded-full border-2 border-slate-900 flex items-center justify-center font-black hover:bg-slate-900 hover:text-white transition-all">✕</button>
                )}
            </div>

            <div className={`${inline ? 'p-8 space-y-6 bg-paper' : 'flex-1 overflow-y-auto p-8 space-y-6'}`}>
                {(() => {
                    const activeBots = state.players.filter((p: Player) => p.isComputer && p.name);
                    
                    if (activeBots.length === 0) {
                        return (
                            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-2xl border-2 border-slate-200">?</div>
                                <div className="space-y-1">
                                    <div className="text-lg font-black uppercase tracking-tight text-slate-400">No Active Bots</div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Start a match with computers to see live telemetry</p>
                                </div>
                            </div>
                        );
                    }

                    const allDecisions = activeBots
                        .flatMap((bot: Player) => 
                            (bot.decisionHistory || []).map(entry => ({
                                ...entry,
                                botName: bot.name,
                                botArchetype: bot.personality?.archetype || 'Neural Core'
                            }))
                        )
                        .sort((a, b) => b.timestamp - a.timestamp);

                    if (allDecisions.length === 0) {
                        return ( activeBots.map((bot, i) => (
                            <div key={bot.id} className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 transition-all">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-900">
                                        [{i + 1}] {bot.name}
                                    </div>
                                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-100">
                                        {bot.personality?.archetype || 'Neural Core'}
                                    </div>
                                </div>
                                <div className="text-sm font-hand font-black text-slate-400 italic">
                                    " {bot.lastDecision || 'Awaiting input sequence...'} "
                                </div>
                            </div>
                        )));
                    }

                    return (
                        <div className="space-y-4">
                            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6 border-b-2 border-slate-100 pb-2">Central Decision Timeline</div>
                            {allDecisions.map((entry, idx) => (
                                <div 
                                    key={`${entry.botName}-${entry.timestamp}-${idx}`} 
                                    className={`relative bg-paper border-2 border-slate-900/10 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all ${idx === 0 ? 'border-amber-400 ring-4 ring-amber-400/10' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-amber-500" />
                                                <span className="text-sm font-black uppercase tracking-tight text-slate-900">{entry.botName}</span>
                                            </div>
                                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                {entry.botArchetype}
                                            </div>
                                        </div>
                                        <div className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </div>
                                    </div>
                                    
                                    <div className={`p-4 rounded-2xl font-hand font-black text-slate-700 italic border-l-4 ${idx === 0 ? 'bg-amber-50 border-amber-400 text-amber-900' : 'bg-slate-50 border-slate-200'}`}>
                                        "{entry.decision}"
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                })()}
            </div>

            <div className={`p-8 border-t-2 border-slate-100 bg-slate-50/50 ${inline ? 'rounded-b-[3rem]' : ''}`}>
                <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live Telemetry Active
                </div>
            </div>
        </div>
    );

    if (inline) return content;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-paper/60 backdrop-blur-md"
                />

                <motion.div
                    initial={{ scale: 0.9, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.9, y: 20, opacity: 0 }}
                    className="relative w-full max-w-lg"
                >
                    {content}
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
