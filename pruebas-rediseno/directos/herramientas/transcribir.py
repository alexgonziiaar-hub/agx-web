# Transcribe los clips (español) con Whisper turbo (sherpa-onnx) + detector de voz. Uso: python3 -I transcribir.py <carpeta clips> <carpeta salida> [filtro]
import sys, os, json, subprocess, time
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(B, 'voz', 'py'))
import numpy as np, sherpa_onnx
src, out = sys.argv[1], sys.argv[2]; filtro = sys.argv[3] if len(sys.argv) > 3 else ''
os.makedirs(out, exist_ok=True)
M = os.path.join(B, 'voz', 'modelos', 'sherpa-onnx-whisper-turbo')
rec = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=os.path.join(M, 'turbo-encoder.int8.onnx'), decoder=os.path.join(M, 'turbo-decoder.int8.onnx'), tokens=os.path.join(M, 'turbo-tokens.txt'), language='es', task='transcribe', num_threads=4)
cfg = sherpa_onnx.VadModelConfig(); cfg.silero_vad.model = os.path.join(B, 'voz', 'modelos', 'silero_vad.onnx')
cfg.silero_vad.threshold = 0.4; cfg.silero_vad.min_silence_duration = 0.35; cfg.silero_vad.min_speech_duration = 0.25; cfg.silero_vad.max_speech_duration = 22; cfg.sample_rate = 16000
for f in sorted(os.listdir(src)):
    if not f.endswith('.mp4') or filtro not in f: continue
    dst = os.path.join(out, f[:-4] + '.json')
    if os.path.exists(dst): continue
    t0 = time.time()
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(src, f), '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(pcm, dtype=np.float32)
    vad = sherpa_onnx.VoiceActivityDetector(cfg, buffer_size_in_seconds=200)
    w = cfg.silero_vad.window_size; segs = []
    def saca():
        while not vad.empty():
            s = vad.front; segs.append((s.start / 16000, np.array(s.samples, dtype=np.float32))); vad.pop()
    for i in range(0, len(x) - w + 1, w):
        vad.accept_waveform(x[i:i + w]); saca()
    vad.flush(); saca()
    partes = []
    for ini, s in segs:
        st = rec.create_stream(); st.accept_waveform(16000, s); rec.decode_stream(st)
        t = st.result.text.strip()
        if t: partes.append({'t': round(ini, 1), 'texto': t})
    json.dump({'archivo': f, 'seg': round(len(x) / 16000, 1), 'partes': partes, 'texto': ' '.join(p['texto'] for p in partes)}, open(dst, 'w'), ensure_ascii=False, indent=1)
    print(f"{f[:44]:44s} {len(x)/16000:5.0f} s de audio · {len(partes):2d} tramos · {time.time()-t0:5.1f} s", flush=True)
print('FIN')
