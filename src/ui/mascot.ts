// "Cú Quest" — the owl mascot's short Vietnamese reactions.

export const MASCOT = '🦉';

const LINES = {
  correct: ['Chính xác!', 'Giỏi quá!', 'Tuyệt vời!', 'Quá đỉnh!', 'Đúng rồi, nhớ lâu nhé!', 'Xuất sắc!'],
  combo: ['Đang vào phong độ!', 'Không thể cản nổi!', 'Chuỗi đúng tuyệt vời!'],
  wrong: ['Không sao, lần sau sẽ nhớ!', 'Sắp được rồi!', 'Sai để nhớ lâu hơn!', 'Cố lên, mình ôn lại từ này nhé!'],
  unsure: ['Biết mình chưa biết là bước đầu để nhớ!', 'Từ này sẽ quay lại sớm để bạn ôn.', 'Trung thực là tốt nhất!'],
  mixed: ['Có đúng có sai, cứ thế tiến bộ!', 'Một bước nữa thôi!'],
} as const;

export type MascotMood = keyof typeof LINES;

/** Deterministic pick so the same question shows the same line (stable for tests). */
export function mascotLine(mood: MascotMood, seed: number): string {
  const list = LINES[mood];
  return list[Math.abs(seed) % list.length];
}
