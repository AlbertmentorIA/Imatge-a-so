/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, Volume2, Loader2, AlertCircle, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GeminiService } from './services/geminiService';

type Language = {
  code: string;
  name: string;
  voice: string;
  prompt: string;
  errorMsg: string;
  processingMsg: string;
};

const SUPPORTED_LANGUAGES: Record<string, Language> = {
  ca: { 
    code: 'ca-ES', 
    name: 'Català', 
    voice: 'Kore', 
    prompt: 'català',
    errorMsg: "No s'ha detectat cap text a la imatge. Torna-ho a provar.",
    processingMsg: "Processant..."
  },
  es: { 
    code: 'es-ES', 
    name: 'Español', 
    voice: 'Kore', 
    prompt: 'español',
    errorMsg: "No se ha detectado texto en la imagen. Inténtalo de nuevo.",
    processingMsg: "Procesando..."
  },
  en: { 
    code: 'en-US', 
    name: 'English', 
    voice: 'Puck', 
    prompt: 'english',
    errorMsg: "No text detected in the image. Please try again.",
    processingMsg: "Processing..."
  },
  fr: { 
    code: 'fr-FR', 
    name: 'Français', 
    voice: 'Fenrir', 
    prompt: 'français',
    errorMsg: "Aucun texte détecté dans l'image. Veuillez réessayer.",
    processingMsg: "Traitement..."
  },
};

export default function App() {
  const [selectedLang, setSelectedLang] = useState<string>('ca');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastText, setLastText] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const langConfig = SUPPORTED_LANGUAGES[selectedLang];

  // Funció per parlar missatges d'error o estat usant Web Speech API
  const speakStatus = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langConfig.code;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  // Funció per reproduir àudio PCM de Gemini
  const playPCMAudio = async (base64Data: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const int16Data = new Int16Array(bytes.buffer);
      const float32Data = new Float32Array(int16Data.length);
      
      for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 32768.0;
      }
      
      const audioBuffer = ctx.createBuffer(1, float32Data.length, 24000);
      audioBuffer.getChannelData(0).set(float32Data);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
    } catch (err) {
      console.error("Error reproduint PCM:", err);
      if (lastText) speakStatus(lastText);
    }
  };

  const processImage = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setLastText(null);
    setAudioData(null);

    try {
      // 1. Convertir imatge a base64
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(file);
      });

      // 2. OCR via GeminiService
      const ocrResult = await GeminiService.extractText(base64Data, file.type, langConfig.prompt);

      if (ocrResult.error || !ocrResult.text) {
        setError(langConfig.errorMsg);
        speakStatus(langConfig.errorMsg);
        setIsProcessing(false);
        return;
      }

      setLastText(ocrResult.text);

      // 3. TTS via GeminiService
      const base64Audio = await GeminiService.generateSpeech(ocrResult.text, langConfig.voice);
      
      if (base64Audio) {
        setAudioData(base64Audio);
        await playPCMAudio(base64Audio);
      } else {
        speakStatus(ocrResult.text);
      }

    } catch (err) {
      console.error(err);
      const msg = selectedLang === 'ca' ? "S'ha produït un error." : "An error occurred.";
      setError(msg);
      speakStatus(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const replayAudio = () => {
    if (audioData) {
      playPCMAudio(audioData);
    } else if (lastText) {
      speakStatus(lastText);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans p-6 flex flex-col items-center justify-center">
      <header className="mb-8 text-center w-full max-w-md">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Lector Accessible</h1>
        
        {/* Selector d'idioma */}
        <div className="flex items-center justify-center gap-2 mt-4 bg-white p-2 rounded-xl shadow-sm border border-stone-100">
          <Globe className="w-4 h-4 text-stone-400" />
          <select 
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            className="bg-transparent font-medium text-sm focus:outline-none cursor-pointer"
            aria-label="Selecciona l'idioma"
          >
            {Object.entries(SUPPORTED_LANGUAGES).map(([key, lang]) => (
              <option key={key} value={key}>{lang.name}</option>
            ))}
          </select>
        </div>
      </header>

      <main className="w-full max-w-md space-y-8">
        {/* Botó Gran per fer Foto */}
        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={isProcessing}
          className="w-full aspect-square bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-3xl shadow-xl flex flex-col items-center justify-center transition-all transform active:scale-95 disabled:opacity-50 disabled:grayscale"
          aria-label="Fer una fotografia per llegir"
        >
          {isProcessing ? (
            <Loader2 className="w-24 h-24 animate-spin mb-4" />
          ) : (
            <Camera className="w-24 h-24 mb-4" />
          )}
          <span className="text-2xl font-bold uppercase tracking-wide">
            {isProcessing ? langConfig.processingMsg : (selectedLang === 'ca' ? "Fer Foto" : (selectedLang === 'es' ? "Hacer Foto" : (selectedLang === 'en' ? "Take Photo" : "Prendre Photo")))}
          </span>
        </button>

        <div className="grid grid-cols-2 gap-4">
          {/* Botó per carregar de galeria */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="bg-white border-2 border-stone-200 hover:border-stone-400 p-6 rounded-2xl flex flex-col items-center justify-center transition-colors active:bg-stone-100 disabled:opacity-50"
            aria-label="Carregar imatge de la galeria"
          >
            <ImageIcon className="w-8 h-8 mb-2 text-stone-600" />
            <span className="font-semibold">{selectedLang === 'ca' ? "Galeria" : (selectedLang === 'es' ? "Galería" : (selectedLang === 'en' ? "Gallery" : "Galerie"))}</span>
          </button>

          {/* Botó per repetir àudio */}
          <button
            onClick={replayAudio}
            disabled={isProcessing || (!audioData && !lastText)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-6 rounded-2xl flex flex-col items-center justify-center transition-colors active:bg-indigo-800 disabled:opacity-30"
            aria-label="Tornar a escoltar el text"
          >
            <Volume2 className="w-8 h-8 mb-2" />
            <span className="font-semibold">{selectedLang === 'ca' ? "Repetir" : (selectedLang === 'es' ? "Repetir" : (selectedLang === 'en' ? "Replay" : "Répéter"))}</span>
          </button>
        </div>

        {/* Inputs ocults */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={cameraInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Feedback d'errors */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 text-red-700"
            >
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Visualització del text extret */}
        {lastText && !isProcessing && (
          <div className="p-4 bg-white border border-stone-100 rounded-xl shadow-sm">
            <h2 className="text-xs font-bold uppercase text-stone-400 mb-2 tracking-widest">
              {selectedLang === 'ca' ? "Text Detectat" : (selectedLang === 'es' ? "Texto Detectado" : (selectedLang === 'en' ? "Detected Text" : "Texte Détecté"))}
            </h2>
            <p className="text-stone-700 leading-relaxed">{lastText}</p>
          </div>
        )}
      </main>

      <footer className="mt-auto pt-12 text-stone-400 text-xs text-center">
        <p>Desenvolupat per a l'accessibilitat total.</p>
      </footer>
    </div>
  );
}
