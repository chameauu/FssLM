import path from 'path'
import { config } from './src/config/env'
import { makeModels } from './src/utils/llm/models'

async function testConnection() {
  console.log('\n=== LLM Connection Test ===\n')
  console.log(`Provider: ${config.provider}`)
  console.log(`LLM Model: ${config[config.provider + '_model'] || config[config.provider]?.model || 'N/A'}`)
  console.log(`Embedding Provider: ${config.embeddings_provider}`)
  console.log()

  try {
    console.log('Initializing LLM models...')
    const { llm, embeddings } = makeModels()
    console.log('✓ Models initialized successfully')

    console.log('\nTesting LLM connection...')
    const response = await llm.invoke([{ role: 'user', content: 'Say "Hello from FssLM" in one sentence.' }])
    console.log('✓ LLM Response:', response.content)

    console.log('\nTesting Embeddings connection...')
    const embeddingResult = await embeddings.embedQuery('test')
    console.log('✓ Embeddings working - dimension:', embeddingResult.length)

    console.log('\n✓ All connections successful!')
    process.exit(0)
  } catch (error: any) {
    console.error('\n✗ Connection Error:')
    console.error('Message:', error.message)
    console.error('Details:', error)
    process.exit(1)
  }
}

testConnection()
