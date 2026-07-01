import React, { useEffect, useRef, useState } from 'react';

interface AudioWaveformProps {
  isRecording: boolean;
}

export default function AudioWaveform({ isRecording }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [micError, setMicError] = useState(false);

  // Setup Real Microphone Web Audio Visualizer
  useEffect(() => {
    if (!isRecording) {
      cleanupAudio();
      drawFallbackWave();
      return;
    }

    setMicError(false);
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        streamRef.current = stream;
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        drawLiveWave();
      })
      .catch(err => {
        console.warn("Microphone access denied or not available, falling back to CSS wave", err);
        setMicError(true);
        drawFallbackWave();
      });

    return () => {
      cleanupAudio();
    };
  }, [isRecording]);

  const cleanupAudio = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
  };

  // Live microphone canvas visualization
  const drawLiveWave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      if (!isRecording) return;
      animationRef.current = requestAnimationFrame(render);

      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Draw background glow
      ctx.fillStyle = 'rgba(10, 10, 18, 0.2)';
      ctx.fillRect(0, 0, width, height);

      // Draw elegant digital waves
      const barWidth = (width / bufferLength) * 1.5;
      let barHeight;
      let x = 0;

      // Draw a centered double-sided waveform
      for (let i = 0; i < bufferLength; i++) {
        // Frequency normalized factor
        const percent = dataArray[i] / 255;
        barHeight = percent * (height * 0.7);

        // Gradient from Purple to Cyan
        const gradient = ctx.createLinearGradient(0, height / 2 - barHeight / 2, 0, height / 2 + barHeight / 2);
        gradient.addColorStop(0, '#a855f7'); // tailwind purple-500
        gradient.addColorStop(0.5, '#6366f1'); // tailwind indigo-500
        gradient.addColorStop(1, '#06b6d4'); // tailwind cyan-500

        ctx.fillStyle = gradient;

        // Rounded bar aesthetics
        const yPos = height / 2 - barHeight / 2;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, yPos, barWidth - 2, barHeight, 4);
        } else {
          ctx.rect(x, yPos, barWidth - 2, barHeight);
        }
        ctx.fill();

        x += barWidth;
      }
    };

    render();
  };

  // Fallback beautiful sine-wave animation (when mic is not active or blocked)
  const drawFallbackWave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      if (isRecording && !micError) return; // Mic takes over if active
      animationRef.current = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Draw subtle pulsing background
      ctx.fillStyle = 'transparent';
      ctx.fillRect(0, 0, width, height);

      // Draw multiple overlapping sine waves for a modern Siri/Alexa feel
      const waves = [
        { amplitude: isRecording ? 25 : 8, speed: 0.1, color: 'rgba(168, 85, 247, 0.4)' }, // purple
        { amplitude: isRecording ? 18 : 5, speed: -0.07, color: 'rgba(99, 102, 241, 0.3)' }, // indigo
        { amplitude: isRecording ? 12 : 3, speed: 0.15, color: 'rgba(6, 182, 212, 0.5)' }, // cyan
      ];

      waves.forEach(wave => {
        ctx.beginPath();
        ctx.strokeStyle = wave.color;
        ctx.lineWidth = isRecording ? 3 : 1.5;

        for (let x = 0; x < width; x++) {
          const y = height / 2 + Math.sin(x * 0.015 + phase * wave.speed) * wave.amplitude * Math.sin(x * Math.PI / width);
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });

      phase += 1;
    };

    render();
  };

  return (
    <div className="relative w-full h-16 flex items-center justify-center overflow-hidden rounded-xl bg-slate-950/40 border border-purple-500/10">
      <canvas
        ref={canvasRef}
        width={400}
        height={64}
        className="w-full h-full block opacity-90 transition-all duration-300"
      />
      {isRecording && (
        <span className="absolute top-2 right-3 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
      )}
    </div>
  );
}
