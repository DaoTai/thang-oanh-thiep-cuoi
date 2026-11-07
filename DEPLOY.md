# Deploy lên Cloudflare Workers

Trang là web tĩnh, nên deploy theo kiểu **Workers static assets**: Cloudflare phục vụ thư mục `public/` qua CDN và không chạy đoạn code server nào. Gói miễn phí là đủ.

## Các file liên quan

| File | Vai trò |
|---|---|
| `wrangler.jsonc` | Cấu hình Worker: tên `thang-oanh-wedding`, thư mục `public/` |
| `public/_headers` | Header cache cho ảnh, font, CSS/JS, và kiểu `text/calendar` cho file `.ics`. Cloudflare đọc file này nhưng không public nó |
| `public/.assetsignore` | Danh sách file **không** upload: ảnh gốc `assets/album/*.jpg` (8–11 MB mỗi ảnh, khoảng 108 MB tổng) và `album/thumbs/` cũ. Trang chỉ dùng `album/web/` |

Bạn không cần build gì trước khi deploy, và không cần chạy `npm install`. Lệnh `npx wrangler@4` tự tải wrangler vào cache của npm (nằm ngoài thư mục dự án).

Yêu cầu: Node.js 20 trở lên và một tài khoản Cloudflare (miễn phí).

## Cách 1: deploy từ máy (nhanh nhất)

```bash
npx wrangler@4 login     # chỉ lần đầu: mở trình duyệt để đăng nhập Cloudflare
npm run deploy           # = npx wrangler@4 deploy
```

Khi chạy xong, lệnh in ra địa chỉ dạng `https://thang-oanh-wedding.<tên-tài-khoản>.workers.dev`. Lần sau sửa nội dung, bạn chỉ cần chạy lại `npm run deploy`.

Muốn đổi phần đầu của địa chỉ thì sửa `"name"` trong `wrangler.jsonc` trước lần deploy đầu tiên.

## Cách 2: tự deploy mỗi lần push lên GitHub

1. Tạo repo trên GitHub và push code lên. Hiện thư mục này chưa phải git repo, mình có thể làm giúp nếu bạn muốn. Ảnh gốc 8–11 MB mỗi file vẫn dưới giới hạn 100 MB/file của GitHub, nhưng repo sẽ nặng khoảng 110 MB.
2. Vào Cloudflare Dashboard → **Workers & Pages** → **Create** → **Import a repository**, rồi chọn repo.
3. Cấu hình build:
   - Build command: *để trống*
   - Deploy command: `npx wrangler deploy`
   - Root directory: `/`
4. Bấm **Deploy**. Từ đó mỗi lần push lên nhánh chính, Cloudflare tự deploy lại.

## Gắn tên miền riêng (tuỳ chọn)

Bạn cần một tên miền đã thêm vào Cloudflare. Vào Worker `thang-oanh-wedding` → **Settings** → **Domains & Routes** → **Add** → **Custom domain**, rồi nhập ví dụ `thiepcuoi.ten-mien.vn`. Cloudflare tự cấp SSL.

## Việc cần làm sau lần deploy đầu

1. **Ảnh xem trước khi chia sẻ link (Zalo, Messenger, Facebook).** Mở `public/index.html` và sửa hai thẻ sau thành địa chỉ đầy đủ:
   ```html
   <meta property="og:url" content="https://DIA-CHI-CUA-BAN/" />
   <meta property="og:image" content="https://DIA-CHI-CUA-BAN/assets/og-cover.jpg" />
   ```
   Thẻ `og:url` chưa có trong file, bạn thêm vào ngay cạnh `og:image`. Sau đó deploy lại. Facebook giữ ảnh xem trước cũ trong cache, nên cần dán link vào [Sharing Debugger](https://developers.facebook.com/tools/debug/) và bấm "Scrape Again".
2. **Thử trên iPhone (Safari):** bật nhạc và bấm "Xác nhận tham dự" → "Lịch Apple". Safari phải mở được ứng dụng Lịch.
3. **Thay mã QR và số tài khoản** trong Hộp mừng cưới. Dữ liệu hiện tại là dữ liệu mẫu, xem `CLAUDE.md`.

## Cache: lưu ý khi thay ảnh

`public/_headers` cho trình duyệt của khách giữ ảnh, font và icon trong **1 tuần**, còn CSS/JS trong **1 giờ**.

- Sửa chữ trong `index.html`: khách thấy ngay, vì HTML không bị cache lâu.
- Sửa CSS/JS: khách thấy sau tối đa 1 giờ.
- Thay một ảnh nhưng **giữ nguyên tên file**: khách đã mở trang trước đó có thể vẫn thấy ảnh cũ tới 1 tuần. Muốn khách thấy ngay thì đặt tên mới cho ảnh gốc, chạy `npm run assets -- photos`, rồi sửa tên trong `index.html`.

## Chạy thử trên máy giống môi trường Cloudflare

```bash
npm run dev              # = npx wrangler@4 dev --port 5173  →  http://localhost:5173
```

Lệnh này áp dụng cả `_headers` và `.assetsignore`, nên ảnh gốc trả về 404 giống như khi đã deploy. Nếu không muốn dùng wrangler, có thể chạy `python -m http.server 5173 -d public`, nhưng cách này bỏ qua hai file cấu hình trên.

## Khi nào cần `npm install`

Chỉ khi bạn muốn tạo lại ảnh, icon, font hoặc file lịch bằng `npm run assets`, ví dụ khi thêm ảnh, đổi icon, đổi font, hoặc đổi giờ và địa điểm trong `public/js/config.js`. Chạy xong có thể xoá `node_modules` đi; trang và việc deploy không cần đến nó.

## Sổ lưu bút dùng chung

Cloudflare chỉ phục vụ file tĩnh, nên muốn khách thấy lời chúc của nhau vẫn cần một nơi lưu dữ liệu. Hiện tại cách đơn giản nhất là Google Apps Script, xem `scripts/wishes-apps-script.gs` và `CONFIG.wishesEndpoint`. Một hướng khác là viết thêm một Worker nhỏ dùng Cloudflare D1 hoặc KV, chạy cùng tên miền với trang. Hướng này chưa được làm sẵn.
