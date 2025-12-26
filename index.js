require("dotenv").config();

const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");
const cron = require("node-cron");
const qrcode = require("qrcode-terminal");

let startupMessageSent = false;
const { DisconnectReason } = require("@whiskeysockets/baileys");


// 🔧 Helper: format tanggal "YYYY-MM-DD"
function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// State memory
let lastDoneDate = null;          // Tanggal terakhir kamu balas "SUDAH"
let lastPrimaryReminderDate = null; // Tanggal reminder jam 18:00 dikirim

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
  });

  // 📌 GANTI dengan nomor whatsapp, format internasional tanpa "+"
  // contoh: 62xxxxxxxxxx
  const myNumber = process.env.MY_NUMBER;
  const myJid = `${myNumber}@s.whatsapp.net`;

  // ====== HANDLE CONNECTION & QR ======
  sock.ev.on("connection.update", (update) => {
  const { connection, lastDisconnect, qr } = update;

  if (qr) {
    console.log("Scan QR ini dengan WhatsApp-mu:");
    qrcode.generate(qr, { small: true });
  }

  if (connection === "open") {
    console.log("✅ WhatsApp bot connected!");

      // Kirim pesan awal HANYA sekali per proses
    if (!startupMessageSent) {
      startupMessageSent = true;

      sock.sendMessage(myJid, {
        text:
          "✅ Bot pengingat magang aktif.\n" +
          "- Reminder 1: 17:00 WIB (check-in sore)\n" +
          "- Reminder 2: 21:00 WIB (final check-out, kalau belum balas *SUDAH*).",
      }).catch(console.error);
    }
  } else if (connection === "close") {
      console.log("❌ Connection closed");

      const shouldReconnect =
        (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log("🔁 Reconnecting...");
        startBot();
      } else {
        console.log("🚪 Logged out dari WhatsApp. Hapus folder auth_info dan scan QR lagi.");
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // ====== LISTENER UNTUK PESAN MASUK (CEK 'SUDAH') ======
  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages && m.messages[0];
    if (!msg) return;

    const isFromMe = msg.key.fromMe;

    // Ambil text dari berbagai tipe message
    let text = "";
    if (msg.message?.conversation) {
      text = msg.message.conversation;
    } else if (msg.message?.extendedTextMessage?.text) {
      text = msg.message.extendedTextMessage.text;
    }

    text = (text || "").trim();

    console.log("Message upsert:", { isFromMe, text });

    // Logika sederhana:
    // - isi "SUDAH"
    if (!isFromMe && text.toUpperCase() === "SUDAH") {
      const todayKey = getTodayKey();
      lastDoneDate = todayKey;
      console.log(`📌 Kamu balas "SUDAH" untuk tanggal ${todayKey}`);

      await sock
        .sendMessage(myJid, {
          text:
            "🔥 Mantap! Laporan magang hari ini sudah kamu tandai *SUDAH*.\nIstirahat yang cukup ya.",
        })
        .catch(console.error);
    }
  });


  // ====== CRON: REMINDER PERTAMA JAM 17:00 WIB ======
  // Format cron: "m h * * *"
  cron.schedule("0 17 * * *", async () => {
    const todayKey = getTodayKey();
    lastPrimaryReminderDate = todayKey;

    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const message = `
  🌅 *Daily Check-in Magang (Reminder 1)*

  📅 ${dateStr}

  Sebelum hari makin sibuk, cek dulu:
  • Sudah isi *absensi / Monev* hari ini?
  • Sudah tulis *uraian aktivitas* (≥ 100 karakter)?
  • Sudah catat *pembelajaran utama* hari ini?

  Luangkan 5–10 menit sekarang biar nggak numpuk nanti malam.
  Kalau semuanya sudah beres, balas chat ini dengan *SUDAH* ✅
      `.trim();

      await sock.sendMessage(myJid, { text: message });
      console.log("✅ Reminder pertama (17:00) terkirim");
    } catch (error) {
      console.error("Error sending first reminder:", error);
    }
  });


  // ====== CRON: REMINDER KEDUA JAM 21:00 WIB ======
  cron.schedule("0 21 * * *", async () => {
    const todayKey = getTodayKey();

    // Kirim reminder kedua hanya jika:
    // - Sudah pernah kirim reminder pertama hari ini
    // - Kamu belum balas "SUDAH" untuk hari ini
    const needSecondReminder =
      lastPrimaryReminderDate === todayKey && lastDoneDate !== todayKey;

    if (!needSecondReminder) {
      console.log(
        "ℹ️ Reminder kedua (21:00) tidak dikirim: sudah SUDAH atau belum ada reminder pertama."
      );
      return;
    }

    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const message = `
  🌙 *Night Check-out Magang (Reminder 2)*

  📅 ${dateStr}

  Hari sudah hampir selesai, tapi sistem masih menunggu:
  • Status *absensi / Monev* hari ini
  • *Laporan aktivitas* dan *pembelajaran* yang rapi

  Ini kesempatan terakhir hari ini buat nutup administrasi magang dengan tenang.
  Kalau semua sudah kamu selesaikan, balas pesan ini dengan *SUDAH* ✍️
      `.trim();

      await sock.sendMessage(myJid, { text: message });
      console.log("✅ Reminder kedua (21:00) terkirim");
    } catch (error) {
      console.error("Error sending second reminder:", error);
    }
  });

}

startBot();
