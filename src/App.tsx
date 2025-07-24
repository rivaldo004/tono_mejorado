import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Headphones, Volume2, VolumeX, Settings, Activity } from 'lucide-react';
import AudioVisualizer from './components/AudioVisualizer';
import ToneAnalyzer from './components/ToneAnalyzer';
import AudioControls from './components/AudioControls';
import VoiceMetrics from './components/VoiceMetrics';
import RecordingControls from './components/RecordingControls';
import useSpeechToText from './hooks/useSpeechToText';
import { VoiceData, RecordingSession } from './types/Recording';
import { detectGender, calculateDominantGender, resetGenderBuffer } from './utils/voiceAnalysis';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [outputGain, setOutputGain] = useState(0.5);
  const [pitch, setPitch] = useState(0);
  const [intensity, setIntensity] = useState(0);
  const [voiceQuality, setVoiceQuality] = useState(0);
  const [currentGender, setCurrentGender] = useState<'MASCULINA' | 'FEMENINA' | 'INDETERMINADA'>('INDETERMINADA');
  const [isSessionRecording, setIsSessionRecording] = useState(false);
  const [currentSession, setCurrentSession] = useState<RecordingSession | null>(null);
  const [transcription, setTranscription] = useState('');
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  useEffect(() => {
    return () => {
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [audioStream, audioContext]);

  // Usar el hook de reconocimiento de voz
  useSpeechToText({
    isRecording,
    onTranscriptionChange: (text) => {
      setTranscription(text);
    }
  });

  // Effect para detectar género basado en pitch con suavizado
  useEffect(() => {
    const gender = detectGender(pitch);
    setCurrentGender(gender);
  }, [pitch]);

  // Effect para grabar datos de la sesión
  useEffect(() => {
    if (isSessionRecording && currentSession && pitch > 0) {
      const voiceData: VoiceData = {
        timestamp: Date.now(),
        pitch,
        intensity,
        voiceQuality,
        gender: currentGender
      };

      setCurrentSession(prev => {
        if (!prev) return prev;
        
        const updatedVoiceData = [...prev.voiceData, voiceData];
        
        // Calcular promedios solo con datos válidos
        const validData = updatedVoiceData.filter(data => data.pitch > 50 && data.pitch < 500);
        
        if (validData.length === 0) return prev;
        
        const averagePitch = validData.reduce((sum, data) => sum + data.pitch, 0) / validData.length;
        const averageIntensity = validData.reduce((sum, data) => sum + data.intensity, 0) / validData.length;
        const averageQuality = validData.reduce((sum, data) => sum + data.voiceQuality, 0) / validData.length;
        const dominantGender = calculateDominantGender(validData);
        
        return {
          ...prev,
          voiceData: updatedVoiceData,
          averagePitch,
          averageIntensity,
          averageQuality,
          dominantGender,
          duration: Date.now() - prev.startTime
        };
      });
    }
  }, [isSessionRecording, currentSession, pitch, intensity, voiceQuality, currentGender]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      const context = new AudioContext({ sampleRate: 44100 });
      const analyserNode = context.createAnalyser();
      const source = context.createMediaStreamSource(stream);
      const gainNode = context.createGain();
      
      // Configuración optimizada del analizador
      analyserNode.fftSize = 4096; // Mayor resolución para mejor detección de pitch
      analyserNode.smoothingTimeConstant = 0.3; // Menos suavizado para respuesta más rápida
      analyserNode.minDecibels = -90;
      analyserNode.maxDecibels = -10;
      
      source.connect(analyserNode);
      source.connect(gainNode);
      gainNode.connect(context.destination);

      // Resetear buffer de género al iniciar nueva grabación
      resetGenderBuffer();
      
      // Iniciar transcripción
      setTranscription('');
      gainNode.gain.value = outputGain;
      
      setAudioStream(stream);
      setAudioContext(context);
      setAnalyser(analyserNode);
      setIsRecording(true);
      
      sourceRef.current = source;
      gainNodeRef.current = gainNode;
      
      // Crear elemento audio para reproducción
      if (audioRef.current) {
        audioRef.current.srcObject = stream;
        audioRef.current.play();
      }
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Error al acceder al micrófono. Por favor, permite el acceso al micrófono.');
    }
  };

  const stopRecording = () => {
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
    }
    if (audioContext) {
      audioContext.close();
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    
    // Resetear estados
    setAudioStream(null);
    setAudioContext(null);
    setAnalyser(null);
    setIsRecording(false);
    setPitch(0);
    setIntensity(0);
    setVoiceQuality(0);
    setCurrentGender('INDETERMINADA');
    
    sourceRef.current = null;
    gainNodeRef.current = null;
    
    // Resetear buffer de género
    resetGenderBuffer();
  };

  const toggleListening = () => {
    setIsListening(!isListening);
    if (audioRef.current) {
      audioRef.current.muted = isListening;
    }
  };

  const handleVolumeChange = (volume: number) => {
    setOutputGain(volume);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  };

  const startSession = () => {
    const sessionId = `SESION_${Date.now().toString(36).toUpperCase()}`;
    const newSession: RecordingSession = {
      id: sessionId,
      startTime: Date.now(),
      voiceData: [],
      averagePitch: 0,
      averageIntensity: 0,
      averageQuality: 0,
      dominantGender: 'INDETERMINADA',
      duration: 0
    };
    
    setCurrentSession(newSession);
    setIsSessionRecording(true);
    
    // Resetear buffer de género al iniciar nueva sesión
    resetGenderBuffer();
  };

  const stopSession = () => {
    if (currentSession) {
      setCurrentSession(prev => prev ? {
        ...prev,
        endTime: Date.now(),
        duration: Date.now() - prev.startTime
      } : null);
    }
    setIsSessionRecording(false);
  };

  const saveSession = () => {
    if (currentSession) {
      // Crear un objeto con los datos de la sesión para descargar
      const sessionData = {
        ...currentSession,
        exportDate: new Date().toISOString(),
        summary: {
          totalSamples: currentSession.voiceData.length,
          validSamples: currentSession.voiceData.filter(d => d.pitch > 50 && d.pitch < 500).length,
          durationMinutes: Math.round(currentSession.duration / 60000 * 100) / 100,
          pitchRange: {
            min: Math.min(...currentSession.voiceData.map(d => d.pitch).filter(p => p > 50)),
            max: Math.max(...currentSession.voiceData.map(d => d.pitch).filter(p => p < 500))
          }
        }
      };
      
      // Crear y descargar archivo JSON
      const dataStr = JSON.stringify(sessionData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `sesion_voz_${currentSession.id}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      console.log('Sesión guardada:', sessionData);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-green-400 mb-2 flex items-center justify-center gap-3">
            <Activity className="text-green-400" size={40} />
            Analizador de Tono de Voz
          </h1>
          <p className="text-green-300 text-lg">
            Análisis en tiempo real para comunicación efectiva
          </p>
        </div>

        {/* Main Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          {/* Speaker Controls */}
          <div className="bg-gray-900 border border-green-500 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-green-400 mb-4 flex items-center gap-2">
              <Mic className="text-green-400" size={24} />
              Control del Hablante
            </h2>
            <div className="space-y-4">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                  isRecording
                    ? 'bg-red-600 hover:bg-red-700 text-white border border-red-500'
                    : 'bg-green-600 hover:bg-green-700 text-black border border-green-400'
                }`}
              >
                {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                {isRecording ? 'Detener Micrófono' : 'Iniciar Micrófono'}
              </button>
              
              {isRecording && (
                <div className="flex items-center justify-center">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                  </div>
                  <span className="text-green-400 ml-2 text-sm">MICRÓFONO_CONECTADO</span>
                </div>
              )}
            </div>
          </div>

          {/* Listener Controls */}
          <div className="bg-gray-900 border border-green-500 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-green-400 mb-4 flex items-center gap-2">
              <Headphones className="text-green-400" size={24} />
              Control del Oyente
            </h2>
            <div className="space-y-4">
              <button
                onClick={toggleListening}
                disabled={!isRecording}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                  !isRecording
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed border border-gray-600'
                    : isListening
                    ? 'bg-green-600 hover:bg-green-700 text-black border border-green-400'
                    : 'bg-gray-600 hover:bg-gray-700 text-white border border-gray-500'
                }`}
              >
                {isListening ? <Volume2 size={20} /> : <VolumeX size={20} />}
                {isListening ? 'Escuchando' : 'Activar Audio'}
              </button>
              
              {isListening && (
                <div className="flex items-center justify-center">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                  <span className="text-green-400 ml-2 text-sm">SISTEMA_CONECTADO</span>
                </div>
              )}
            </div>
          </div>

          {/* Audio Controls */}
          <div className="bg-gray-900 border border-green-500 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-green-400 mb-4 flex items-center gap-2">
              <Settings className="text-green-400" size={24} />
              Controles de Audio
            </h2>
            <AudioControls
              outputGain={outputGain}
              onVolumeChange={handleVolumeChange}
              isRecording={isRecording}
            />
          </div>

          {/* Recording Controls */}
          <RecordingControls
            isRecording={isRecording}
            isSessionRecording={isSessionRecording}
            currentSession={currentSession}
            onStartSession={startSession}
            onStopSession={stopSession}
            onSaveSession={saveSession}
            currentGender={currentGender}
          />
        </div>

        {/* Analysis Section */}
        {isRecording && analyser && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Audio Visualizer */}
            <div className="bg-gray-900 border border-green-500 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-green-400 mb-4">📊 ANALIZADOR_ESPECTRO</h3>
              <AudioVisualizer analyser={analyser} />
            </div>

            {/* Tone Analyzer */}
            <div className="bg-gray-900 border border-green-500 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-green-400 mb-4">📈 ANALIZADOR_FRECUENCIA.EXE</h3>
              <ToneAnalyzer 
                analyser={analyser} 
                onPitchChange={setPitch}
                onIntensityChange={setIntensity}
                onQualityChange={setVoiceQuality}
              />
            </div>
          </div>
        )}

        {/* Voice Metrics */}
        {isRecording && (
          <VoiceMetrics 
            pitch={pitch}
            intensity={intensity}
            voiceQuality={voiceQuality}
            currentGender={currentGender}
            transcription={transcription}
          />
        )}

        {/* Hidden audio element */}
        <audio 
          ref={audioRef} 
          muted={!isListening}
          style={{ display: 'none' }}
        />

        {/* Instructions */}
        <div className="mt-8 bg-gray-900 border border-green-500 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-green-400 mb-3">INSTRUCCIONES_SISTEMA:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-green-300">
            <div>
              <h4 className="font-medium text-green-400 mb-2">USUARIO_HABLANTE:</h4>
              <ul className="space-y-1 text-sm">
                <li>• [INICIAR_ANÁLISIS]</li>
                <li>• ACTIVAR_MICRÓFONO_PARA_INICIALIZAR</li>
                <li>• MONITOREO_DE_ESPECTRO_DE_AUDIO_EN_TIEMPO_REAL</li>
                <li>• AJUSTAR_PARÁMETROS_SEGÚN_MÉTRICAS</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-green-400 mb-2">USUARIO_OYENTE:</h4>
              <ul className="space-y-1 text-sm">
                <li>• DISPOSITIVO_AUDIO: REQUERIDO</li>
                <li>• [ESCUCHAR] CUANDO_ESTÉ_LISTO</li>
                <li>• CONFIGURAR_VOLUMEN_SEGÚN_NECESIDADES</li>
                <li>• OBSERVAR_MÉTRICAS_DE_VOZ</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;