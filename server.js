// Gerekli kütüphaneleri çağırıyoruz
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

// Sunucu uygulamamızı başlatıyoruz
const app = express();
const PORT = 3000;

// Middleware (Ara katman) ayarları
app.use(cors()); // Güvenlik engelini aşmak için
app.use(express.json()); // Gelen verileri JSON formatında okuyabilmek için

// 1. Veritabanına Bağlanma
// Senin oluşturduğun vakitly.db dosyasına bağlanıyoruz
const db = new sqlite3.Database('./vakitly.db', (err) => {
    if (err) {
        console.error('Veritabanı bağlantı hatası:', err.message);
    } else {
        console.log('vakitly.db veritabanına başarıyla bağlanıldı.');
    }
});

// 2. İlk API'miz: İşletme Ekleme (POST İsteği)
// Arayüzden bu adrese veri gönderildiğinde bu kod çalışacak
app.post('/api/isletme-ekle', (req, res) => {
    // Arayüzden (Frontend) gelen verileri alıyoruz
    const { ad, kategori, adres, telefon, acilis_saati, kapanis_saati, personel_sayisi } = req.body;

    // Veritabanına veri eklemek için SQL komutumuz
    // Soru işaretleri (?), güvenlik için verileri sonradan eşleştireceğimiz yerlerdir
    const sql = `INSERT INTO isletmeler (ad, kategori, adres, telefon, acilis_saati, kapanis_saati, personel_sayisi) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;

    // Verileri sırasıyla SQL komutuna yerleştirip çalıştırıyoruz
    db.run(sql, [ad, kategori, adres, telefon, acilis_saati, kapanis_saati, personel_sayisi], function (err) {
        if (err) {
            console.error("İşletme eklenirken hata:", err.message);
            // Hata olursa arayüze 500 (Sunucu Hatası) koduyla mesaj gönderiyoruz
            return res.status(500).json({ hata: "İşletme kaydedilemedi." });
        }

        // Başarılı olursa arayüze başarı mesajı ve yeni işletmenin ID'sini gönderiyoruz
        // 'this.lastID' SQLite'ın otomatik oluşturduğu yeni id numarasıdır
        res.status(201).json({
            mesaj: "İşletme başarıyla eklendi!",
            isletmeId: this.lastID
        });
    });
});

// Sunucuyu dinlemeye başlıyoruz
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
});