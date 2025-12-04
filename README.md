## WhatsApp Reminder Bot

Profesional, ringan, dan siap pakai — bot pengingat harian untuk membantu kamu mencatat absensi/monev dan menutup laporan magang setiap hari melalui WhatsApp.

Repository ini berisi skrip Node.js sederhana yang menggunakan library WhatsApp (Baileys) untuk:
- Mengirim reminder harian jam 17:00 (check-in sore).
- Mengirim reminder kedua jam 21:00 jika belum ada tanda "SUDAH".
- Menerima balasan `SUDAH` dari pemilik bot (nomor kamu) untuk menandai laporan selesai.

## Ringkasan teknis (kontrak singkat)
- Input: variabel lingkungan `MY_NUMBER` (nomor pengguna dalam format internasional tanpa `+`), file kredensial di folder `auth_info/` dihasilkan saat login via QR.
- Output: pesan teks WhatsApp dikirim ke `MY_NUMBER` pada waktu yang ditentukan.
- Error modes: koneksi terputus (bot akan mencoba reconnect), kegagalan pengiriman pesan akan dicatat ke console.
- Success criteria: pesan reminder berhasil dikirim pada jadwal dan balasan `SUDAH` dari pemilik bot tercatat untuk mencegah reminder kedua.

## Isi utama
- `index.js` — skrip utama yang menjalankan bot dan menjadwalkan cron.
- `auth_info/` — folder yang menyimpan state autentikasi Baileys (di-commit ke disk saat login). Folder ini disertakan dalam `.gitignore`.
- `.gitignore` — mengabaikan `node_modules`, `auth_info/`, dan `.env`.

## Prasyarat
- Node.js 16+ (rekomendasi: 18 atau lebih baru)
- NPM (atau yarn)
- Koneksi internet stabil (untuk menjaga koneksi WhatsApp)

## Dependency utama
Proyek ini menggunakan:
- `@whiskeysockets/baileys` — WhatsApp Web API (unofficial)
- `node-cron` — untuk penjadwalan reminder
- `qrcode-terminal` — menampilkan QR di terminal
- `dotenv` — memuat variabel lingkungan dari `.env`

Jika `package.json` belum terisi, install dependency berikut:

```powershell
npm install @whiskeysockets/baileys node-cron qrcode-terminal dotenv
```

## Konfigurasi (file .env)
Buat file `.env` di root proyek (yang sudah di-.gitignore). Minimal isi:

```
MY_NUMBER=62xxxxxxxxxx
```

Gunakan format internasional tanpa tanda `+`. Contoh untuk nomor Indonesia: `62812xxxxxxx`.

## Menjalankan bot (Windows PowerShell)
1. Pastikan dependency sudah terinstall.
2. Jalankan:

```powershell
node index.js
```

Saat pertama kali menjalankan, terminal akan menampilkan QR. Scan QR tersebut menggunakan aplikasi WhatsApp di ponsel (Settings > Linked devices > Link a device). Setelah otentikasi berhasil, file kredensial akan tersimpan di folder `auth_info/`.

## Bagaimana bot bekerja (ringkas)
- Saat koneksi `open`, bot mengirimkan pesan pembuka ke nomor kamu.
- Pada jam 17:00 server, bot mengirim reminder check-in.
- Jika pada jam 21:00 user belum membalas `SUDAH` dan reminder 17:00 sudah dikirim, bot mengirim reminder kedua.
- Saat menerima pesan masuk dari nomor kamu dengan teks `SUDAH` (case-insensitive), bot mencatat tanggal tersebut sehingga reminder kedua tidak dikirim.

Catatan: jadwal cron menggunakan timezone server tempat proses Node berjalan. Jika server berada di timezone berbeda, sesuaikan cron atau jalankan container/server di timezone yang diinginkan.

## Kustomisasi cepat
- Ubah jam pengiriman: edit pola cron di `index.js` (baris dengan `cron.schedule("0 17 * * *"` dan `cron.schedule("0 21 * * *"`).
- Ubah teks pesan: edit variabel `message` di masing-masing handler cron.
- Kirim ke lebih dari satu nomor: modifikasi fungsi pengiriman untuk menerima array JID dan loop `sock.sendMessage(...)`.

## Keamanan & privasi
- `auth_info/` menyimpan kredensial sesi; jangan bagikan folder ini. Folder sudah ada di `.gitignore`.
- Jangan menyimpan token atau private keys di repository. Gunakan `.env` (juga di-.gitignore).

## Troubleshooting
- QR tidak muncul / QR expired: hentikan proses dan jalankan ulang `node index.js` untuk menghasilkan QR baru.
- Koneksi sering putus: periksa koneksi internet server, pastikan Node tidak dibatasi (mis. proses dihentikan oleh host).
- Error pengiriman pesan: periksa console untuk stacktrace. Kesalahan sementara akan dicatat; perbaikan biasanya melibatkan reconnect atau menunggu hingga WhatsApp memulihkan koneksi.

## Tips operasi
- Jalankan bot di proses yang diawasi (PM2, systemd, atau layanan container) agar otomatis restart saat crash.
- Backup folder `auth_info/` jika ingin memindahkan sesi ke server lain tanpa login ulang.

## Contoh alur kerja harian
1. Jam 17:00 bot mengirim: "Daily Check-in...".
2. Jika kamu sudah menyelesaikan aktivitas, balas `SUDAH` di chat tersebut.
3. Jika tidak ada balasan sampai 21:00, bot mengirim reminder kedua.

