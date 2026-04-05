const express = require('express');
const cors    = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

const app  = express();
const PORT = 3000;

// ══════════════════════════════════════════════════════════
//  MIDDLEWARE
// ══════════════════════════════════════════════════════════
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ══════════════════════════════════════════════════════════
//  VERİTABANI BAĞLANTISI
// ══════════════════════════════════════════════════════════
const db = new sqlite3.Database('./vakitly.db', (err) => {
    if (err) {
        console.error('❌ Veritabanı bağlantı hatası:', err.message);
        process.exit(1);                     // DB yoksa sunucuyu durdur
    }
    console.log('✅ vakitly.db veritabanına bağlandı.');
    db.run('PRAGMA foreign_keys = ON');      // FK kısıtlamalarını etkinleştir
    initDB();
});

// ══════════════════════════════════════════════════════════
//  TABLO OLUŞTURMA
// ══════════════════════════════════════════════════════════
function initDB() {
    db.serialize(() => {

        // ── İşletmeler tablosu ──────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS isletmeler (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                ad                  TEXT    NOT NULL,
                kategori            TEXT    NOT NULL,
                adres               TEXT    NOT NULL,
                telefon             TEXT    NOT NULL UNIQUE,
                email               TEXT,
                acilis_saati        TEXT    NOT NULL,
                kapanis_saati       TEXT    NOT NULL,
                mola_baslangic      TEXT,
                mola_bitis          TEXT,
                calisma_gunleri     TEXT    NOT NULL DEFAULT 'pzt,sal,car,per,cum',
                personel_sayisi     INTEGER NOT NULL DEFAULT 1,
                randevu_suresi      INTEGER NOT NULL DEFAULT 30,
                max_gunluk_randevu  INTEGER          DEFAULT 8,
                olusturma_tarihi    TEXT             DEFAULT (datetime('now','localtime'))
            )
        `, (err) => {
            if (err) console.error('❌ isletmeler tablo hatası:', err.message);
            else     console.log('📋 isletmeler tablosu hazır.');
        });

        // ── Randevular tablosu ──────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS randevular (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                isletme_id       INTEGER NOT NULL,
                musteri_ad       TEXT    NOT NULL,
                musteri_telefon  TEXT    NOT NULL,
                randevu_tarihi   TEXT    NOT NULL,
                randevu_saati    TEXT    NOT NULL,
                durum            TEXT    NOT NULL DEFAULT 'bekliyor',
                olusturma_tarihi TEXT             DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (isletme_id) REFERENCES isletmeler(id) ON DELETE CASCADE
            )
        `, (err) => {
            if (err) console.error('❌ randevular tablo hatası:', err.message);
            else     console.log('📅 randevular tablosu hazır.');
        });
    });
}

// ══════════════════════════════════════════════════════════
//  YARDIMCI: DOĞRULAMA FONKSİYONLARI
// ══════════════════════════════════════════════════════════

/** Saat formatı kontrolü — "HH:MM" */
function gecerliSaat(deger) {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(deger);
}

/** Dakika cinsinden saat farkı */
function saatFarki(acilis, kapanis) {
    const [ah, am] = acilis.split(':').map(Number);
    const [kh, km] = kapanis.split(':').map(Number);
    return (kh * 60 + km) - (ah * 60 + am);
}

/** Telefon numarası — sadece rakam, boşluk, +, -, () içerebilir; en az 10 rakam */
function gecerliTelefon(tel) {
    const sadeceSayi = tel.replace(/[\s\-\+\(\)]/g, '');
    return /^\d{10,15}$/.test(sadeceSayi);
}

/** E-posta basit kontrol */
function gecerliEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Geçerli randevu süreleri (dakika) */
const GECERLI_SURELER = [15, 30, 45, 60, 90, 120];

/** Geçerli günler */
const GECERLI_GUNLER = ['pzt', 'sal', 'car', 'per', 'cum', 'cmt', 'paz'];

/**
 * İşletme verisini doğrular.
 * @returns {string[]} Hata mesajları dizisi — boşsa veri geçerli
 */
