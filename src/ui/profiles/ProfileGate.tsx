import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AVATARS, COLORS, MAX_NAME, addProfile, deleteProfile, loadRegistry, profileDataKey, profileSummary, saveRegistry,
  touchProfile, updateProfile, type Profile, type ProfileRegistry,
} from '../../core/profiles';
import type { KeyValueStore } from '../../core/storage';
import { StoreProvider } from '../../state/store';
import { App } from '../App';
import type { Route } from '../nav';
import { relativeDayVi } from '../format';
import { playSfx } from '../sfx';
import { ProfileContext } from './ProfileContext';

interface Props {
  storage?: KeyValueStore;
  clock?: () => number;
  forceAudio?: boolean;
}

/**
 * Entry point: every time the app opens, the learner picks (or creates) a profile.
 * Each profile has its own, fully separate progress document.
 */
export function ProfileGate({ storage, clock, forceAudio }: Props) {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  const now = () => (clock ? clock() : Date.now());
  const [registry, setRegistry] = useState<ProfileRegistry>(() => (store ? loadRegistry(store, now()).registry : { version: 1, profiles: [] }));
  const [active, setActive] = useState<{ profile: Profile; route: Route } | null>(null);

  const persist = (r: ProfileRegistry) => {
    setRegistry(r);
    if (store) saveRegistry(store, r);
  };
  const open = (p: Profile, route: Route = 'home') => {
    playSfx('next');
    persist(touchProfile(registry, p.id, now()));
    setActive({ profile: p, route });
  };

  if (active && store) {
    const profile = registry.profiles.find((p) => p.id === active.profile.id) ?? active.profile;
    return (
      <ProfileContext.Provider value={{ profile, switchProfile: () => setActive(null) }}>
        <StoreProvider key={profile.id} storage={store} clock={clock} storageKey={profileDataKey(profile.id)}>
          <App forceAudio={forceAudio} initialRoute={active.route} />
        </StoreProvider>
      </ProfileContext.Provider>
    );
  }

  return (
    <ProfilePicker
      registry={registry}
      store={store}
      now={now}
      onOpen={(p) => open(p)}
      onCreate={(draft) => {
        const { registry: r, profile } = addProfile(registry, draft, now());
        persist(r);
        playSfx('fanfare');
        setRegistry(touchProfile(r, profile.id, now()));
        if (store) saveRegistry(store, touchProfile(r, profile.id, now()));
        setActive({ profile, route: 'placement' });
      }}
      onRename={(id, name) => persist(updateProfile(registry, id, { name }))}
      onDelete={(id) => store && persist(deleteProfile(store, registry, id, now()))}
    />
  );
}

