import React from 'react';
import { useGame } from '../../store/GameStore';

export const TableOverlay = () => {
    const { state, dispatch } = useGame();

    if (!state.overlayMessage) return null;

    // Auto-advance from scoring when everyone has acknowledged
    React.useEffect(() => {
        if (state.phase === 'scoring' && state.overlayMessage) {
            const humanPlayers = state.players.filter(p => p.name && !p.isComputer);
            const allAcknowledged = humanPlayers.every(p => state.overlayAcknowledged[p.name || '']);

            if (allAcknowledged) {
                // Everyone acknowledged - auto-advance after short delay
                const timer = setTimeout(() => {
                    dispatch({ type: 'FINISH_HAND' });
                }, 2000);
                return () => clearTimeout(timer);
            }
        }
    }, [state.phase, state.overlayMessage, state.overlayAcknowledged, state.players, dispatch]);

    // CRITICAL: Auto-dismiss overlay after 5 seconds to prevent freeze
    React.useEffect(() => {
        if (state.overlayMessage) {
            console.log('[OVERLAY] Auto-dismiss timer started (5 seconds)');
            const autoDismiss = setTimeout(() => {
                console.log('[OVERLAY] Auto-dismissing overlay to prevent freeze');
                dispatch({ type: 'CLEAR_OVERLAY' });
            }, 5000);

            return () => clearTimeout(autoDismiss);
        }
    }, [state.overlayMessage, dispatch]);

    const handleClick = () => {
        const myName = state.currentViewPlayerName;
        if (myName && !state.overlayAcknowledged[myName]) {
            dispatch({ type: 'CLEAR_OVERLAY' });
        }
    };

    return (
        <div
            onClick={handleClick}
            className="absolute inset-0 z-[60] flex items-center justify-center p-4 md:p-8 bg-paper/60 backdrop-blur-sm animate-in fade-in duration-300 cursor-pointer text-center"
        >
            <div className="bg-paper text-brand-dark px-6 md:px-12 py-8 rounded-[2rem] shadow-[12px_12px_0px_0px_rgba(16,185,129,0.2)] border-4 border-brand animate-in zoom-in slide-in-from-bottom-12 duration-500 max-w-lg w-full">
                <div className="text-xs font-black text-brand-dim uppercase tracking-[0.3em] mb-4">Event Notification</div>
                <div className="text-2xl md:text-3xl font-black font-hand text-brand-dark leading-relaxed">{state.overlayMessage}</div>
                <div className="mt-8 text-[10px] font-black text-brand-dim uppercase tracking-widest animate-pulse">Click to continue</div>
            </div>
        </div>
    );
};
