
import { useState, useEffect, useCallback } from 'react';
import { canService, CanFrame, CanBitrate } from '../services/canService';

export const useCanBus = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [frames, setFrames] = useState<CanFrame[]>([]);
    
    useEffect(() => {
        const checkStatus = () => {
            const status = canService.getStatus();
            setIsConnected(status.connected);
        };
        const interval = setInterval(checkStatus, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const unsubscribe = canService.subscribe((frame) => {
            setFrames(prev => [frame, ...prev].slice(0, 100)); // Keep last 100 frames
        });
        return unsubscribe;
    }, []);

    const connect = async () => {
        const result = await canService.connect();
        setIsConnected(result);
        return result;
    };

    const disconnect = () => {
        canService.disconnect();
        setIsConnected(false);
    };

    const configure = async (bitrate: CanBitrate) => {
        await canService.configureMCP2515(bitrate, 'NORMAL');
    };

    const sendFrame = async (id: number, data: number[]) => {
        await canService.sendFrame(id, data);
    };
    
    const clearFrames = () => setFrames([]);

    return {
        isConnected,
        frames,
        connect,
        disconnect,
        configure,
        sendFrame,
        clearFrames
    };
};
