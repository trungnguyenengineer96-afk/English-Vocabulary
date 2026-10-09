"""Pre-render pronunciation audio with Piper (offline neural TTS).

Usage:
  python scripts/render-audio.py texts.json path/to/en-us-lessac-medium.onnx

Writes public/audio/<hash>.mp3 and src/data/audio-manifest.json ({key: file}).
Existing clips are reused, so re-running only renders new texts.
"""
import hashlib, json, os, subprocess, sys, tempfile, wave

from piper import PiperVoice, SynthesisConfig

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "audio")
MANIFEST = os.path.join(ROOT, "src", "data", "audio-manifest.json")


def main(texts_path: str, model: str) -> None:
    items = json.load(open(texts_path, encoding="utf-8"))
    os.makedirs(OUT_DIR, exist_ok=True)
    voice = PiperVoice.load(model)
    manifest = {}
    for i, it in enumerate(items):
        name = hashlib.sha1(it["key"].encode("utf-8")).hexdigest()[:12] + ".mp3"
        dest = os.path.join(OUT_DIR, name)
        manifest[it["key"]] = name
        if os.path.exists(dest):
            continue
        # Single words: a final period gives natural falling intonation; speak a little slower.
        is_word = it["kind"] == "word"
        text = it["text"] + "." if is_word else it["text"]
        cfg = SynthesisConfig(length_scale=1.15 if is_word else 1.0)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            wav_path = tmp.name
        with wave.open(wav_path, "wb") as wf:
            voice.synthesize_wav(text, wf, syn_config=cfg)
        subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-y", "-i", wav_path,
             "-af", "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,apad=pad_dur=0.08",
             "-ac", "1", "-ar", "22050", "-b:a", "48k", dest],
            check=True,
        )
        os.unlink(wav_path)
        if (i + 1) % 50 == 0:
            print(f"{i + 1}/{len(items)}", flush=True)
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(manifest.items())), f, ensure_ascii=False, indent=0)
        f.write("\n")
    # Remove clips that are no longer referenced.
    keep = set(manifest.values())
    for fn in os.listdir(OUT_DIR):
        if fn.endswith(".mp3") and fn not in keep:
            os.unlink(os.path.join(OUT_DIR, fn))
    print(f"{len(manifest)} clips in {OUT_DIR}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
