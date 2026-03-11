import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../../store/GameStore';

export const BotAuditView = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const { state } = useGame();

    if (!isOpen) return null;

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
                    className="relative w-full max-w-lg bg-paper rounded-[3rem] border-4 border-slate-900 shadow-sketch-ink overflow-hidden flex flex-col max-h-[80vh]"
                >
                    <div className="p-8 border-b-4 border-slate-900 bg-amber-500/5 flex justify-between items-center transition-all">
                        <div className="space-y-1">
                            <h2 className="text-3xl font-black italic uppercase tracking-tighter">Bot Core Audit</h2>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600">Decision Engine: Bible Analyst v2.1</p>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 rounded-full border-2 border-slate-900 flex items-center justify-center font-black hover:bg-slate-900 hover:text-white transition-all">✕</button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-6">
                        {state.players.filter(p => p.isComputer && p.name).map((bot, i) => (
                            <div key={bot.id} className="space-y-2 group">
                                <div className="flex items-center justify-between">
                                    <div className="text-lg font-black uppercase tracking-tight text-slate-900 group-hover:text-amber-500 transition-all">
                                        [{i + 1}] {bot.name}
                                    </div>
                                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                                        {bot.personality?.archetype || 'Neural Core'}
                                    </div>
                                </div>

                                <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 transition-all hover:border-amber-400/50">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Last Reasoning Output</div>
                                    <div className="text-sm font-hand font-black text-slate-600 leading-relaxed italic">
                                        "{bot.lastDecision || 'Awaiting input sequence...'}"
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-8 border-t-2 border-slate-100 bg-slate-50/50">
                        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Live Telemetry Active
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
