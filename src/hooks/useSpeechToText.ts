import { useEffect, useRef } from 'react';

interface UseSpeechToTextProps {
  isRecording: boolean;
  onTranscriptionChange: (text: string) => void;
}

const useSpeechToText = ({ isRecording, onTranscriptionChange }: UseSpeechToTextProps) => {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    // Verificar si el navegador soporta reconocimiento de voz
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('El navegador no soporta reconocimiento de voz');
      return;
    }

    // Crear instancia de reconocimiento de voz
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-ES'; // Español
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListeningRef.current = true;
      console.log('Reconocimiento de voz iniciado');
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Actualizar transcripción con texto final e intermedio
      const fullTranscript = finalTranscript + interimTranscript;
      onTranscriptionChange(fullTranscript);
    };

    recognition.onerror = (event) => {
      console.error('Error en reconocimiento de voz:', event.error);
      if (event.error === 'not-allowed') {
        console.error('Permisos de micrófono denegados para reconocimiento de voz');
      }
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      // Reiniciar automáticamente si aún estamos grabando
      if (isRecording) {
        setTimeout(() => {
          if (isRecording && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (error) {
              console.error('Error al reiniciar reconocimiento:', error);
            }
          }
        }, 100);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!recognitionRef.current) return;

    if (isRecording && !isListeningRef.current) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error al iniciar reconocimiento de voz:', error);
      }
    } else if (!isRecording && isListeningRef.current) {
      recognitionRef.current.stop();
      onTranscriptionChange(''); // Limpiar transcripción al parar
    }
  }, [isRecording, onTranscriptionChange]);
};

// Declaración de tipos para TypeScript
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export default useSpeechToText;