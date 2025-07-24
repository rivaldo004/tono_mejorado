import { VoiceData } from '../types/Recording';

// Constantes para análisis de género más precisas
const GENDER_THRESHOLDS = {
  MALE_MAX: 165,      // Hz - máximo típico para voz masculina
  FEMALE_MIN: 150,    // Hz - mínimo típico para voz femenina
  OVERLAP_ZONE: 15    // Hz - zona de solapamiento para evitar cambios bruscos
};

// Buffer para suavizar las detecciones
let genderBuffer: ('MASCULINA' | 'FEMENINA' | 'INDETERMINADA')[] = [];
const BUFFER_SIZE = 10; // Número de muestras para promediar

export function detectGender(pitch: number): 'MASCULINA' | 'FEMENINA' | 'INDETERMINADA' {
  // Si no hay pitch válido, retornar indeterminada
  if (!pitch || pitch < 50 || pitch > 500) {
    return 'INDETERMINADA';
  }

  let currentDetection: 'MASCULINA' | 'FEMENINA' | 'INDETERMINADA';

  // Análisis con zona de solapamiento para evitar cambios bruscos
  if (pitch < GENDER_THRESHOLDS.MALE_MAX - GENDER_THRESHOLDS.OVERLAP_ZONE) {
    currentDetection = 'MASCULINA';
  } else if (pitch > GENDER_THRESHOLDS.FEMALE_MIN + GENDER_THRESHOLDS.OVERLAP_ZONE) {
    currentDetection = 'FEMENINA';
  } else {
    // En la zona de solapamiento, mantener la detección anterior si existe
    if (genderBuffer.length > 0) {
      const lastDetection = genderBuffer[genderBuffer.length - 1];
      currentDetection = lastDetection !== 'INDETERMINADA' ? lastDetection : 'INDETERMINADA';
    } else {
      currentDetection = 'INDETERMINADA';
    }
  }

  // Agregar al buffer
  genderBuffer.push(currentDetection);
  
  // Mantener el tamaño del buffer
  if (genderBuffer.length > BUFFER_SIZE) {
    genderBuffer.shift();
  }

  // Retornar el género más frecuente en el buffer
  return getMostFrequentGender(genderBuffer);
}

function getMostFrequentGender(buffer: ('MASCULINA' | 'FEMENINA' | 'INDETERMINADA')[]): 'MASCULINA' | 'FEMENINA' | 'INDETERMINADA' {
  if (buffer.length === 0) return 'INDETERMINADA';

  const counts = {
    MASCULINA: 0,
    FEMENINA: 0,
    INDETERMINADA: 0
  };

  buffer.forEach(gender => {
    counts[gender]++;
  });

  // Encontrar el género con más ocurrencias
  const maxCount = Math.max(counts.MASCULINA, counts.FEMENINA, counts.INDETERMINADA);
  
  // Si hay empate o mayoría de indeterminadas, retornar indeterminada
  if (counts.INDETERMINADA === maxCount || 
      (counts.MASCULINA === maxCount && counts.FEMENINA === maxCount)) {
    return 'INDETERMINADA';
  }

  return counts.MASCULINA === maxCount ? 'MASCULINA' : 'FEMENINA';
}

export function calculateDominantGender(voiceData: VoiceData[]): 'MASCULINA' | 'FEMENINA' | 'INDETERMINADA' {
  if (voiceData.length === 0) return 'INDETERMINADA';

  // Filtrar solo datos con pitch válido
  const validData = voiceData.filter(data => data.pitch > 50 && data.pitch < 500);
  
  if (validData.length === 0) return 'INDETERMINADA';

  const counts = {
    MASCULINA: 0,
    FEMENINA: 0,
    INDETERMINADA: 0
  };

  validData.forEach(data => {
    counts[data.gender]++;
  });

  const total = validData.length;
  const malePercentage = (counts.MASCULINA / total) * 100;
  const femalePercentage = (counts.FEMENINA / total) * 100;

  // Requerir al menos 60% de confianza para determinar género
  if (malePercentage >= 60) return 'MASCULINA';
  if (femalePercentage >= 60) return 'FEMENINA';
  
  return 'INDETERMINADA';
}

// Función para limpiar el buffer (útil al iniciar nueva sesión)
export function resetGenderBuffer(): void {
  genderBuffer = [];
}

// Función para obtener estadísticas del pitch
export function getPitchStats(pitchValues: number[]): {
  average: number;
  min: number;
  max: number;
  variance: number;
} {
  const validPitches = pitchValues.filter(p => p > 50 && p < 500);
  
  if (validPitches.length === 0) {
    return { average: 0, min: 0, max: 0, variance: 0 };
  }

  const average = validPitches.reduce((sum, p) => sum + p, 0) / validPitches.length;
  const min = Math.min(...validPitches);
  const max = Math.max(...validPitches);
  
  const variance = validPitches.reduce((sum, p) => sum + Math.pow(p - average, 2), 0) / validPitches.length;

  return { average, min, max, variance };
}