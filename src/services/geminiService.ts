import { GoogleGenAI, Modality } from "@google/genai";

// Inicialització de l'API de Gemini
const genAI = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

export interface OCRResult {
  text: string;
  error?: string;
}

/**
 * Servei per interactuar amb els models de Gemini (OCR i TTS)
 */
export const GeminiService = {
  /**
   * Extreu text d'una imatge (OCR)
   */
  async extractText(base64Data: string, mimeType: string, langPrompt: string): Promise<OCRResult> {
    try {
      const model = "gemini-3-flash-preview";
      const result = await genAI.models.generateContent({
        model: model,
        contents: [
          {
            parts: [
              { inlineData: { data: base64Data, mimeType: mimeType } },
              { text: `Extract all text from this image. The text is likely in ${langPrompt}. If no text is found, respond only with 'NO_TEXT_FOUND'. Return only the extracted text without any comments.` }
            ]
          }
        ]
      });

      const text = result.text?.trim() || "";
      
      if (text === "NO_TEXT_FOUND" || !text) {
        return { text: "", error: "NO_TEXT_FOUND" };
      }

      return { text };
    } catch (error) {
      console.error("Error en OCR:", error);
      return { text: "", error: "API_ERROR" };
    }
  },

  /**
   * Genera àudio a partir de text (TTS)
   */
  async generateSpeech(text: string, voiceName: string): Promise<string | null> {
    try {
      const ttsResponse = await genAI.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      });

      return ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (error) {
      console.error("Error en TTS:", error);
      return null;
    }
  }
};
