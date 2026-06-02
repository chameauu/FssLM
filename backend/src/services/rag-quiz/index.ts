import Chunkies from '../../utils/database/chunkies';
import llm from '../../utils/llm/llm';
import { normalizeTopic } from '../../utils/text/normalize';

export type RagQuizItem = {
  id: number;
  question: string;
  options: string[];
  correct: number;
  hint: string;
  explanation: string;
  source?: string;
  page?: number;
};

export type RagQuizOptions = {
  topic: string;
  namespace: string;
  topK?: number;
  count?: number;
};

const QUIZ_SYSTEM_PROMPT = `
PRIMARY OBJECTIVE
Generate exactly 5 multiple-choice questions based on the provided document context.

OUTPUT CONTRACT
Return ONLY a JSON array with exactly 5 objects.
No markdown, no code fences, no prose outside the JSON.

SCHEMA
"id": 1..5 (sequential)
"question": plain English, 12..160 chars, unambiguous
"options": array of exactly 4 distinct strings; each 6..80 chars; 
           each prefixed with A) , B) , C) , D)  OR  1) , 2) , 3) , 4)
"correct": 1|2|3|4 (1-based index into options)
"hint": 6..120 chars, learning hint
"explanation": 12..200 chars, why answer is correct

REQUIREMENTS
- Questions must be based on provided context
- Options should be plausible but distinct
- Correct answer must be unambiguous
- Hints should guide without spoiling
- All strings must be trimmed and non-empty

STYLE
Plain text only. ASCII. No LaTeX. No extra keys or nesting.

VALIDATION
Exactly 5 items
Each item has all 6 keys
options length is exactly 4
correct in [1,2,3,4]
All strings non-empty and properly formatted
`;

class RagQuizService {
  private chunkies: Chunkies;

  constructor(chunkies: Chunkies) {
    this.chunkies = chunkies;
  }

  /**
   * Chunk text into semantic pieces for RAG
   */
  private chunkText(text: string, chunkSize: number = 512, overlap: number = 50): string[] {
    const chunks: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    let currentChunk = '';
    let currentSize = 0;

    for (const sentence of sentences) {
      const sentenceLength = sentence.trim().length;
      
      if (currentSize + sentenceLength > chunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          // Add overlap for continuity
          const overlapStart = Math.max(0, currentChunk.length - overlap);
          currentChunk = currentChunk.slice(overlapStart) + ' ' + sentence;
          currentSize = currentChunk.length;
        }
      } else {
        currentChunk += ' ' + sentence;
        currentSize += sentenceLength;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(chunk => chunk.length > 0);
  }

  /**
   * Validate and coerce quiz items to correct format
   */
  private validateAndCoerce(items: any[]): RagQuizItem[] {
    const result: RagQuizItem[] = [];

    for (let i = 0; i < Math.min(items.length, 5); i++) {
      const item = items[i] || {};
      
      const question = (item.question || `Question ${i + 1}`).substring(0, 160);
      const options = this.ensureOptionsFormat(item.options || []);
      const correct = this.ensureCorrectValue(item.correct);
      const hint = (item.hint || 'Review the material').substring(0, 120);
      const explanation = (item.explanation || 'Review the correct answer').substring(0, 200);

      result.push({
        id: i + 1,
        question,
        options,
        correct,
        hint,
        explanation
      });
    }

    // Fill missing items if less than 5
    while (result.length < 5) {
      const i = result.length;
      result.push({
        id: i + 1,
        question: `Question ${i + 1}`,
        options: ['A) Option 1', 'B) Option 2', 'C) Option 3', 'D) Option 4'],
        correct: 1,
        hint: 'Review the material',
        explanation: 'Review the correct answer'
      });
    }

    return result.slice(0, 5);
  }

  /**
   * Ensure options are properly formatted
   */
  private ensureOptionsFormat(options: any[]): string[] {
    if (!Array.isArray(options)) return ['A) Option 1', 'B) Option 2', 'C) Option 3', 'D) Option 4'];

    const cleaned = options
      .map(opt => {
        const text = String(opt || '').replace(/^\s*(?:[A-D]\)|[1-4]\))\s*/i, '').trim();
        return text || 'Option';
      })
      .filter((text, idx, arr) => arr.indexOf(text) === idx) // Deduplicate
      .slice(0, 4);

