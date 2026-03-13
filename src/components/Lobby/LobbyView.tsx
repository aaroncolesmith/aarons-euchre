import { useGame } from '../../store/GameStore';
import { PlayerSeat } from '../common/PlayerSeat';

export const LobbyView = () => {
    const { state, dispatch } = useGame();

    return (
        <div className="flex-1 bg-paper rounded-[2rem] md:rounded-[3rem] border-4 border-brand shadow-sketch-brand relative flex flex-col w-full h-full overflow-hidden">

            <div className="shrink-0 flex justify-between items-start p-5 md:p-8 bg-paper border-b-2 border-brand-dim/50 z-30">
                <div className="flex flex-col">
                    <h1 className="text-2xl md:text-3xl font-black text-brand-dark tracking-wide leading-none">
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
                        <button
                            onClick={() => dispatch({ type: 'SET_TAB', payload: { tab: 'stats' } })}
                            className="bg-paper hover:bg-brand/10 text-brand-dark px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 border-brand transition-all shadow-[3px_3px_0px_0px_rgba(16,185,129,0.3)]"
                        >
                            STATS
                        </button>
                        <button
                            onClick={() => dispatch({ type: 'EXIT_TO_LANDING' })}
                            className="w-[34px] h-[34px] bg-paper hover:bg-red-50 text-brand-dark hover:text-red-500 rounded-xl border-2 border-brand transition-all flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(16,185,129,0.3)]"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 relative bg-paper flex flex-col items-center overflow-hidden w-full h-full scale-95 md:scale-100 origin-center">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-6 z-10">
                    <div className="text-brand font-black text-xl uppercase tracking-[0.2em] animate-pulse">Waiting for Players</div>
                    <button
                        onClick={() => {
                            const emptySeats = state.players.filter(p => !p.name).length;
                            if (emptySeats > 0) {
                                if (confirm(`Auto-fill ${emptySeats} seats with bots?`)) {
                                    dispatch({ type: 'AUTOFILL_BOTS' });
                                    setTimeout(() => dispatch({ type: 'START_MATCH' }), 100);
                                }
                            } else {
                                dispatch({ type: 'START_MATCH' });
                            }
                        }}
                        className="bg-brand hover:bg-brand-dim text-white font-black px-8 py-4 rounded-2xl text-xl border-4 border-ink shadow-sketch-brand hover:-translate-y-1 transition-all active:translate-y-0"
                    >
                        START MATCH
                    </button>
                </div>

                {(() => {
                    const myIdx = state.players.findIndex(p => p.name === state.currentViewPlayerName);
                    const refIdx = myIdx === -1 ? 0 : myIdx;
                    const positions: ('bottom' | 'left' | 'top' | 'right')[] = ['bottom', 'left', 'top', 'right'];

                    return [0, 1, 2, 3].map(offset => {
                        const pIdx = (refIdx + offset) % 4;
                        return (
                            <PlayerSeat
                                key={pIdx}
                                inLobby={true}
                                index={pIdx}
                                position={positions[offset]}
                                isCurrentTurn={false}
                                isDealer={false}
                            />
                        );
                    });
                })()}
            </div>
        </div>
    );
};
