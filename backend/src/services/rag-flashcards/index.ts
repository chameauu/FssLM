import Chunkies from '../../utils/database/chunkies';
import llm from '../../utils/llm/llm';
import { normalizeTopic } from '../../utils/text/normalize';

export type RagFlashcard = {
  q: string;
  a: string;
  tags?: string[];
  source?: string;
  page?: number;
};

export type RagFlashcardOptions = {
  topic: string;
  namespace: string;
  topK?: number;
  count?: number;
};

const FLASHCARD_SYSTEM_PROMPT = `
You are an advanced educational AI that generates pedagogical flashcards from document context.

MISSION: Create 8-12 comprehensive flashcards that encourage deep understanding, not rote memorization.

OUTPUT FORMAT: Return ONLY valid JSON array
[
  {
    "q": "question text",
    "a": "answer text",
    "tags": ["cognitive_load", "transfer", "metacognition", "deep"]
  }
]

FLASHCARD TYPES TO INCLUDE:
1. Concept Cards - "WHY does this matter?"
2. Application Cards - "Given X situation, what would you do?"
3. Connection Cards - "How does X relate to Y?"
4. Troubleshooting Cards - "If you see symptom X, what's wrong?"
5. Metacognitive Cards - "How would you know you truly understand X?"
6. Story Cards - "Explain X as if telling a friend"

PEDAGOGICAL PRINCIPLES:
- ANTI-ROTE: Never ask for pure recall. Always require reasoning.
- Elaborative Interrogation: Include "why" and "how" questions
- Real-world Application: Connect to practical scenarios
- Cognitive Load Theory: Balance simplicity with depth
- Transfer Learning: Link to broader domains when possible

TAG SYSTEM:
- cognitive_load: Reduces mental burden
- transfer: Connects to other domains
- metacognition: Self-awareness of learning
- deep: Conceptual understanding
- surface: Essential facts
- troubleshoot: Diagnostic questions
- synthesis: Creative combinations
- anti_rote: Discourages memorization
- fun_factor: Entertaining examples
- curiosity: Sparks exploration

REQUIREMENTS:
- Exactly 8-12 cards
- Each card has q, a, tags
- No markdown in output, only JSON
- Questions 12-160 characters
- Answers 50-500 characters
`;

class RagFlashcardService {
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
          // Add overlap
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
   * Generate RAG-based flashcards from documents
   */
  async generateFlashcards(options: RagFlashcardOptions): Promise<RagFlashcard[]> {
    const { topic, namespace, topK = 6, count = 10 } = options;
    const normalizedTopic = normalizeTopic(topic);

    try {
      // Step 1: Search vector database for relevant chunks
      console.log(`[RAG-Flashcards] Searching for chunks about: ${topic}`);
      
      const searchResults = await this.chunkies.search(
        normalizedTopic,
        { namespace, topK, includeMetadata: true }
      );

      if (!searchResults || searchResults.length === 0) {
        console.warn(`[RAG-Flashcards] No chunks found for: ${topic}`);
        return [];
      }

      // Step 2: Concatenate retrieved chunks as context
      const context = searchResults
        .map((result: any) => result.text || result.content || '')
        .filter((text: string) => text.length > 0)
        .join('\n\n');

      console.log(`[RAG-Flashcards] Retrieved ${searchResults.length} chunks, total context: ${context.length} chars`);

      // Step 3: Call LLM with context and flashcard prompt
      const userPrompt = `
Based on this document context, generate ${count} pedagogical flashcards about "${topic}".

CONTEXT:
${context}

INSTRUCTIONS:
- Create flashcards that teach understanding, not memorization
- Include diverse question types
- Add appropriate tags to each card
- Ensure answers are grounded in the provided context
- Return ONLY the JSON array, no markdown or extra text

Generate the flashcards:
`;

      const llmResponse = await llm.invoke([
        { role: 'system', content: FLASHCARD_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ]);

      const responseText = typeof llmResponse === 'string' ? llmResponse : llmResponse?.content || '';

      // Step 4: Parse and validate JSON response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('[RAG-Flashcards] No JSON array found in LLM response');
        return [];
      }

      const parsedCards = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(parsedCards)) {
        console.error('[RAG-Flashcards] Response is not an array');
        return [];
      }

      // Step 5: Add source information and validate
      const flashcards: RagFlashcard[] = parsedCards
        .slice(0, count)
        .map((card: any, index: number) => ({
          q: (card.q || `Question ${index + 1}`).substring(0, 160),
          a: (card.a || 'Answer').substring(0, 500),
          tags: Array.isArray(card.tags) ? card.tags : [],
          source: searchResults[0]?.metadata?.source || `Document ${namespace}`,
          page: searchResults[0]?.metadata?.page || undefined
        }))
        .filter((card: RagFlashcard) => card.q && card.a);

      console.log(`[RAG-Flashcards] Generated ${flashcards.length} flashcards`);

      return flashcards;
    } catch (error) {
      console.error('[RAG-Flashcards] Error generating flashcards:', error);
      throw new Error(`Failed to generate RAG-based flashcards: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Index documents into vector database with Chonkie chunking
   */
  async indexDocuments(
    documents: Array<{ text: string; metadata?: any }>,
    namespace: string
  ): Promise<number> {
    let totalChunks = 0;

    for (const doc of documents) {
      // Use Chonkie for semantic chunking
      const chunks = await this.chunkies.chunkText(doc.text);
      
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

    console.log(`[RAG-Flashcards] Indexed ${totalChunks} chunks for namespace: ${namespace}`);
    return totalChunks;
  }
}

export default RagFlashcardService;
