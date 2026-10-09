import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { KeyValueStore } from '../core/storage';
import { STORAGE_KEY } from '../core/storage';
import { StoreProvider } from '../state/store';
import { App } from './App';

class MemStore implements KeyValueStore {
  map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
}

const NOW = new Date(2026, 6, 1, 9).getTime();

function mount(store: MemStore) {
  return render(
    <StoreProvider storage={store} clock={() => NOW}>
      <App forceAudio={false} />
    </StoreProvider>,
  );
}

describe('App end-to-end loop (jsdom)', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('learn → persist → review → results → dashboard metrics', async () => {
    const user = userEvent.setup();
    const store = new MemStore();
    const { unmount } = mount(store);

    await user.click(screen.getByRole('button', { name: 'Start learning' }));
    await user.click(screen.getByRole('radio', { name: '7' }));
    for (let i = 0; i < 7; i++) await user.click(screen.getByRole('button', { name: /Got it|Next →/ }));
    expect(screen.getByText(/Daily goal complete/)).toBeInTheDocument();

    const saved = JSON.parse(store.getItem(STORAGE_KEY)!);
    expect(Object.keys(saved.library)).toHaveLength(7);
    unmount();

    // Reload on the home route: progress is still there.
    window.location.hash = '#/home';
    mount(store);
    expect(screen.getByLabelText('7 of 7 new words learned today')).toBeInTheDocument();
    expect(screen.getByLabelText('7 words due for review')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start adaptive review' }));
    for (let i = 0; i < 7; i++) {
      await user.click(screen.getByRole('button', { name: /I don't know/ }));
      await user.click(screen.getByRole('button', { name: /^(Next|See results)/ }));
    }
    expect(screen.getByText('Session accuracy', { selector: '.metric-label' })).toBeInTheDocument();
    expect(screen.getByText('0/7 correct')).toBeInTheDocument();
    expect(screen.getByText('7/7 answered')).toBeInTheDocument();
    const weak = screen.getByRole('heading', { name: /Newly identified weaknesses/ }).closest('section')!;
    expect(within(weak).getAllByRole('listitem')).toHaveLength(7);

    await user.click(screen.getByRole('button', { name: /Back to dashboard/ }));
    expect(screen.getByText('0/7 saved words mastered')).toBeInTheDocument();
    const after = JSON.parse(store.getItem(STORAGE_KEY)!);
    expect(after.sessions).toHaveLength(1);
    expect(Object.values(after.library).every((i: any) => i.unsureCount === 1)).toBe(true);
  });

  it('a correct multiple-choice answer via keyboard scores and shows feedback', async () => {
    const user = userEvent.setup();
    const store = new MemStore();
    mount(store);
    await user.click(screen.getByRole('button', { name: /Library/ }));
    await user.click(screen.getByRole('button', { name: /Browse word bank/ }));
    await user.click(screen.getByRole('button', { name: 'Add apple' }));
    await user.click(screen.getByRole('button', { name: /Play/ }));
    await user.click(screen.getByRole('button', { name: /Meaning Hunter/ }));
    const options = screen.getAllByRole('button').filter((b) => b.classList.contains('option'));
    const idx = options.findIndex((o) => o.textContent?.includes('quả táo'));
    await user.keyboard(String(idx + 1));
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText('+10')).toBeInTheDocument();
  });
});