function dogrulaIsletme(veri) {
    const hatalar = [];

    // ── Zorunlu metin alanları ──────────────────────────
    if (!veri.ad || veri.ad.trim().length < 2)
        hatalar.push('İşletme adı en az 2 karakter olmalıdır.');

    if (!veri.kategori)
        hatalar.push('Kategori seçimi zorunludur.');

    if (!veri.adres || veri.adres.trim().length < 10)
        hatalar.push('Adres en az 10 karakter olmalıdır.');

    // ── Telefon ─────────────────────────────────────────
    if (!veri.telefon) {
        hatalar.push('Telefon numarası zorunludur.');
    } else if (!gecerliTelefon(veri.telefon)) {
        hatalar.push('Geçerli bir telefon numarası giriniz (en az 10 rakam).');
    }

    // ── E-posta (opsiyonel ama girilmişse geçerli olmalı) ─
    if (veri.email && !gecerliEmail(veri.email))
        hatalar.push('Geçerli bir e-posta adresi giriniz.');

    // ── Çalışma saatleri ────────────────────────────────
    if (!veri.acilis_saati || !gecerliSaat(veri.acilis_saati))
        hatalar.push('Geçerli bir açılış saati giriniz (SS:DD).');

    if (!veri.kapanis_saati || !gecerliSaat(veri.kapanis_saati))
        hatalar.push('Geçerli bir kapanış saati giriniz (SS:DD).');

    if (veri.acilis_saati && veri.kapanis_saati && gecerliSaat(veri.acilis_saati) && gecerliSaat(veri.kapanis_saati)) {
        const fark = saatFarki(veri.acilis_saati, veri.kapanis_saati);
        if (fark <= 0)
            hatalar.push('Kapanış saati açılış saatinden sonra olmalıdır.');
        if (fark < 30)
            hatalar.push('Çalışma süresi en az 30 dakika olmalıdır.');
    }

    // ── Mola saatleri (ikisi de girilmişse kontrol et) ──
    if (veri.mola_baslangic || veri.mola_bitis) {
        if (!veri.mola_baslangic || !gecerliSaat(veri.mola_baslangic))
            hatalar.push('Mola başlangıç saati geçersiz.');
        if (!veri.mola_bitis || !gecerliSaat(veri.mola_bitis))
            hatalar.push('Mola bitiş saati geçersiz.');

        if (veri.mola_baslangic && veri.mola_bitis &&
            gecerliSaat(veri.mola_baslangic) && gecerliSaat(veri.mola_bitis)) {
            if (saatFarki(veri.mola_baslangic, veri.mola_bitis) <= 0)
                hatalar.push('Mola bitiş saati, başlangıçtan sonra olmalıdır.');
        }
    }

    // ── Çalışma günleri ─────────────────────────────────
    if (!veri.calisma_gunleri) {
        hatalar.push('En az bir çalışma günü seçilmelidir.');
    } else {
        const gunler = veri.calisma_gunleri.split(',').map(g => g.trim());
        const gecersizGun = gunler.find(g => !GECERLI_GUNLER.includes(g));
        if (gecersizGun)
            hatalar.push(`Geçersiz gün değeri: "${gecersizGun}".`);
        if (gunler.length === 0)
            hatalar.push('En az bir çalışma günü seçilmelidir.');
    }

    // ── Personel sayısı ─────────────────────────────────
    const personel = Number(veri.personel_sayisi);
    if (!veri.personel_sayisi || isNaN(personel) || personel < 1 || personel > 50)
        hatalar.push('Personel sayısı 1 ile 50 arasında olmalıdır.');

    // ── Randevu süresi ──────────────────────────────────
    const sure = Number(veri.randevu_suresi);
    if (!veri.randevu_suresi || isNaN(sure) || !GECERLI_SURELER.includes(sure))
        hatalar.push(`Randevu süresi şu değerlerden biri olmalıdır: ${GECERLI_SURELER.join(', ')} dakika.`);

    // ── Maks. günlük randevu ────────────────────────────
    const maxRandevu = Number(veri.max_gunluk_randevu);
    if (veri.max_gunluk_randevu && (isNaN(maxRandevu) || maxRandevu < 1 || maxRandevu > 100))
        hatalar.push('Maksimum günlük randevu 1 ile 100 arasında olmalıdır.');

    return hatalar;
}

