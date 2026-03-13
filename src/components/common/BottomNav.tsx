import { Home, BarChart2, Monitor } from 'lucide-react';
import { useGame } from '../../store/GameStore';

export const BottomNav = () => {
    const { state, dispatch } = useGame();

    if (state.phase === 'login') return null;

    const navItems = [
        { id: 'home', label: 'HOME', icon: Home },
        { id: 'stats', label: 'STATS', icon: BarChart2 },
        { id: 'game', label: 'GAME', icon: Monitor },
    ] as const;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-paper border-t-4 border-ink z-[200] pb-safe">
            <div className="max-w-7xl mx-auto flex justify-around items-center h-20 px-4">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = state.activeTab === item.id;
                    
                    return (
                        <button
                            key={item.id}
                            onClick={() => dispatch({ type: 'SET_TAB', payload: { tab: item.id } })}
                            className={`flex flex-col items-center justify-center gap-1 transition-all flex-1 h-full relative ${
                                isActive ? 'text-brand' : 'text-slate-400 hover:text-ink'
                            }`}
                        >
                            {isActive && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-brand rounded-b-full" />
                            )}
                            <Icon className={`w-6 h-6 ${isActive ? 'scale-110' : 'scale-100'}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
