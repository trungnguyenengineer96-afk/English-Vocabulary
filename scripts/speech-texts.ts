// Lists every text the app can speak, for pre-rendering pronunciation audio.
// Usage: npx tsx scripts/speech-texts.ts > texts.json
import { WORDS } from '../src/data/words';
import { speechKey, TEST_PHRASE } from '../src/ui/speechKey';

const items = new Map<string, { text: string; kind: 'word' | 'sentence' }>();
const add = (text: string, kind: 'word' | 'sentence') => {
  const key = speechKey(text);
  if (key && !items.has(key)) items.set(key, { text: text.trim(), kind });
};
for (const w of WORDS) {
  add(w.word, 'word');
  for (const c of w.confusables ?? []) add(c, 'word');
  if (w.example) add(w.example.en, 'sentence');
}
add(TEST_PHRASE, 'sentence');
process.stdout.write(JSON.stringify([...items].map(([key, v]) => ({ key, ...v })), null, 1));