// ══════════════════════════════════════════════════════════
//  API: İŞLETME EKLEME  (POST /api/isletme-ekle)
// ══════════════════════════════════════════════════════════
app.post('/api/isletme-ekle', (req, res) => {
    const veri = req.body;

    // 1) Doğrulama
    const hatalar = dogrulaIsletme(veri);
    if (hatalar.length > 0) {
        return res.status(400).json({ hata: hatalar[0], tumHatalar: hatalar });
    }

    // 2) Veriyi temizle / normalize et
    const temiz = {
        ad:                 veri.ad.trim(),
        kategori:           veri.kategori.trim(),
        adres:              veri.adres.trim(),
        telefon:            veri.telefon.trim(),
        email:              veri.email ? veri.email.trim().toLowerCase() : null,
        acilis_saati:       veri.acilis_saati,
        kapanis_saati:      veri.kapanis_saati,
        mola_baslangic:     veri.mola_baslangic  || null,
        mola_bitis:         veri.mola_bitis       || null,
        calisma_gunleri:    veri.calisma_gunleri,
        personel_sayisi:    Number(veri.personel_sayisi),
        randevu_suresi:     Number(veri.randevu_suresi),
        max_gunluk_randevu: Number(veri.max_gunluk_randevu) || 8,
    };

    // 3) INSERT INTO
    const sql = `
        INSERT INTO isletmeler
            (ad, kategori, adres, telefon, email,
             acilis_saati, kapanis_saati,
             mola_baslangic, mola_bitis, calisma_gunleri,
             personel_sayisi, randevu_suresi, max_gunluk_randevu)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
        temiz.ad, temiz.kategori, temiz.adres, temiz.telefon, temiz.email,
        temiz.acilis_saati, temiz.kapanis_saati,
        temiz.mola_baslangic, temiz.mola_bitis, temiz.calisma_gunleri,
        temiz.personel_sayisi, temiz.randevu_suresi, temiz.max_gunluk_randevu,
    ];

    db.run(sql, params, function (err) {
        if (err) {
            // Duplicate telefon numarası (UNIQUE kısıtlaması)
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({
                    hata: 'Bu telefon numarasıyla zaten bir işletme kayıtlı.',
                });
            }
            console.error('❌ INSERT hatası:', err.message);
            return res.status(500).json({ hata: 'Sunucu hatası: kayıt oluşturulamadı.' });
        }

        console.log(`✅ Yeni işletme eklendi → ID: ${this.lastID} | ${temiz.ad}`);
        res.status(201).json({
            mesaj:     '✅ İşletme başarıyla kaydedildi!',
            isletmeId: this.lastID,
            isletme:   { id: this.lastID, ...temiz },
        });
    });
});

// ══════════════════════════════════════════════════════════
//  API: İŞLETMELERİ LİSTELE  (GET /api/isletmeler)
// ══════════════════════════════════════════════════════════
app.get('/api/isletmeler', (req, res) => {
    const { q, kategori } = req.query;
    let sql    = 'SELECT * FROM isletmeler WHERE 1=1';
    const params = [];

    if (q) {
        sql += ' AND ad LIKE ?';
        params.push(`%${q}%`);
    }
    if (kategori) {
        sql += ' AND kategori = ?';
        params.push(kategori);
    }
    sql += ' ORDER BY olusturma_tarihi DESC';

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('❌ Listeleme hatası:', err.message);
            return res.status(500).json({ hata: 'İşletmeler listelenemedi.' });
        }
        res.json({ toplam: rows.length, isletmeler: rows });
    });
});

// ══════════════════════════════════════════════════════════
//  API: TEK İŞLETME GETIR  (GET /api/isletme/:id)
// ══════════════════════════════════════════════════════════
app.get('/api/isletme/:id', (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1)
        return res.status(400).json({ hata: 'Geçersiz işletme ID.' });

    db.get('SELECT * FROM isletmeler WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('❌ Getirme hatası:', err.message);
            return res.status(500).json({ hata: 'İşletme getirilemedi.' });
        }
        if (!row) return res.status(404).json({ hata: 'İşletme bulunamadı.' });
        res.json(row);
    });
});

// ══════════════════════════════════════════════════════════
//  API: İŞLETME GÜNCELLE  (PUT /api/isletme/:id)
// ══════════════════════════════════════════════════════════
app.put('/api/isletme/:id', (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1)
        return res.status(400).json({ hata: 'Geçersiz işletme ID.' });

    const hatalar = dogrulaIsletme(req.body);
    if (hatalar.length > 0)
        return res.status(400).json({ hata: hatalar[0], tumHatalar: hatalar });

    const veri = req.body;
    const sql = `
        UPDATE isletmeler SET
            ad = ?, kategori = ?, adres = ?, telefon = ?, email = ?,
            acilis_saati = ?, kapanis_saati = ?,
            mola_baslangic = ?, mola_bitis = ?, calisma_gunleri = ?,
            personel_sayisi = ?, randevu_suresi = ?, max_gunluk_randevu = ?
        WHERE id = ?
    `;
    const params = [
        veri.ad.trim(), veri.kategori, veri.adres.trim(), veri.telefon.trim(),
        veri.email ? veri.email.trim().toLowerCase() : null,
        veri.acilis_saati, veri.kapanis_saati,
        veri.mola_baslangic || null, veri.mola_bitis || null,
        veri.calisma_gunleri,
        Number(veri.personel_sayisi), Number(veri.randevu_suresi),
        Number(veri.max_gunluk_randevu) || 8,
        id,
    ];

    db.run(sql, params, function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed'))
                return res.status(409).json({ hata: 'Bu telefon numarası başka bir işletmeye ait.' });
            console.error('❌ Güncelleme hatası:', err.message);
            return res.status(500).json({ hata: 'Güncelleme başarısız.' });
        }
        if (this.changes === 0)
            return res.status(404).json({ hata: 'İşletme bulunamadı.' });

        console.log(`📝 İşletme güncellendi → ID: ${id}`);
        res.json({ mesaj: '✅ İşletme başarıyla güncellendi.' });
    });
});

// ══════════════════════════════════════════════════════════
//  API: İŞLETME SİL  (DELETE /api/isletme/:id)
// ══════════════════════════════════════════════════════════
app.delete('/api/isletme/:id', (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1)
        return res.status(400).json({ hata: 'Geçersiz işletme ID.' });

    db.run('DELETE FROM isletmeler WHERE id = ?', [id], function (err) {
        if (err) {
            console.error('❌ Silme hatası:', err.message);
            return res.status(500).json({ hata: 'İşletme silinemedi.' });
        }
        if (this.changes === 0)
            return res.status(404).json({ hata: 'İşletme bulunamadı.' });

        console.log(`🗑️ İşletme silindi → ID: ${id}`);
        res.json({ mesaj: '✅ İşletme başarıyla silindi.' });
    });
});

// ══════════════════════════════════════════════════════════
//  404 Yakalayıcı (tanımsız endpoint'ler için)
// ══════════════════════════════════════════════════════════
app.use((req, res) => {
    res.status(404).json({ hata: `Endpoint bulunamadı: ${req.method} ${req.path}` });
});

// ══════════════════════════════════════════════════════════
//  SUNUCUYU BAŞLAT
// ══════════════════════════════════════════════════════════
app.listen(PORT, () => {
    console.log(`\n🚀 Vakitly çalışıyor  →  http://localhost:${PORT}`);
    console.log(`📋 Kayıt formu        →  http://localhost:${PORT}/business.html\n`);
    console.log('Mevcut Endpoint\'ler:');
    console.log('  POST   /api/isletme-ekle');
    console.log('  GET    /api/isletmeler?q=&kategori=');
    console.log('  GET    /api/isletme/:id');
    console.log('  PUT    /api/isletme/:id');
    console.log('  DELETE /api/isletme/:id\n');
});