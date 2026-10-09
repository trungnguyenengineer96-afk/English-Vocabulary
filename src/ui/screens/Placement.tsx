import { useEffect, useMemo, useRef, useState } from 'react';
import { pickDistractors } from '../../core/distractors';
import {
  CEFR_INFO, CEFR_ORDER, GOALS, MAX_ITEMS, MINUTES, SELF_RATINGS, estimate, kindFor, pickItem, shouldStop, summarize,
} from '../../core/placement';
import { createRng, hashString, shuffle } from '../../core/rng';
import { answersMatch, blankOut } from '../../core/text';
import type { AnswerResult, LearnerLevel, PlacementAnswer, PlacementKind, PlacementResult, VocabEntry } from '../../core/types';
import { WORDS } from '../../data/words';
import { POS_VI, exampleForm, meaningText } from '../../modes/shared';
import { useStore } from '../../state/store';
import { useAudio } from '../audio';
import { AudioButton } from '../components/AudioButton';
import { confetti } from '../fx';
import { useNav } from '../nav';
import { useProfile } from '../profiles/ProfileContext';
import { playSfx } from '../sfx';

type Phase = 'intro' | 'survey' | 'test' | 'done' | 'skip';

interface Item {
  entry: VocabEntry;
  kind: PlacementKind;
  options?: { key: string; label: string }[];
  sentence?: string;
}

const KIND_LABEL: Record<PlacementKind, string> = {
  meaning: '🏹 Từ này nghĩa là gì?',
  context: '🧩 Chọn từ điền vào chỗ trống',
  listening: '🎧 Nghe và chọn nghĩa đúng',
  spelling: '✍️ Viết từ tiếng Anh có nghĩa là',
};

const CHEERS = ['Bạn đang làm rất tốt! 💪', 'Đi được nửa đường rồi! 🚀', 'Sắp xong rồi, cố lên! 🌟'];

export const PLACEMENT_ADVANCE_MS = 450;

function buildItem(entry: VocabEntry, kind: PlacementKind, rng: () => number): Item {
  if (kind === 'context' && entry.example) {
    const ds = pickDistractors(entry, WORDS, 3, rng, { samePos: true, filter: (e) => e.pos === entry.pos });
    return {
      entry,
      kind,
      sentence: blankOut(entry.example.en, exampleForm(entry)),
      options: shuffle([entry, ...ds], rng).map((e) => ({ key: e.id, label: e.word })),
    };
  }
  if (kind === 'spelling') return { entry, kind };
  const ds = pickDistractors(entry, WORDS, 3, rng, { samePos: true });
  return { entry, kind, options: shuffle([entry, ...ds], rng).map((e) => ({ key: e.id, label: meaningText(e) })) };
}

