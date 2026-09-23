"""Generate approved Russian narration and real sentence timestamps."""
import asyncio, json
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parent.parent
request = json.loads((ROOT / 'voice-request.json').read_text(encoding='utf-8'))

async def main():
    semaphore = asyncio.Semaphore(3)
    async def line(item):
        async with semaphore:
            audio = ROOT / 'assets' / 'voice' / (item['id'] + '.mp3')
            timing = audio.with_suffix('.json')
            if audio.exists() and timing.exists():
                print('reuse', item['id'], flush=True)
                return
            stream = edge_tts.Communicate(item['text'], request['voice'], rate=request['rate'], boundary='SentenceBoundary')
            timestamps = []
            with audio.open('wb') as target:
                async for chunk in stream.stream():
                    if chunk['type'] == 'audio': target.write(chunk['data'])
                    elif chunk['type'] in ('SentenceBoundary', 'WordBoundary'):
                        timestamps.append({k:chunk[k] for k in ('type','offset','duration','text')})
            timing.write_text(json.dumps(timestamps, ensure_ascii=False, indent=2), encoding='utf-8')
            print('generated', item['id'], flush=True)
    await asyncio.gather(*(line(item) for item in request['lines']))

asyncio.run(main())
