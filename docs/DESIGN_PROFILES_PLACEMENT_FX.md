# Thiết kế: Hồ sơ người học · Bài kiểm tra đầu vào · Lộ trình · Hiệu ứng

Mục tiêu: mỗi người học có trải nghiệm riêng, bắt đầu đúng trình độ, thấy rõ con đường phía trước và được khích lệ qua âm thanh và hình ảnh. Mọi phần vẫn tuân thủ nguyên tắc **ưu tiên ghi nhớ thật** (spaced repetition), không chạy theo điểm số.

---

## 1. Hồ sơ người học (chọn user mỗi lần mở app)

**Luồng:**
1. Mở app → màn hình **"Hôm nay ai học nào?"**. Thẻ lớn của mỗi người gồm avatar (emoji), tên, trình độ, XP và lần học gần nhất.
2. Bấm vào một thẻ để vào ứng dụng với dữ liệu riêng của người đó. Phím Enter mở người học gần nhất.
3. Thẻ **"+ Thêm người học"**: nhập tên, chọn avatar và màu, rồi chuyển sang **bài kiểm tra đầu vào**. Có thể bỏ qua và tự chọn trình độ.
4. Mỗi thẻ có menu **Đổi tên** / **Xoá** (cần xác nhận; dữ liệu đã xoá được giữ một bản sao lưu).
5. Trong app, chip avatar ở thanh trên cùng cho phép **đổi người học**.

**Dữ liệu (lưu cục bộ):**
- `vocabquest.profiles`: danh sách hồ sơ `{id, name, avatar, color, createdAt, lastUsedAt}` và `lastProfileId`.
- `vocabquest.state.<id>`: toàn bộ tiến độ của từng người (thư viện, lịch ôn, cài đặt, kết quả kiểm tra). Mỗi người hoàn toàn tách biệt.
- **Chuyển đổi an toàn:** dữ liệu của bản cũ (một người dùng) tự động trở thành hồ sơ "Người học 1". Bản gốc được sao lưu ở `vocabquest.backup.single-user` trước khi chuyển.

## 2. Bài kiểm tra đầu vào (Placement test)

### 2.1 Khảo sát nhanh (3 câu, ~20 giây)
| Câu hỏi | Dùng để |
|---|---|
| Mục tiêu học: Giao tiếp · Du lịch · Công việc · Học thuật/Thi cử · Sở thích (chọn nhiều) | Ưu tiên chủ đề từ mới phù hợp |
| Mỗi ngày học bao lâu: 5 · 10 · 20 · 30 phút | Số từ mới/ngày: 7 · 10 · 20 · 30 |
| Tự đánh giá vốn từ: Mới bắt đầu · Cơ bản · Khá · Tốt | Điểm xuất phát của bài test (không quyết định kết quả) |

### 2.2 Bài test thích ứng (adaptive), tối đa 20 câu, ~4–5 phút
- **Câu hỏi tự điều chỉnh độ khó:** trả lời đúng thì câu sau khó hơn, sai thì dễ hơn. Nhờ vậy người mới không bị "ngợp" và người giỏi không thấy chán.
- **Ước lượng năng lực θ (thang 1 = A1 … 5 = C1)** theo mô hình IRT 3 tham số rút gọn:
  `P(đúng) = c + (1 − c) · 1 / (1 + e^(−1.7·a·(θ − d)))`. Trong đó *d* là độ khó của từ và *c* là xác suất đoán mò (0.25 với câu 4 lựa chọn, 0 với câu tự gõ). Năng lực được tính bằng trung bình hậu nghiệm (EAP) trên lưới θ, với tiên nghiệm lấy từ phần tự đánh giá.
- **Nút "Tôi không biết"** được khuyến khích: bấm nút này không bị trừ điểm nặng hơn trả lời sai, và giúp tránh những lần đoán mò trúng làm kết quả cao hơn thực tế.
- **4 dạng câu**, đo 3 kỹ năng:
  - 🏹 Nghĩa của từ (đọc)
  - 🧩 Điền từ vào câu (đọc, từ B1)
  - 🎧 Nghe và chọn nghĩa (nghe)
  - ✍️ Nghe nghĩa, gõ từ (viết, 2 câu cuối)
- **Dừng sớm** khi đã đủ chắc chắn (từ câu 12, sai số chuẩn < 0.3) hoặc khi đủ 20 câu.
- **Không làm nản lòng:** trong lúc làm bài không hiện đúng/sai, chỉ hiện "Đã ghi nhận ✓", kèm thanh tiến trình kiểu hành trình và lời động viên.