export function Placement() {
  const store = useStore();
  const { go } = useNav();
  const audio = useAudio();
  const profile = useProfile();
  const [phase, setPhase] = useState<Phase>('intro');
  const [survey, setSurvey] = useState({ goals: [] as string[], minutesPerDay: 10, selfRating: 1 });
  const [result, setResult] = useState<PlacementResult | null>(null);
  const retake = !!store.data.placement;

  return (
    <div className="placement" lang="vi">
      {phase === 'intro' && (
        <section className="card placement-intro">
          <div className="pi-hero" aria-hidden="true">🧭</div>
          <h1>{profile ? `Chào ${profile.profile.name}!` : 'Xin chào!'} Cùng khám phá trình độ của bạn</h1>
          <p>Bài kiểm tra ngắn (khoảng <strong>5 phút, tối đa {MAX_ITEMS} câu</strong>) tự điều chỉnh độ khó theo câu trả lời của bạn.
            Kết quả dùng để xây <strong>lộ trình học riêng</strong>: chọn từ mới vừa sức, đúng chủ đề bạn thích và ưu tiên kỹ năng cần luyện.</p>
          <ul className="pi-points">
            <li>🎯 Không có điểm đỗ/trượt. Chỉ để biết nên bắt đầu từ đâu.</li>
            <li>🤷 Không chắc? Hãy bấm <strong>“Tôi không biết”</strong>. Như vậy tốt hơn đoán mò.</li>
            <li>🔁 Có thể làm lại bất cứ lúc nào trong mục Lộ trình.</li>
          </ul>
          <div className="row center">
            <button type="button" className="btn primary big" autoFocus onClick={() => { playSfx('next'); setPhase('survey'); }}>
              Bắt đầu 🚀
            </button>
            <button type="button" className="btn ghost" onClick={() => (retake ? go('path') : setPhase('skip'))}>
              {retake ? 'Để sau' : 'Bỏ qua, tôi tự chọn trình độ'}
            </button>
          </div>
        </section>
      )}

      {phase === 'skip' && <SkipLevel onDone={(level) => { store.updateSettings({ level, autoLevel: false }); go('home'); }} />}

      {phase === 'survey' && (
        <Survey value={survey} onChange={setSurvey} onDone={() => { playSfx('next'); setPhase('test'); }} />
      )}

      {phase === 'test' && (
        <AdaptiveTest
          audioAvailable={audio.available}
          seed={hashString(`${profile?.profile.id ?? 'p'}|${store.now()}`)}
          prior={SELF_RATINGS[survey.selfRating].prior}
          onExit={() => go(retake ? 'path' : 'home')}
          onFinish={(answers) => {
            const r = summarize(answers, survey, store.now());
            store.completePlacement(r);
            setResult(r);
            setPhase('done');
          }}
        />
      )}

      {phase === 'done' && result && <PlacementResultView result={result} />}
    </div>
  );
}

