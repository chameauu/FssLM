import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { chatMultipart, type FlashCard, createFlashcard } from "../lib/api";
import LoadingIndicator from "../components/Chat/LoadingIndicator";

type GeneratedFlashcard = FlashCard & { saved?: boolean; id?: string };

export default function FlashcardGenerator() {
  const [files, setFiles] = useState<File[]>([]);
  const [generating, setGenerating] = useState(false);
  const [flashcards, setFlashcards] = useState<GeneratedFlashcard[]>([]);
  const [error, setError] = useState<string>("");
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles(selected);
    setError("");
  };

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (files.length === 0) {
      setError("Please upload at least one document");
      return;
    }

    setGenerating(true);
    setError("");
    setFlashcards([]);

    try {
      const prompt = `Analyze this document and generate 8-12 comprehensive flashcards. Include:
- Definition cards for key concepts
- Application cards with real-world scenarios
- Connection cards linking related ideas
- Troubleshooting/diagnostic questions
- Metacognitive questions for self-assessment

Use diverse question types and pedagogically-sound prompting to encourage deep understanding, not rote memorization. Each flashcard should have appropriate tags like: deep, transfer, metacognition, application, troubleshoot, synthesis, anti_rote, fun_factor, curiosity, story_driven.`;

      const result = await chatMultipart(prompt, files);
      
      if (result.flashcards && result.flashcards.length > 0) {
        setFlashcards(result.flashcards.map(card => ({ ...card, saved: false })));
      } else {
        setError("No flashcards were generated. The document might not contain suitable content.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate flashcards");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveCard = async (index: number) => {
    const card = flashcards[index];
    if (!card || card.saved) return;

    try {
      const result = await createFlashcard({
        question: card.q,
        answer: card.a,
        tag: card.tags?.[0] || "general",
      });

      setFlashcards(prev => prev.map((c, i) => 
        i === index ? { ...c, saved: true, id: result.flashcard.id } : c
      ));
    } catch (err) {
      console.error("Failed to save flashcard:", err);
    }
  };

  const handleSaveAll = async () => {
    const unsaved = flashcards.filter(card => !card.saved);
    await Promise.all(unsaved.map((_, i) => {
      const originalIndex = flashcards.findIndex(c => c === unsaved[i]);
      return handleSaveCard(originalIndex);
    }));
  };

  const handleReset = () => {
    setFiles([]);
    setFlashcards([]);
    setError("");
    setSelectedCard(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex flex-col min-h-screen w-full px-4 lg:pl-28 lg:pr-4">
      <div className="w-full max-w-6xl mx-auto p-4 pt-8 pb-24">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link to='/'
              className="p-2 rounded-xl bg-stone-950 border border-zinc-800 hover:bg-stone-900 transition-colors"
              aria-label="Back">
              <svg viewBox="0 0 24 24" className="size-5 text-stone-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </Link>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-7 text-blue-400">
                <path d="M3 5.25V3.75A2.25 2.25 0 0 1 5.25 1.5h13.5A2.25 2.25 0 0 1 21 3.75v16.5A2.25 2.25 0 0 1 18.75 22.5H5.25A2.25 2.25 0 0 1 3 20.25V5.25Z" />
              </svg>
              Flashcard Generator
            </h1>
          </div>
          <div className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-blue-300 text-xs font-medium">
            AI-POWERED
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left Column - Upload & Generate */}
          <div className="space-y-6">
            
            {/* Upload Section */}
            <div className="rounded-2xl bg-stone-950/90 border border-zinc-900 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Upload Document</h2>
              
              <div className="space-y-4">
                <div 
                  className="border-2 border-dashed border-zinc-800 rounded-xl p-8 text-center hover:border-zinc-700 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <svg className="mx-auto size-12 text-stone-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-stone-300 mb-1">Click to upload or drag and drop</p>
                  <p className="text-xs text-stone-500">PDF, DOCX, TXT, MD (Max 10MB)</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt,.md"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                {/* File List */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-stone-900/60 border border-zinc-800 rounded-lg p-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <svg className="size-5 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                          <div className="min-w-0">
                            <p className="text-sm text-stone-200 truncate">{file.name}</p>
                            <p className="text-xs text-stone-500">{(file.size / 1024).toFixed(2)} KB</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="p-1 rounded hover:bg-stone-800 text-stone-400 hover:text-red-400 transition-colors"
                        >
                          <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {error && (
                  <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 text-red-200 text-sm">
                    {error}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleGenerate}
                    disabled={files.length === 0 || generating}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-stone-800 disabled:text-stone-500 text-white font-medium py-3 px-6 rounded-xl transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {generating ? (
                      <>
                        <svg className="animate-spin size-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Generate Flashcards
                      </>
                    )}
                  </button>
                  
                  {flashcards.length > 0 && (
                    <button
                      onClick={handleReset}
                      className="px-6 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 border border-zinc-800 text-stone-300 hover:text-white transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Info Card */}
            <div className="rounded-2xl bg-gradient-to-br from-blue-950/30 to-purple-950/30 border border-blue-900/30 p-6">
              <h3 className="text-sm font-semibold text-blue-300 mb-3 flex items-center gap-2">
                <svg className="size-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                How it works
              </h3>
              <ul className="space-y-2 text-sm text-stone-400">
                <li className="flex gap-2">
                  <span className="text-blue-400">1.</span>
                  <span>Upload your study documents (PDF, DOCX, TXT, MD)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-400">2.</span>
                  <span>AI analyzes content and extracts key concepts</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-400">3.</span>
                  <span>Generates 8-12 pedagogically-optimized flashcards</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-400">4.</span>
                  <span>Review, save, and study your flashcards</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column - Results */}
          <div className="space-y-6">
            
            {generating && (
              <div className="rounded-2xl bg-stone-950/90 border border-zinc-900 p-12 text-center">
                <LoadingIndicator label="Analyzing document and generating flashcards..." />
              </div>
            )}

            {flashcards.length > 0 && (
              <>
                {/* Summary Header */}
                <div className="rounded-2xl bg-stone-950/90 border border-zinc-900 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-white">Generated Flashcards</h2>
                      <p className="text-sm text-stone-400 mt-1">{flashcards.length} cards ready for review</p>
                    </div>
                    <button
                      onClick={handleSaveAll}
                      disabled={flashcards.every(c => c.saved)}
                      className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-stone-800 disabled:text-stone-500 text-white text-sm font-medium transition-colors disabled:cursor-not-allowed"
                    >
                      {flashcards.every(c => c.saved) ? "All Saved" : "Save All"}
                    </button>
                  </div>
                </div>

                {/* Flashcards List */}
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scroll">
                  {flashcards.map((card, index) => (
                    <div
                      key={index}
                      className={`rounded-2xl border transition-all ${
                        selectedCard === index
                          ? 'bg-blue-950/30 border-blue-800'
                          : 'bg-stone-950/90 border-zinc-900 hover:border-zinc-800'
                      }`}
                    >
                      <div className="p-5">
                        {/* Card Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-stone-500">#{index + 1}</span>
                            {card.tags && card.tags.length > 0 && (
                              <div className="flex gap-1">
                                {card.tags.slice(0, 2).map((tag, i) => (
                                  <span key={i} className="px-2 py-0.5 rounded-full bg-blue-900/30 border border-blue-800/50 text-xs text-blue-300">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleSaveCard(index)}
                            disabled={card.saved}
                            className={`p-1.5 rounded-lg transition-colors ${
                              card.saved
                                ? 'bg-green-900/30 text-green-400'
                                : 'bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-white'
                            }`}
                            title={card.saved ? "Saved" : "Save to bag"}
                          >
                            {card.saved ? (
                              <svg className="size-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            )}
                          </button>
                        </div>

                        {/* Question */}
                        <div
                          className="cursor-pointer"
                          onClick={() => setSelectedCard(selectedCard === index ? null : index)}
                        >
                          <h3 className="text-stone-100 font-medium leading-relaxed mb-3">
                            {card.q}
                          </h3>

                          {/* Answer (collapsible) */}
                          {selectedCard === index && (
                            <div className="mt-3 pt-3 border-t border-zinc-800">
                              <p className="text-sm text-stone-400 leading-relaxed whitespace-pre-wrap">
                                {card.a}
                              </p>
                            </div>
                          )}

                          {/* Show/Hide indicator */}
                          <div className="mt-2 flex items-center gap-2 text-xs text-stone-500">
                            <span>{selectedCard === index ? 'Click to hide answer' : 'Click to show answer'}</span>
                            <svg 
                              className={`size-3 transition-transform ${selectedCard === index ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Empty State */}
            {!generating && flashcards.length === 0 && (
              <div className="rounded-2xl bg-stone-950/90 border border-zinc-900 p-12 text-center">
                <svg className="mx-auto size-16 text-stone-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-medium text-stone-300 mb-2">No flashcards yet</h3>
                <p className="text-sm text-stone-500">Upload a document and click "Generate Flashcards" to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