### 2.3 Kết quả và áp dụng
- Huy hiệu trình độ: **A1 Khởi đầu · A2 Sơ cấp · B1 Trung cấp · B2 Trung cao cấp · C1 Nâng cao**, có thanh vị trí trên thang A1–C1.
- Điểm từng kỹ năng (Đọc / Nghe / Viết) và **kỹ năng cần ưu tiên**.
- Áp dụng tự động:
  1. **Độ khó từ mới mỗi ngày** xoay quanh mức θ + 0.4, tức "hơi cao hơn trình độ một chút" (i+1), theo phân phối chuông (σ = 0.8).
  2. **Chủ đề yêu thích** được ưu tiên ×1.8, nhưng không quá 30% mỗi ngày để tránh lệch chủ đề.
  3. **Số từ mới/ngày** lấy theo thời gian học.
  4. Những **từ trả lời đúng** trong bài test được thêm vào thư viện như "đã biết". Chúng sẽ được ôn lại để xác nhận, và không bị dạy lại như từ mới.
  5. **Bài ôn thích ứng ưu tiên dạng bài của kỹ năng yếu.**
- Có thể **làm lại bài test** bất cứ lúc nào (trong Lộ trình hoặc Cài đặt).

## 3. Lộ trình học (Path) và nhiệm vụ hôm nay
- **Bản đồ 5 chặng A1 → C1.** Mỗi chặng hiển thị số từ đã học / đã thuộc / tổng. Chặng hiện tại có biểu tượng 🧭, chặng đã chinh phục có cờ 🏁.
- **Điều kiện chinh phục chặng:** học ≥ 80% số từ của chặng và thuộc (Mastered) ≥ 40%.
- **Bài kiểm tra chặng (Checkpoint):** mỗi chặng có một bài test ngắn chỉ gồm từ của chặng đó, để kiểm tra một cách hợp lý.
- **Nhiệm vụ hôm nay** trên trang chủ, tự đánh dấu ✅ khi hoàn thành:
  1. Ôn các từ đến hạn
  2. Học X từ mới
  3. Chơi 1 trò luyện kỹ năng yếu (ví dụ 🎧 Nghe)
  4. (Tuỳ chọn) Thử thách tổng hợp

## 4. Âm thanh và hiệu ứng (sinh động, nhưng không gây xao nhãng)
**Âm thanh hiệu ứng** được tạo trực tiếp bằng Web Audio, nên không cần file và không vướng bản quyền:

| Sự kiện | Âm thanh |
|---|---|
| Chọn đáp án / chạm ô chữ | "tách" ngắn, nhẹ |
| Đúng | chuông 2 nốt đi lên |
| Sai / Tôi không biết | âm trầm nhẹ (không chói, không "phạt") |
| Combo ×3 / ×5 / ×10 | chuỗi nốt đi lên, cao dần theo combo |
| Next | tiếng "vút" nhẹ |
| Hoàn thành bài / lên cấp | đoạn nhạc chiến thắng ngắn |
| Mở khoá thành tích | tiếng lấp lánh |

**Hình ảnh:**
- Câu hỏi trượt vào khi bấm Next.
- Đáp án đúng phát sáng xanh và hiện "+10" bay lên; đáp án sai rung nhẹ.
- Thông báo "🔥 Combo ×5!" bật lên.
- Pháo giấy khi trả lời đúng (nhỏ), khi đạt ≥ 80% và khi có kết quả bài test (lớn).
- Linh vật **Cú Quest 🦉** bình luận bằng tiếng Việt: "Chính xác!", "Giỏi quá!", "Không sao, lần sau sẽ nhớ!".

**Tôn trọng người dùng:** có công tắc **Âm thanh hiệu ứng** và **thanh âm lượng** trong Cài đặt. Chế độ **Giảm chuyển động** tắt pháo giấy và các hoạt ảnh.

## 5. Kiểm thử
- **Đơn vị:** ước lượng θ (đúng hết → C1, sai hết → A1, xấp xỉ 50% quanh B1 → B1; "Tôi không biết" không bị phạt nặng hơn trả lời sai; người học mô phỏng được xếp đúng trình độ), chọn câu theo độ khó, quy tắc dừng, phân phối độ khó theo θ, ưu tiên chủ đề, chuyển đổi dữ liệu sang hồ sơ, tạo/xoá hồ sơ.
- **Giao diện và e2e:** chọn/tạo hồ sơ → khảo sát → làm bài test → kết quả → lộ trình; dữ liệu hai người tách biệt; mở lại app vẫn giữ nguyên.
