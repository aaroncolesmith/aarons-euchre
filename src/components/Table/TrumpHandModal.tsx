import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../../store/GameStore';

export const TrumpHandModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const { state } = useGame();

    if (!isOpen) return null;

    // Get the most recent trump call log
    const currentLog = state.trumpCallLogs[state.trumpCallLogs.length - 1];

    if (!currentLog) return null;

    const cards = currentLog.handAfterDiscard.split(', ').filter(c => c && c.length > 0);

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
                    className="relative w-full max-w-lg bg-paper rounded-[3rem] border-4 border-slate-900 shadow-sketch-ink overflow-hidden flex flex-col"
                >
                    <div className="p-8 border-b-4 border-slate-900 bg-emerald-500/5 flex justify-between items-center transition-all">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black italic uppercase tracking-tighter">Trump Call Analysis</h2>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600">
                                Caller: {currentLog.whoCalled} ({currentLog.userType})
                            </p>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 rounded-full border-2 border-slate-900 flex items-center justify-center font-black hover:bg-slate-900 hover:text-white transition-all">✕</button>
                    </div>

                    <div className="p-8 space-y-6">
                        {/* Hand Display */}
                        <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-6 text-center shadow-sm">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Caller's Hand</div>
                            <div className="flex justify-center gap-2 flex-wrap">
                                {cards.map((card, i) => {
                                    const rank = card.slice(0, -1);
                                    const suitChar = card.slice(-1);
                                    const suitSym = suitChar === 'H' ? '♥' : suitChar === 'D' ? '♦' : suitChar === 'C' ? '♣' : '♠';
                                    const color = ['H', 'D'].includes(suitChar) ? 'text-red-500' : 'text-slate-900';
                                    
                                    return (
                                        <div key={i} className={`w-12 h-16 bg-white border-2 border-slate-200 rounded-xl flex flex-col items-center justify-center font-black shadow-sm ${color}`}>
                                            <div className="text-lg leading-none">{rank}</div>
                                            <div className="text-xl leading-none -mt-1">{suitSym}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Analytics Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Detailed View</div>
                                <div className="text-lg font-black text-slate-800 capitalize flex items-center gap-2">
                                    <span className={['Hearts', 'Diamonds'].includes(currentLog.suitCalled) ? 'text-red-500' : 'text-slate-800'}>
                                        {currentLog.suitCalled === 'Hearts' ? '♥' : currentLog.suitCalled === 'Diamonds' ? '♦' : currentLog.suitCalled === 'Clubs' ? '♣' : '♠'}
                                    </span>
                                    {currentLog.suitCalled}
                                </div>
                            </div>
                            <div className="bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Dealer</div>
                                <div className="text-sm font-black text-slate-800">{currentLog.dealer}</div>
                            </div>
                            {currentLog.cardPickedUp !== 'n/a' && (
                                <div className="bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl col-span-2 text-center">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Card Picked Up</div>
                                    <div className="text-lg font-black text-slate-800">{currentLog.cardPickedUp.replace('H', '♥').replace('D', '♦').replace('C', '♣').replace('S', '♠')}</div>
                                </div>
                            )}
                            <div className="bg-emerald-50 border-2 border-emerald-100 p-4 rounded-2xl text-center">
                                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Bowers</div>
                                <div className="text-3xl font-black text-emerald-700">{currentLog.bowerCount}</div>
                            </div>
                            <div className="bg-cyan-50 border-2 border-cyan-100 p-4 rounded-2xl text-center">
                                <div className="text-[10px] font-black uppercase tracking-widest text-cyan-600 mb-1">Total Trump</div>
                                <div className="text-3xl font-black text-cyan-700">{currentLog.trumpCount}</div>
                            </div>
                            <div className="bg-amber-50 border-2 border-amber-100 p-4 rounded-2xl text-center col-span-2">
                                <div className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Off-Suits (Lower = Better)</div>
                                <div className="text-3xl font-black text-amber-700">{currentLog.suitCount - 1}</div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