    // Pad to 4 if needed
    while (cleaned.length < 4) {
      cleaned.push(`Option ${cleaned.length + 1}`);
    }

    // Add prefix
    const useLetters = Math.random() > 0.5;
    return cleaned.map((text, idx) => 
      useLetters 
        ? `${String.fromCharCode(65 + idx)}) ${text}`
        : `${idx + 1}) ${text}`
    );
  }

  /**
   * Ensure correct answer is in valid range
   */
  private ensureCorrectValue(correct: any): number {
    if (typeof correct === 'number') {
      return correct < 1 ? 1 : correct > 4 ? 4 : correct;
    }

    const str = String(correct || '').toUpperCase().trim();
    
    // Match letter
    if (/^[A-D]/.test(str)) {
      return str.charCodeAt(0) - 64; // A=1, B=2, C=3, D=4
    }

    // Match number
    const match = str.match(/\d/);
    if (match) {
      const num = parseInt(match[0]);
      return num >= 1 && num <= 4 ? num : 1;
    }

    return 1;
  }

  /**
   * Generate RAG-based quiz from documents
   */
  async generateQuiz(options: RagQuizOptions): Promise<RagQuizItem[]> {
    const { topic, namespace, topK = 6, count = 5 } = options;
    const normalizedTopic = normalizeTopic(topic);

    try {
      // Step 1: Search vector database for relevant chunks
      console.log(`[RAG-Quiz] Searching for chunks about: ${topic}`);
      
      const searchResults = await this.chunkies.search(
        normalizedTopic,
        { namespace, topK, includeMetadata: true }
      );

      if (!searchResults || searchResults.length === 0) {
        console.warn(`[RAG-Quiz] No chunks found for: ${topic}`);
        return [];
      }

      // Step 2: Concatenate retrieved chunks as context
      const context = searchResults
        .map((result: any) => result.text || result.content || '')
        .filter((text: string) => text.length > 0)
        .join('\n\n');

      console.log(`[RAG-Quiz] Retrieved ${searchResults.length} chunks, total context: ${context.length} chars`);

      // Step 3: Call LLM with context and quiz prompt
      const userPrompt = `
Based on this document context, generate exactly 5 multiple-choice questions about "${topic}".

CONTEXT:
${context}

INSTRUCTIONS:
- All questions must be answerable from the provided context
- Options should be plausible and distinct
- Include one correct answer (1-4)
- Provide helpful hints
- Explain why the correct answer is right
- Return ONLY the JSON array, no markdown

Generate the quiz:
`;

      const llmResponse = await llm.invoke([
        { role: 'system', content: QUIZ_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ]);

      const responseText = typeof llmResponse === 'string' ? llmResponse : llmResponse?.content || '';

      // Step 4: Parse and validate JSON response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('[RAG-Quiz] No JSON array found in LLM response');
        return [];
      }

      const parsedItems = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(parsedItems)) {
        console.error('[RAG-Quiz] Response is not an array');
        return [];
      }

      // Step 5: Validate, coerce, and add source information
      const quiz = this.validateAndCoerce(parsedItems);
      
      // Add source metadata
      return quiz.map((item, idx) => ({
        ...item,
        source: searchResults[0]?.metadata?.source || `Document ${namespace}`,
        page: searchResults[0]?.metadata?.page || undefined
      }));

    } catch (error) {
      console.error('[RAG-Quiz] Error generating quiz:', error);
      throw new Error(`Failed to generate RAG-based quiz: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Index documents into vector database with chunking
   */
  async indexDocuments(
    documents: Array<{ text: string; metadata?: any }>,
    namespace: string,
    chunkSize: number = 512
  ): Promise<number> {
    let totalChunks = 0;

    for (const doc of documents) {
      const chunks = this.chunkText(doc.text, chunkSize);
      
      for (const chunk of chunks) {
        await this.chunkies.add(chunk, {
          namespace,
          metadata: {
            source: doc.metadata?.source || 'document',
            page: doc.metadata?.page,
            timestamp: Date.now()
          }
        });
        totalChunks++;
      }
    }

    console.log(`[RAG-Quiz] Indexed ${totalChunks} chunks for namespace: ${namespace}`);
    return totalChunks;
  }
}

export default RagQuizService;
