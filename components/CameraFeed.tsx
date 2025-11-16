
import React, { useEffect, useRef, useState } from 'react';
import { CameraIcon } from './icons';

export const CameraFeed: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          // Prefer rear camera
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setHasPermission(true);
            setError(null);
          }
        } catch (err) {
          console.warn("Could not get environment camera, falling back to any camera.", err);
          // If rear camera fails, try any camera
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              setHasPermission(true);
              setError(null);
            }
          } catch (fallbackErr) {
            console.error("Error accessing camera:", fallbackErr);
            let message = "Could not access the camera. Please check permissions.";
            if (fallbackErr instanceof DOMException) {
              switch (fallbackErr.name) {
                case 'NotFoundError':
                case 'DevicesNotFoundError':
                  message = 'No camera found on this device.';
                  break;
                case 'NotAllowedError':
                case 'PermissionDeniedError':
                  message = 'Camera permission denied. Please enable it in your browser settings.';
                  break;
                case 'NotReadableError':
                  message = 'Could not start camera. It might be in use by another application.';
                  break;
                default:
                  message = `An unknown camera error occurred: ${fallbackErr.message}`;
              }
            } else if (fallbackErr instanceof Error) {
                message = fallbackErr.message;
            }
            setError(message);
            setHasPermission(false);
          }
        }
      } else {
         setError("Camera not supported on this device/browser.");
      }
    };
    startCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="w-full h-full bg-black relative">
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      
      {!hasPermission && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center">
            <CameraIcon className="w-16 h-16 text-cyan-500 mb-4"/>
            <h3 className="text-xl font-bold font-orbitron text-cyan-400">Vision System Offline</h3>
            <p className="text-gray-400 mt-2">{error || "Requesting camera access..."}</p>
        </div>
      )}
    </div>
  );
};
