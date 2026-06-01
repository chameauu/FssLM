import { AzureChatOpenAI, AzureOpenAIEmbeddings } from '@langchain/openai'
import { wrapChat } from './util'
import type { MkLLM, MkEmb, EmbeddingsLike } from './types'

export const makeLLM: MkLLM = (cfg: any) => {
  const m = new AzureChatOpenAI({
    model: cfg.azure_model || 'gpt-4',
    azureOpenAIApiKey: cfg.azure_api_key || process.env.AZURE_OPENAI_API_KEY,
    azureOpenAIApiInstanceName: cfg.azure_instance_name || process.env.AZURE_OPENAI_INSTANCE_NAME,
    azureOpenAIApiDeploymentName: cfg.azure_deployment_name || process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    azureOpenAIApiVersion: cfg.azure_api_version || process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
    temperature: cfg.temp ?? 0.7,
    maxTokens: cfg.max_tokens,
  })
  return wrapChat(m)
}

export const makeEmbeddings: MkEmb = (cfg: any): EmbeddingsLike => {
  return new AzureOpenAIEmbeddings({
    model: cfg.azure_embed_model || 'text-embedding-3-large',
    azureOpenAIApiKey: cfg.azure_api_key || process.env.AZURE_OPENAI_API_KEY,
    azureOpenAIApiInstanceName: cfg.azure_instance_name || process.env.AZURE_OPENAI_INSTANCE_NAME,
    azureOpenAIApiDeploymentName: cfg.azure_embed_deployment_name || process.env.AZURE_OPENAI_EMBED_DEPLOYMENT_NAME,
    azureOpenAIApiVersion: cfg.azure_api_version || process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
  })
}