function Survey({ value, onChange, onDone }: {
  value: { goals: string[]; minutesPerDay: number; selfRating: number };
  onChange: (v: { goals: string[]; minutesPerDay: number; selfRating: number }) => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const next = () => (step < 2 ? (playSfx('next'), setStep(step + 1)) : onDone());
  return (
    <section className="card survey" aria-labelledby="survey-q">
      <ol className="survey-steps" aria-label={`Bước ${step + 1} trên 3`}>
        {[0, 1, 2].map((i) => <li key={i} className={i <= step ? 'on' : ''} />)}
      </ol>
      {step === 0 && (
        <>
          <h2 id="survey-q">Bạn học tiếng Anh để làm gì? <span className="muted small">(chọn nhiều)</span></h2>
          <div className="choice-grid">
            {GOALS.map((g) => {
              const on = value.goals.includes(g.id);
              return (
                <button key={g.id} type="button" role="checkbox" aria-checked={on} className={`choice ${on ? 'active' : ''}`}
                  onClick={() => { playSfx('tap'); onChange({ ...value, goals: on ? value.goals.filter((x) => x !== g.id) : [...value.goals, g.id] }); }}>
                  <span className="choice-icon" aria-hidden="true">{g.icon}</span>{g.label}
                </button>
              );
            })}
          </div>
        </>
      )}
      {step === 1 && (
        <>
          <h2 id="survey-q">Mỗi ngày bạn có thể dành bao lâu?</h2>
          <div className="choice-grid">
            {MINUTES.map((m) => (
              <button key={m.minutes} type="button" role="radio" aria-checked={value.minutesPerDay === m.minutes}
                className={`choice ${value.minutesPerDay === m.minutes ? 'active' : ''}`}
                onClick={() => { playSfx('tap'); onChange({ ...value, minutesPerDay: m.minutes }); }}>
                <span className="choice-icon" aria-hidden="true">⏱️</span>{m.label}
                <span className="choice-sub">{m.goal} từ mới/ngày</span>
              </button>
            ))}
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <h2 id="survey-q">Bạn tự thấy vốn từ của mình thế nào?</h2>
          <div className="choice-grid">
            {SELF_RATINGS.map((r, i) => (
              <button key={r.label} type="button" role="radio" aria-checked={value.selfRating === i}
                className={`choice ${value.selfRating === i ? 'active' : ''}`}
                onClick={() => { playSfx('tap'); onChange({ ...value, selfRating: i }); }}>
                <span className="choice-icon" aria-hidden="true">{['🌱', '🌿', '🌳', '🚀'][i]}</span>{r.label}
              </button>
            ))}
          </div>
          <p className="muted small">Chỉ là điểm xuất phát. Kết quả cuối cùng dựa trên câu trả lời của bạn.</p>
        </>
      )}
      <div className="row center">
        {step > 0 && <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>← Quay lại</button>}
        <button type="button" className="btn primary big" onClick={next}>
          {step < 2 ? 'Tiếp tục →' : 'Vào bài kiểm tra 🎯'}
        </button>
      </div>
    </section>
  );
}

function AdaptiveTest({ audioAvailable, seed, prior, onExit, onFinish }: {
  audioAvailable: boolean;
  seed: number;
  prior: number;
  onExit: () => void;
  onFinish: (answers: PlacementAnswer[]) => void;
}) {
  const rng = useMemo(() => createRng(seed), [seed]);
  const used = useRef(new Set<string>());
  const [answers, setAnswers] = useState<PlacementAnswer[]>([]);
  const [noted, setNoted] = useState(false);
  const locked = useRef(false);

  const makeItem = (list: PlacementAnswer[]): Item | null => {
    const est = estimate(list, prior);
    let kind = kindFor(list.length, est.theta, audioAvailable);
    let entry = pickItem(WORDS, used.current, est.theta, kind, rng);
    if (!entry) {
      kind = 'meaning';
      entry = pickItem(WORDS, used.current, est.theta, kind, rng);
    }
    if (!entry) return null;
    used.current.add(entry.id);
    return buildItem(entry, kind, rng);
  };
  const [item, setItem] = useState<Item | null>(() => makeItem([]));

  const answer = (result: AnswerResult) => {
    if (!item || locked.current) return;
    locked.current = true;
    playSfx('tap');
    const list = [...answers, { vocabId: item.entry.id, difficulty: item.entry.difficulty, kind: item.kind, result }];
    setAnswers(list);
    setNoted(true);
    setTimeout(() => {
      const est = estimate(list, prior);
      const nextItem = shouldStop(list.length, est.se) ? null : makeItem(list);
      if (!nextItem) {
        onFinish(list);
        return;
      }
      playSfx('next');
      setItem(nextItem);
      setNoted(false);
      locked.current = false;
    }, PLACEMENT_ADVANCE_MS);
  };

  if (!item) return null;
  const n = answers.length;
  const cheer = n > 0 && n % 5 === 0 ? CHEERS[Math.min(CHEERS.length - 1, n / 5 - 1)] : null;
  return (
    <section className="card placement-test" aria-labelledby="pt-q">
      <div className="pt-head">
        <button type="button" className="btn ghost small" onClick={() => (n === 0 || confirm('Thoát bài kiểm tra? Kết quả sẽ không được lưu.')) && onExit()}>
          ✕ Thoát
        </button>
        <div className="pt-trail" role="progressbar" aria-valuemin={0} aria-valuemax={MAX_ITEMS} aria-valuenow={n} aria-label={`Đã trả lời ${n} câu, tối đa ${MAX_ITEMS}`}>
          <div className="pt-trail-fill" style={{ width: `${(n / MAX_ITEMS) * 100}%` }} />
          <span className="pt-walker" style={{ left: `${(n / MAX_ITEMS) * 100}%` }} aria-hidden="true">🧭</span>
        </div>
        <span className="muted small">Câu {n + 1}</span>
      </div>
      {cheer && !noted && <p className="pt-cheer" role="status">{cheer}</p>}
      <PlacementQuestion key={item.entry.id} item={item} disabled={noted} onAnswer={answer} />
      <div className="pt-foot">
        <span className={`pt-noted ${noted ? 'on' : ''}`} role="status">{noted ? 'Đã ghi nhận ✓' : ''}</span>
        <button type="button" className="btn ghost" disabled={noted} onClick={() => answer('unsure')}>🤷 Tôi không biết</button>
      </div>
    </section>
  );
}

function PlacementQuestion({ item, disabled, onAnswer }: { item: Item; disabled: boolean; onAnswer: (r: AnswerResult) => void }) {
  const audio = useAudio();
  const [chosen, setChosen] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const e = item.entry;
  useEffect(() => {
    if (item.kind === 'listening') void audio.speak(e.word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);
  useEffect(() => {
    if (!item.options || disabled) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement) return;
      const k = Number(ev.key);
      if (k >= 1 && k <= item.options!.length) pick(item.options![k - 1].key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const pick = (key: string) => {
    if (disabled || chosen) return;
    setChosen(key);
    onAnswer(key === e.id ? 'correct' : 'wrong');
  };
  const [before, after] = (item.sentence ?? '').split('_____');
  return (
    <div className="pt-question">
      <h2 id="pt-q" className="pt-label">{KIND_LABEL[item.kind]}</h2>
      {item.kind === 'meaning' && (
        <p className="big-word center" lang="en">
          {e.word}
          {audio.available && <AudioButton onPlay={(slow) => audio.speak(e.word, { slow })} label={`Nghe ${e.word}`} showSlow={false} />}
        </p>
      )}
      {item.kind === 'context' && (
        <p className="sentence" lang="en">{before}<span className="blank">{' '.repeat(8)}</span>{after}</p>
      )}
      {item.kind === 'listening' && (
        <div className="listen-stage"><AudioButton big onPlay={(slow) => audio.speak(e.word, { slow })} label="Nghe từ" /></div>
      )}
      {item.kind === 'spelling' ? (
        <form className="text-answer" onSubmit={(ev) => {
          ev.preventDefault();
          if (!typed.trim() || disabled) return;
          onAnswer(answersMatch(typed, e.word) ? 'correct' : 'wrong');
        }}>
          <p className="vi-meaning">{meaningText(e)} <span className="muted">({POS_VI[e.pos]})</span></p>
          <div className="text-answer-row">
            <label className="sr-only" htmlFor="pt-input">Từ tiếng Anh</label>
            <input id="pt-input" autoFocus value={typed} onChange={(ev) => setTyped(ev.target.value)} readOnly={disabled}
              autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="Gõ từ tiếng Anh" />
            <button type="submit" className="btn primary" disabled={disabled || !typed.trim()}>Xong</button>
          </div>
        </form>
      ) : (
        <div className="options cols-2" role="group" aria-label="Lựa chọn">
          {item.options!.map((o, i) => (
            <button key={o.key} type="button" className={`option ${chosen === o.key ? 'is-chosen picked' : ''}`}
              aria-disabled={disabled} onClick={() => pick(o.key)} lang={item.kind === 'context' ? 'en' : 'vi'}>
              <kbd aria-hidden="true">{i + 1}</kbd>
              <span className="option-label">{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const SKILL_VI = { reading: '📖 Đọc hiểu', listening: '🎧 Nghe', writing: '✏️ Viết' } as const;

export function PlacementResultView({ result }: { result: PlacementResult }) {
  const { go } = useNav();
  const { data } = useStore();
  const ref = useRef<HTMLElement>(null);
  const info = CEFR_INFO[result.cefr];
  const known = result.answers.filter((a) => a.result === 'correct').length;
  const minutes = MINUTES.find((m) => m.minutes === result.minutesPerDay);
  const goals = GOALS.filter((g) => result.goals.includes(g.id));
  const pos = Math.min(100, Math.max(0, ((result.theta - 0.5) / 5) * 100));
  const nextCefr = CEFR_ORDER[Math.min(4, CEFR_ORDER.indexOf(result.cefr) + 1)];
  useEffect(() => {
    playSfx('fanfare');
    confetti(ref.current, { count: 60, spread: 320 });
  }, []);
  return (
    <section className="card placement-result" ref={ref} aria-labelledby="pr-title">
      <p className="eyebrow">Kết quả bài kiểm tra</p>
      <div className="cefr-badge" aria-hidden="true"><span className="cefr-icon">{info.icon}</span><span className="cefr-code">{result.cefr}</span></div>
      <h1 id="pr-title">Trình độ của bạn: {result.cefr} · {info.vi}</h1>
      <p className="muted">{result.answers.length} câu · trả lời đúng {known} câu</p>

      <div className="cefr-scale" role="img" aria-label={`Vị trí trên thang A1 đến C1: ${result.cefr}`}>
        {CEFR_ORDER.map((c) => <span key={c} className={`cefr-seg ${c === result.cefr ? 'on' : ''}`}>{c}</span>)}
        <span className="cefr-marker" style={{ left: `${pos}%` }} aria-hidden="true">▼</span>
      </div>

      <h2>Kỹ năng</h2>
      <ul className="skill-bars">
        {(Object.keys(SKILL_VI) as (keyof typeof SKILL_VI)[]).map((k) => {
          const s = result.skills[k];
          if (!s.total) return null;
          const pct = Math.round((s.correct / s.total) * 100);
          return (
            <li key={k}>
              <span className="sb-name">{SKILL_VI[k]}{result.weakSkill === k && <span className="focus-chip">⭐ Ưu tiên luyện</span>}</span>
              <span className="sb-bar"><span style={{ width: `${pct}%` }} /></span>
              <span className="sb-val">{s.correct}/{s.total}</span>
            </li>
          );
        })}
      </ul>

      <h2>Lộ trình đề xuất cho bạn</h2>
      <ul className="reco">
        <li>📅 Mỗi ngày <strong>{data.settings.dailyGoal} từ mới</strong>{minutes ? ` (khoảng ${minutes.label})` : ''}, cộng với phần ôn tập đến hạn.</li>
        <li>🎯 Từ mới xoay quanh mức <strong>{result.cefr}</strong>, có thêm một ít từ khó hơn ({nextCefr}) để bạn tiến bộ.</li>
        {goals.length > 0 && <li>🧩 Ưu tiên chủ đề: {goals.map((g) => `${g.icon} ${g.label}`).join(', ')}.</li>}
        {result.weakSkill && <li>⭐ Bài ôn sẽ có nhiều dạng <strong>{SKILL_VI[result.weakSkill as keyof typeof SKILL_VI] ?? result.weakSkill}</strong> hơn.</li>}
        {known > 0 && <li>✅ {known} từ bạn đã biết được lưu vào thư viện và sẽ được ôn lại để xác nhận.</li>}
      </ul>

      <div className="row center">
        <button type="button" className="btn primary big" autoFocus onClick={() => { playSfx('next'); go('learn'); }}>🚀 Bắt đầu học</button>
        <button type="button" className="btn big" onClick={() => go('path')}>🗺️ Xem lộ trình</button>
      </div>
    </section>
  );
}

function SkipLevel({ onDone }: { onDone: (level: LearnerLevel) => void }) {
  const opts: { level: LearnerLevel; icon: string; label: string; sub: string }[] = [
    { level: 'beginner', icon: '🌱', label: 'Mới bắt đầu', sub: 'A1–A2' },
    { level: 'intermediate', icon: '🌳', label: 'Trung cấp', sub: 'A2–B2' },
    { level: 'advanced', icon: '🚀', label: 'Nâng cao', sub: 'B1–C1' },
  ];
  return (
    <section className="card survey">
      <h2>Chọn trình độ để bắt đầu</h2>
      <div className="choice-grid">
        {opts.map((o) => (
          <button key={o.level} type="button" className="choice" onClick={() => { playSfx('tap'); onDone(o.level); }}>
            <span className="choice-icon" aria-hidden="true">{o.icon}</span>{o.label}<span className="choice-sub">{o.sub}</span>
          </button>
        ))}
      </div>
      <p className="muted small">Bạn có thể làm bài kiểm tra đầu vào sau trong mục Lộ trình.</p>
    </section>
  );
}
