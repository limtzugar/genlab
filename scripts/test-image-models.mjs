import ZAI from 'z-ai-web-dev-sdk'

const models = ['nano-banana-2', 'nano-banana', 'gpt-image-2', 'gpt-image-1', 'image-generation-v2', undefined]

const zai = await ZAI.create()

for (const model of models) {
  console.log(`\n=== model=${model} ===`)
  try {
    const body = { prompt: 'a tiny blue square on white background', size: '1024x1024' }
    if (model) body.model = model
    const r = await zai.images.generations.create(body)
    const b64 = r.data?.[0]?.base64 || ''
    console.log(`  ✓ Success: b64_len=${b64.length}`)
  } catch (e) {
    const msg = e.message || String(e)
    console.log(`  ✗ Error: ${msg.slice(0, 200)}`)
  }
}
