import * as ollama from './ollama'
import * as gemini from './gemini'
import * as openai from './openai'
import * as grok from './grok'
import * as claude from './claude'
import * as openrouter from './openrouter'
import * as minimax from './minimax'
import * as azure from './azure'
import { config } from '../../../config/env'
import type { EmbeddingsLike, LLM } from './types'

type Pair = { llm: LLM; embeddings: EmbeddingsLike }

function pick(p: string) {
  switch (p) {
    case 'ollama': return ollama
    case 'gemini': return gemini
    case 'openai': return openai
    case 'grok': return grok
    case 'claude': return claude
    case 'openrouter': return openrouter
    case 'minimax': return minimax
    case 'azure': return azure
    default: return gemini
  }
}

export function makeModels(): Pair {
  const mod = pick(config.provider)
  const llm = mod.makeLLM(config)

  let embeddings: EmbeddingsLike
  // Use embeddings_provider if explicitly set, otherwise try current provider
  if (config.embeddings_provider && config.embeddings_provider !== config.provider) {
    const d = pick(config.embeddings_provider)
    embeddings = d.makeEmbeddings(config)
  } else {
    try {
      embeddings = mod.makeEmbeddings(config)
    } catch {
      const d = pick(config.embeddings_provider || 'openai')
      embeddings = d.makeEmbeddings(config)
    }
  }

  return { llm, embeddings }
}