interface PickerProps {
  registry: ProfileRegistry;
  store?: KeyValueStore;
  now: () => number;
  onOpen: (p: Profile) => void;
  onCreate: (p: Omit<Profile, 'id' | 'createdAt'>) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

function ProfilePicker({ registry, store, now, onOpen, onCreate, onRename, onDelete }: PickerProps) {
  const [creating, setCreating] = useState(registry.profiles.length === 0);
  const [menu, setMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const t = now();
  const ordered = useMemo(
    () => [...registry.profiles].sort((a, b) => (b.lastUsedAt ?? b.createdAt) - (a.lastUsedAt ?? a.createdAt)),
    [registry.profiles],
  );
  const last = ordered.find((p) => p.id === registry.lastProfileId) ?? ordered[0];

  useEffect(() => {
    if (creating || renaming || !last) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && document.activeElement === document.body) onOpen(last);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [creating, renaming, last, onOpen]);

  return (
    <div className="picker" lang="vi">
      <header className="picker-head">
        <span className="picker-logo" aria-hidden="true">🧭</span>
        <h1>Vocab Quest</h1>
        <p className="picker-sub">{registry.profiles.length ? 'Hôm nay ai học nào?' : 'Chào mừng! Hãy tạo hồ sơ học đầu tiên.'}</p>
      </header>

      {creating ? (
        <NewProfileForm
          canCancel={registry.profiles.length > 0}
          defaultName={`Người học ${registry.profiles.length + 1}`}
          onCancel={() => setCreating(false)}
          onCreate={onCreate}
        />
      ) : (
        <ul className="profile-grid" aria-label="Hồ sơ người học">
          {ordered.map((p) => {
            const sum = store ? profileSummary(store, p.id) : { words: 0, xp: 0, mastered: 0 };
            return (
              <li key={p.id} className="profile-card" style={{ ['--pc' as string]: p.color }}>
                {renaming === p.id ? (
                  <RenameForm initial={p.name} onDone={(name) => {
                    if (name) onRename(p.id, name);
                    setRenaming(null);
                  }} />
                ) : (
                  <button type="button" className="profile-open" onClick={() => onOpen(p)} autoFocus={p.id === last?.id}>
                    <span className="profile-avatar" aria-hidden="true">{p.avatar}</span>
                    <span className="profile-name">{p.name}</span>
                    <span className="profile-meta">
                      {sum.cefr ? <span className="cefr-chip">{sum.cefr}</span> : <span className="cefr-chip muted">Chưa kiểm tra</span>}
                      <span>{sum.words} từ · {sum.xp} XP</span>
                    </span>
                    <span className="profile-last">{p.lastUsedAt ? `Học ${relativeDayVi(p.lastUsedAt, t)}` : 'Chưa học lần nào'}</span>
                  </button>
                )}
                <button type="button" className="profile-menu-btn" aria-label={`Tuỳ chọn cho ${p.name}`} aria-expanded={menu === p.id}
                  onClick={() => setMenu(menu === p.id ? null : p.id)}>⋯</button>
                {menu === p.id && (
                  <div className="profile-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setRenaming(p.id); setMenu(null); }}>✏️ Đổi tên</button>
                    <button type="button" role="menuitem" className="danger" onClick={() => {
                      setMenu(null);
                      if (confirm(`Xoá hồ sơ “${p.name}” và toàn bộ tiến độ? (Một bản sao lưu vẫn được giữ trong trình duyệt.)`)) onDelete(p.id);
                    }}>🗑️ Xoá hồ sơ</button>
                  </div>
                )}
              </li>
            );
          })}
          <li className="profile-card add">
            <button type="button" className="profile-open" onClick={() => { playSfx('tap'); setCreating(true); }}>
              <span className="profile-avatar" aria-hidden="true">＋</span>
              <span className="profile-name">Thêm người học</span>
              <span className="profile-last">Mỗi người có lộ trình riêng</span>
            </button>
          </li>
        </ul>
      )}
      {!creating && last && <p className="picker-hint">Nhấn <kbd>Enter</kbd> để vào nhanh hồ sơ “{last.name}”.</p>}
    </div>
  );
}

function NewProfileForm({ canCancel, defaultName, onCancel, onCreate }: {
  canCancel: boolean;
  defaultName: string;
  onCancel: () => void;
  onCreate: (p: Omit<Profile, 'id' | 'createdAt'>) => void;
}) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  const [color, setColor] = useState(COLORS[0]);
  return (
    <form className="card new-profile" onSubmit={(e) => {
      e.preventDefault();
      onCreate({ name: name.trim() || defaultName, avatar, color });
    }}>
      <div className="new-profile-preview" style={{ ['--pc' as string]: color }} aria-hidden="true">{avatar}</div>
      <label className="field">
        Tên của bạn
        <input autoFocus value={name} maxLength={MAX_NAME} placeholder={defaultName} onChange={(e) => setName(e.target.value)} />
      </label>
      <fieldset>
        <legend>Chọn linh vật</legend>
        <div className="avatar-grid" role="radiogroup" aria-label="Linh vật">
          {AVATARS.map((a) => (
            <button key={a} type="button" role="radio" aria-checked={avatar === a} aria-label={`Linh vật ${a}`}
              className={`avatar-opt ${avatar === a ? 'active' : ''}`} onClick={() => { playSfx('tap'); setAvatar(a); }}>{a}</button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Màu yêu thích</legend>
        <div className="color-grid" role="radiogroup" aria-label="Màu">
          {COLORS.map((c, i) => (
            <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Màu ${i + 1}`}
              className={`color-opt ${color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => { playSfx('tap'); setColor(c); }} />
          ))}
        </div>
      </fieldset>
      <div className="row">
        {canCancel && <button type="button" className="btn ghost" onClick={onCancel}>Huỷ</button>}
        <button type="submit" className="btn primary big">Tạo hồ sơ & bắt đầu 🚀</button>
      </div>
    </form>
  );
}

function RenameForm({ initial, onDone }: { initial: string; onDone: (name: string) => void }) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.select(), []);
  return (
    <form className="rename-form" onSubmit={(e) => { e.preventDefault(); onDone(v.trim()); }}>
      <label className="sr-only" htmlFor="rename-input">Tên mới</label>
      <input id="rename-input" ref={ref} value={v} maxLength={MAX_NAME} onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onDone('')} />
      <button type="submit" className="btn small primary">Lưu</button>
    </form>
  );
}
