import React from 'react';
import { Volume2 } from 'lucide-react';

interface AudioControlsProps {
  outputGain: number;
  onVolumeChange: (volume: number) => void;
  isRecording: boolean;
}

const AudioControls: React.FC<AudioControlsProps> = ({
  outputGain,
  onVolumeChange,
  isRecording
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Volume2 className="text-green-400" size={20} />
        <span className="text-green-300 text-sm">VOLUMEN_SALIDA</span>
      </div>
      
      <div className="space-y-2">
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={outputGain}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          disabled={!isRecording}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
        />
        
        <div className="flex justify-between text-xs text-green-300">
          <span>0%</span>
          <span className="font-mono">{Math.round(outputGain * 100)}%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="text-xs text-green-300">
        <div className="flex justify-between">
          <span>ESTADO:</span>
          <span className={isRecording ? 'text-green-400' : 'text-gray-500'}>
            {isRecording ? 'CONECTADO' : 'DESCONECTADO'}
          </span>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #00ff00;
          cursor: pointer;
          border: 2px solid #000;
        }

        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #00ff00;
          cursor: pointer;
          border: 2px solid #000;
        }
      `}</style>
    </div>
  );
};

export default AudioControls;