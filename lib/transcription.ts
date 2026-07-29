export async function transcribeAudio(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY er ikke konfigureret — kan ikke transskribere lyd');
  }

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: contentType }), filename);
  form.append('model', 'whisper-1');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Whisper-transskription fejlede (${res.status}): ${detail}`);
  }

  const data = await res.json() as { text: string };
  return data.text;
}
