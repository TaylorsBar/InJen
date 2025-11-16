import { useState, useRef, useCallback } from 'react';

type RecordingStatus = 'idle' | 'recording' | 'stopped';

export const useRecording = () => {
    const [status, setStatus] = useState<RecordingStatus>('idle');
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [timer, setTimer] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const timerIntervalRef = useRef<number | null>(null);

    const stopRecordingCleanup = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current = null;
        }
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        setTimer(0);
        recordedChunksRef.current = [];
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        // The rest is handled by the onstop event handler
    }, []);

    const startRecording = useCallback(async () => {
        if (status !== 'idle') return;
        setError(null);

        try {
            // FIX: The `cursor` property in `getDisplayMedia` constraints was causing a TypeScript error.
            // It has been removed. The default behavior is to capture the cursor, so functionality is unchanged.
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 30,
                },
                audio: { // Capture system audio
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });

            let audioStream: MediaStream | null = null;
            let combinedStream: MediaStream;

            try {
                 audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                 const audioTrack = audioStream.getAudioTracks()[0];
                 combinedStream = new MediaStream([...displayStream.getTracks(), audioTrack]);
            } catch (micError) {
                console.warn("Microphone access denied or failed, recording without mic audio.", micError);
                combinedStream = displayStream;
            }
            
            streamRef.current = combinedStream;

            // Stop recording if the user stops screen sharing from the browser UI
            displayStream.getVideoTracks()[0].onended = () => {
                stopRecording();
            };
            
            const options = { mimeType: 'video/webm; codecs=vp9' };
            mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                setVideoUrl(url);
                setStatus('stopped');
                stopRecordingCleanup();
            };

            mediaRecorderRef.current.start();
            setStatus('recording');
            timerIntervalRef.current = window.setInterval(() => {
                setTimer(t => t + 1);
            }, 1000);

        } catch (err) {
            console.error("Error starting recording:", err);
            setError("Failed to start recording. Please grant permissions and try again.");
            setStatus('idle');
            setTimeout(() => setError(null), 5000); // Clear error after 5s
        }
    }, [status, stopRecordingCleanup, stopRecording]);
    
    const discardRecording = useCallback(() => {
        if (videoUrl) {
            URL.revokeObjectURL(videoUrl);
        }
        setVideoUrl(null);
        setStatus('idle');
        setError(null);
    }, [videoUrl]);

    return { status, videoUrl, error, timer, startRecording, stopRecording, discardRecording };
};
