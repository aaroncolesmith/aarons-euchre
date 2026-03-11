import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useHostElection(tableCode: string | null, playerName: string | null) {
    const [isHost, setIsHost] = useState(false);
    const [presenceChannel, setPresenceChannel] = useState<RealtimeChannel | null>(null);
    const [onlinePlayers, setOnlinePlayers] = useState<string[]>([]);

    useEffect(() => {
        if (!tableCode || !playerName) {
            setIsHost(false);
            if (presenceChannel) {
                presenceChannel.unsubscribe();
                setPresenceChannel(null);
            }
            return;
        }

        // Daily challenges are single-player local instances, even if they share the same tableCode.
        // There is no need for presence channels or host election. The local user is ALWAYS the host.
        if (tableCode.startsWith('DAILY-')) {
            setIsHost(true);
            return;
        }

        const channel = supabase.channel(`presence-${tableCode}`, {
            config: {
                presence: {
                    key: playerName
                }
            }
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState();
                const players = Object.keys(newState).sort(); // Alphabetical sort of connected names
                setOnlinePlayers(players);
                
                if (players.length > 0) {
                    // Host is strictly the first alphabetically sorted player currently online
                    const electedHost = players[0];
                    setIsHost(electedHost === playerName);
                } else {
                    setIsHost(false);
                }
            })
            .on('presence', { event: 'join' }, ({ key }) => {
                console.log('Player JOINED:', key);
            })
            .on('presence', { event: 'leave' }, ({ key }) => {
                console.log('Player LEFT:', key);
            });

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({ online_at: new Date().toISOString() });
            }
        });

        setPresenceChannel(channel);

        return () => {
            channel.unsubscribe();
            setPresenceChannel(null);
        };
    }, [tableCode, playerName]);

    return { isHost, onlinePlayers };
}
