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
                personel_id      INTEGER,
                musteri_ad       TEXT    NOT NULL,
                musteri_telefon  TEXT    NOT NULL,
                randevu_tarihi   TEXT    NOT NULL,
                randevu_saati    TEXT    NOT NULL,
                hizmet_id        INTEGER,
                durum            TEXT    NOT NULL DEFAULT 'bekliyor',
                olusturma_tarihi TEXT             DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (isletme_id) REFERENCES isletmeler(id) ON DELETE CASCADE,
                FOREIGN KEY (personel_id) REFERENCES personeller(id) ON DELETE SET NULL,
                FOREIGN KEY (hizmet_id) REFERENCES hizmetler(id) ON DELETE SET NULL
            )
        `, (err) => {
            if (err) console.error('❌ randevular tablo hatası:', err.message);
            else     console.log('📅 randevular tablosu hazır.');
        });

        // ── Hizmetler tablosu ───────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS hizmetler (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                isletme_id      INTEGER NOT NULL,
                ad              TEXT    NOT NULL,
                min_sure        INTEGER NOT NULL DEFAULT 15,
                aciklama        TEXT,
                olusturma_tarihi TEXT    DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (isletme_id) REFERENCES isletmeler(id) ON DELETE CASCADE,
                UNIQUE(isletme_id, ad)
            )
        `, (err) => {
            if (err) console.error('❌ hizmetler tablo hatası:', err.message);
            else     console.log('🛎️ hizmetler tablosu hazır.');
        });

        // ── Çalışma Saatleri tablosu ─────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS calisma_saatleri (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                isletme_id      INTEGER NOT NULL,
                gun             TEXT    NOT NULL,
                acilis_saati    TEXT    NOT NULL,
                kapanis_saati   TEXT    NOT NULL,
                acik_mi         BOOLEAN DEFAULT 1,
                olusturma_tarihi TEXT    DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (isletme_id) REFERENCES isletmeler(id) ON DELETE CASCADE,
                UNIQUE(isletme_id, gun)
            )
        `, (err) => {
            if (err) console.error('❌ calisma_saatleri tablo hatası:', err.message);
            else     console.log('⏰ calisma_saatleri tablosu hazır.');
        });

        // ── Molalar tablosu ──────────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS molalar (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                isletme_id      INTEGER NOT NULL,
                gun             TEXT,
                baslangic_saati TEXT    NOT NULL,
                bitis_saati     TEXT    NOT NULL,
                olusturma_tarihi TEXT    DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (isletme_id) REFERENCES isletmeler(id) ON DELETE CASCADE
            )
        `, (err) => {
            if (err) console.error('❌ molalar tablo hatası:', err.message);
            else     console.log('☕ molalar tablosu hazır.');
        });

        // ── Personeller tablosu ──────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS personeller (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                isletme_id      INTEGER NOT NULL,
                ad              TEXT    NOT NULL,
                telefon         TEXT,
                email           TEXT,
                uzmanlik        TEXT,
                calisma_gunleri TEXT    DEFAULT 'pzt,sal,car,per,cum',
                acik_mi         BOOLEAN DEFAULT 1,
                olusturma_tarihi TEXT    DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (isletme_id) REFERENCES isletmeler(id) ON DELETE CASCADE,
                UNIQUE(isletme_id, ad)
            )
        `, (err) => {
            if (err) console.error('❌ personeller tablo hatası:', err.message);
            else     console.log('👤 personeller tablosu hazır.');
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
//  API: HİZMET EKLE  (POST /api/hizmet-ekle)
// ══════════════════════════════════════════════════════════
app.post('/api/hizmet-ekle', (req, res) => {
    const { isletme_id, ad, min_sure, aciklama } = req.body;

    // Validasyon
    if (!isletme_id || !ad || !min_sure) {
        return res.status(400).json({ hata: 'İşletme ID, hizmet adı ve minimum süresi zorunludur.' });
    }

    const sure = Number(min_sure);
    if (isNaN(sure) || sure < 15) {
        return res.status(400).json({ hata: 'Minimum süresi en az 15 dakika olmalıdır.' });
    }

    const sql = `
        INSERT INTO hizmetler (isletme_id, ad, min_sure, aciklama)
        VALUES (?, ?, ?, ?)
    `;

    db.run(sql, [isletme_id, ad.trim(), sure, aciklama || null], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint')) {
                return res.status(409).json({ hata: 'Bu hizmet zaten mevcut.' });
            }
            console.error('❌ Hizmet ekleme hatası:', err.message);
            return res.status(500).json({ hata: 'Hizmet eklenemedi.' });
        }

        console.log(`✅ Hizmet eklendi → ID: ${this.lastID} | ${ad}`);
        res.status(201).json({
            mesaj: '✅ Hizmet başarıyla eklendi.',
            hizmetId: this.lastID,
        });
    });
});

// ══════════════════════════════════════════════════════════
//  API: MOLA EKLE  (POST /api/mola-ekle)
// ══════════════════════════════════════════════════════════
app.post('/api/mola-ekle', (req, res) => {
    const { isletme_id, gun, baslangic_saati, bitis_saati } = req.body;

    // Validasyon
    if (!isletme_id || !baslangic_saati || !bitis_saati) {
        return res.status(400).json({ hata: 'İşletme ID, başlangıç ve bitiş saati zorunludur.' });
    }

    if (!gecerliSaat(baslangic_saati) || !gecerliSaat(bitis_saati)) {
        return res.status(400).json({ hata: 'Geçerli saat formatı: HH:MM' });
    }

    if (saatFarki(baslangic_saati, bitis_saati) <= 0) {
        return res.status(400).json({ hata: 'Bitiş saati başlangıçtan sonra olmalıdır.' });
    }

    const sql = `
        INSERT INTO molalar (isletme_id, gun, baslangic_saati, bitis_saati)
        VALUES (?, ?, ?, ?)
    `;

    db.run(sql, [isletme_id, gun || null, baslangic_saati, bitis_saati], function (err) {
        if (err) {
            console.error('❌ Mola ekleme hatası:', err.message);
            return res.status(500).json({ hata: 'Mola eklenemedi.' });
        }

        console.log(`✅ Mola eklendi → ID: ${this.lastID}`);
        res.status(201).json({
            mesaj: '✅ Mola başarıyla eklendi.',
            molaId: this.lastID,
        });
    });
});

// ══════════════════════════════════════════════════════════
//  API: ÇALIŞMA SAATİ EKLE  (POST /api/calisma-saati-ekle)
// ══════════════════════════════════════════════════════════
app.post('/api/calisma-saati-ekle', (req, res) => {
    const { isletme_id, gun, acilis_saati, kapanis_saati, acik_mi } = req.body;

    // Validasyon
    if (!isletme_id || !gun || !acilis_saati || !kapanis_saati) {
        return res.status(400).json({ hata: 'İşletme ID, gün, açılış ve kapanış saati zorunludur.' });
    }

    if (!GECERLI_GUNLER.includes(gun)) {
        return res.status(400).json({ hata: 'Geçersiz gün: ' + gun });
    }

    if (!gecerliSaat(acilis_saati) || !gecerliSaat(kapanis_saati)) {
        return res.status(400).json({ hata: 'Geçerli saat formatı: HH:MM' });
    }

    if (saatFarki(acilis_saati, kapanis_saati) <= 0) {
        return res.status(400).json({ hata: 'Kapanış saati açılıştan sonra olmalıdır.' });
    }

    const sql = `
        INSERT OR REPLACE INTO calisma_saatleri 
            (isletme_id, gun, acilis_saati, kapanis_saati, acik_mi)
        VALUES (?, ?, ?, ?, ?)
    `;

    const acikMi = acik_mi === false ? 0 : 1;

    db.run(sql, [isletme_id, gun, acilis_saati, kapanis_saati, acikMi], function (err) {
        if (err) {
            console.error('❌ Çalışma saati ekleme hatası:', err.message);
            return res.status(500).json({ hata: 'Çalışma saati eklenemedi.' });
        }

        console.log(`✅ Çalışma saati eklendi → ${gun} | ${acilis_saati}-${kapanis_saati}`);
        res.status(201).json({
            mesaj: '✅ Çalışma saati başarıyla eklendi.',
        });
    });
});

// ══════════════════════════════════════════════════════════
//  API: HİZMETLERİ GETIR  (GET /api/isletme/:id/hizmetler)
// ══════════════════════════════════════════════════════════
app.get('/api/isletme/:id/hizmetler', (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1)
        return res.status(400).json({ hata: 'Geçersiz işletme ID.' });

    db.all('SELECT * FROM hizmetler WHERE isletme_id = ? ORDER BY ad', [id], (err, rows) => {
        if (err) {
            console.error('❌ Hizmetler listeleme hatası:', err.message);
            return res.status(500).json({ hata: 'Hizmetler listelenemedi.' });
        }
        res.json({ toplam: rows.length, hizmetler: rows });
    });
});

// ══════════════════════════════════════════════════════════
//  API: MOLALARI GETIR  (GET /api/isletme/:id/molalar)
// ══════════════════════════════════════════════════════════
app.get('/api/isletme/:id/molalar', (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1)
        return res.status(400).json({ hata: 'Geçersiz işletme ID.' });

    db.all('SELECT * FROM molalar WHERE isletme_id = ? ORDER BY gun, baslangic_saati', [id], (err, rows) => {
        if (err) {
            console.error('❌ Molalar listeleme hatası:', err.message);
            return res.status(500).json({ hata: 'Molalar listelenemedi.' });
        }
        res.json({ toplam: rows.length, molalar: rows });
    });
});

// ══════════════════════════════════════════════════════════
//  API: ÇALIŞMA SAATLERİNİ GETIR  (GET /api/isletme/:id/calisma-saatleri)
// ══════════════════════════════════════════════════════════
app.get('/api/isletme/:id/calisma-saatleri', (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1)
        return res.status(400).json({ hata: 'Geçersiz işletme ID.' });

    db.all('SELECT * FROM calisma_saatleri WHERE isletme_id = ? ORDER BY gun', [id], (err, rows) => {
        if (err) {
            console.error('❌ Çalışma saatleri listeleme hatası:', err.message);
            return res.status(500).json({ hata: 'Çalışma saatleri listelenemedi.' });
        }
        res.json({ toplam: rows.length, calisma_saatleri: rows });
    });
});

// ══════════════════════════════════════════════════════════
//  YARDIMCI: RANDEVU SLOT HESAPLAMA VE KONTROL
// ══════════════════════════════════════════════════════════
/**
 * Verilen tarih ve işletme için müsait slotları hesapla (personellere göre)
 * @param {number} isletmeId - İşletme ID
 * @param {string} tarih - Tarih (YYYY-MM-DD)
 * @param {number} hizmetId - Hizmet ID (minimum süreyi almak için)
 * @param {Function} callback - (err, slots) slots = [{saat, personeller: [{id, ad, musaitlik}]}]
 */
function hesaplaMusaitSlotlar(isletmeId, tarih, hizmetId, callback) {
    // Tarihin gün adını bul (0=paz, 1=pzt, ...)
    const gunAdlari = ['paz', 'pzt', 'sal', 'car', 'per', 'cum', 'cmt'];
    const date = new Date(tarih);
    const gunKodu = gunAdlari[date.getDay()];

    // 1. İşletmenin o gün açık olup olmadığını kontrol et
    db.get(`
        SELECT * FROM calisma_saatleri 
        WHERE isletme_id = ? AND gun = ?
    `, [isletmeId, gunKodu], (err, calismaRow) => {
        if (err) return callback(err);

        if (!calismaRow || !calismaRow.acik_mi) {
            return callback(null, []); // Kapalı gün
        }

        // 2. Hizmetin minimum süresini al
        let minSure = 30; // Varsayılan
        if (hizmetId) {
            db.get('SELECT min_sure FROM hizmetler WHERE id = ?', [hizmetId], (err, hizmetRow) => {
                if (!err && hizmetRow) {
                    minSure = hizmetRow.min_sure;
                }
                devamEt();
            });
        } else {
            devamEt();
        }

        function devamEt() {
            // 3. Personelleri al
            db.all('SELECT * FROM personeller WHERE isletme_id = ? AND acik_mi = 1 ORDER BY ad', 
                [isletmeId], (err, personeller) => {
                    if (err) return callback(err);

                    // 4. Molalar
                    db.all(`
                        SELECT baslangic_saati, bitis_saati FROM molalar 
                        WHERE isletme_id = ? AND (gun IS NULL OR gun = ?)
                    `, [isletmeId, gunKodu], (err, molalar) => {
                        if (err) return callback(err);

                        // 5. O gün randevular (personel bazında)
                        db.all(`
                            SELECT personel_id, randevu_saati FROM randevular 
                            WHERE isletme_id = ? AND randevu_tarihi = ? AND durum != 'iptal'
                        `, [isletmeId, tarih], (err, randevular) => {
                            if (err) return callback(err);

                            // Slotları hesapla
                            const slots = [];
                            const [basAc, basAm] = calismaRow.acilis_saati.split(':').map(Number);
                            const [sonKap, sonKapm] = calismaRow.kapanis_saati.split(':').map(Number);

                            let currentMinutes = basAc * 60 + basAm;
                            const endMinutes = sonKap * 60 + sonKapm;

                            while (currentMinutes + minSure <= endMinutes) {
                                const h = Math.floor(currentMinutes / 60);
                                const m = currentMinutes % 60;
                                const slotStart = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

                                // Mola kontrolü
                                let molada = false;
                                for (const mola of molalar) {
                                    const molaBasDak = parseInt(mola.baslangic_saati.split(':')[0]) * 60 + parseInt(mola.baslangic_saati.split(':')[1]);
                                    const molaBitDak = parseInt(mola.bitis_saati.split(':')[0]) * 60 + parseInt(mola.bitis_saati.split(':')[1]);

                                    if (currentMinutes < molaBitDak && currentMinutes + minSure > molaBasDak) {
                                        molada = true;
                                        break;
                                    }
                                }

                                if (!molada) {
                                    // Bu saat için personellerin müsaitliğini hesapla
                                    const slotPersoneller = [];

                                    for (const personel of personeller) {
                                        // Personel o gün çalışıyor mu?
                                        const personelGunleri = (personel.calisma_gunleri || '').split(',').map(g => g.trim());
                                        if (!personelGunleri.includes(gunKodu)) {
                                            continue; // Personel o gün çalışmıyor
                                        }

                                        // Personelin o saat aralığında randevusu var mı?
                                        let personelRandevuSayisi = 0;
                                        for (const rv of randevular) {
                                            if (rv.personel_id === personel.id) {
                                                const [rvH, rvM] = rv.randevu_saati.split(':').map(Number);
                                                const rvDak = rvH * 60 + rvM;

                                                if (rvDak >= currentMinutes && rvDak < currentMinutes + minSure) {
                                                    personelRandevuSayisi++;
                                                }
                                            }
                                        }

                                        // Personel sadece birden fazla randevuya sahip olamaz
                                        if (personelRandevuSayisi === 0) {
                                            slotPersoneller.push({
                                                id: personel.id,
                                                ad: personel.ad,
                                                uzmanlik: personel.uzmanlik,
                                            });
                                        }
                                    }

                                    // Eğer müsait personel varsa, slotu listeye ekle
                                    if (slotPersoneller.length > 0) {
                                        slots.push({
                                            saat: slotStart,
                                            personeller: slotPersoneller,
                                            kaynakMusaitlik: slotPersoneller.length,
                                        });
                                    }
                                }

                                currentMinutes += minSure;
                            }

                            callback(null, slots);
                        });
                    });
                });
        }
    });
}

// ══════════════════════════════════════════════════════════
//  API: SLOT HESAPLA  (POST /api/slot-hesapla)
// ══════════════════════════════════════════════════════════
app.post('/api/slot-hesapla', (req, res) => {
    const { isletme_id, tarih, hizmet_id } = req.body;

    if (!isletme_id || !tarih) {
        return res.status(400).json({ hata: 'İşletme ID ve tarih zorunludur.' });
    }

    hesaplaMusaitSlotlar(isletme_id, tarih, hizmet_id, (err, slots) => {
        if (err) {
            console.error('❌ Slot hesaplama hatası:', err.message);
            return res.status(500).json({ hata: 'Slotlar hesaplanamadı.' });
        }

        res.json({
            tarih,
            slotSayisi: slots.length,
            slotlar: slots,
        });
    });
});

// ══════════════════════════════════════════════════════════
//  API: RANDEVU OLUŞTUR  (POST /api/randevu-olustur)
// ══════════════════════════════════════════════════════════
app.post('/api/randevu-olustur', (req, res) => {
    const { isletme_id, personel_id, musteri_ad, musteri_telefon, tarih, saat, hizmet_id } = req.body;

    if (!isletme_id || !musteri_ad || !musteri_telefon || !tarih || !saat) {
        return res.status(400).json({ hata: 'Eksik alanlar: müşteri adı, telefon, tarih veya saat.' });
    }

    // Müşteri ad/telfonun boş olmadığını kontrol et
    if (musteri_ad.trim().length < 2) {
        return res.status(400).json({ hata: 'Müşteri adı en az 2 karakter olmalıdır.' });
    }

    if (!gecerliTelefon(musteri_telefon)) {
        return res.status(400).json({ hata: 'Geçerli bir telefon numarası giriniz.' });
    }

    // Slot'un müsait olup olmadığını kontrol et
    hesaplaMusaitSlotlar(isletme_id, tarih, hizmet_id, (err, slots) => {
        if (err) {
            console.error('❌ Slot kontrol hatası:', err.message);
            return res.status(500).json({ hata: 'Slot kontrolü başarısız.' });
        }

        const slotMevcutMu = slots.some(s => s.saat === saat);
        if (!slotMevcutMu) {
            return res.status(409).json({ hata: 'Seçilen saat müsait değil veya kapasite dolu.' });
        }

        // Personel kontrolü
        if (personel_id) {
            db.get('SELECT * FROM personeller WHERE id = ? AND isletme_id = ?', 
                [personel_id, isletme_id], (err, personel) => {
                    if (!personel) {
                        return res.status(404).json({ hata: 'Personel bulunamadı.' });
                    }
                    kaydEt();
            });
        } else {
            kaydEt();
        }

        function kaydEt() {
            // Randevuyu kayıt et
            const sql = `
                INSERT INTO randevular
                    (isletme_id, personel_id, musteri_ad, musteri_telefon, randevu_tarihi, randevu_saati, hizmet_id, durum)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'onaylandi')
            `;

            db.run(sql, [isletme_id, personel_id || null, musteri_ad.trim(), musteri_telefon.trim(), tarih, saat, hizmet_id || null], function (err) {
                if (err) {
                    console.error('❌ Randevu ekleme hatası:', err.message);
                    return res.status(500).json({ hata: 'Randevu oluşturulamadı.' });
                }

                console.log(`✅ Randevu oluşturuldu → ID: ${this.lastID}`);
                res.status(201).json({
                    mesaj: '✅ Randevu başarıyla oluşturuldu!',
                    randevuId: this.lastID,
                });
            });
        }
    });
});

// ══════════════════════════════════════════════════════════
//  API: PERSONEL EKLE  (POST /api/personel-ekle)
// ══════════════════════════════════════════════════════════
app.post('/api/personel-ekle', (req, res) => {
    const { isletme_id, ad, telefon, email, uzmanlik, calisma_gunleri } = req.body;

    if (!isletme_id || !ad) {
        return res.status(400).json({ hata: 'İşletme ID ve personel adı zorunludur.' });
    }

    if (ad.trim().length < 2) {
        return res.status(400).json({ hata: 'Personel adı en az 2 karakter olmalıdır.' });
    }

    if (email && !gecerliEmail(email)) {
        return res.status(400).json({ hata: 'Geçerli bir e-posta adresi giriniz.' });
    }

    const sql = `
        INSERT INTO personeller (isletme_id, ad, telefon, email, uzmanlik, calisma_gunleri)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [isletme_id, ad.trim(), telefon || null, email || null, uzmanlik || null, calisma_gunleri || 'pzt,sal,car,per,cum'], 
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint')) {
                    return res.status(409).json({ hata: 'Bu personel zaten mevcut.' });
                }
                console.error('❌ Personel ekleme hatası:', err.message);
                return res.status(500).json({ hata: 'Personel eklenemedi.' });
            }

            console.log(`✅ Personel eklendi → ID: ${this.lastID} | ${ad}`);
            res.status(201).json({
                mesaj: '✅ Personel başarıyla eklendi.',
                personelId: this.lastID,
            });
        }
    );
});

// ══════════════════════════════════════════════════════════
//  API: PERSONELLERI GETIR  (GET /api/isletme/:id/personeller)
// ══════════════════════════════════════════════════════════
app.get('/api/isletme/:id/personeller', (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1)
        return res.status(400).json({ hata: 'Geçersiz işletme ID.' });

    db.all('SELECT * FROM personeller WHERE isletme_id = ? ORDER BY ad', [id], (err, rows) => {
        if (err) {
            console.error('❌ Personeller listeleme hatası:', err.message);
            return res.status(500).json({ hata: 'Personeller listelenemedi.' });
        }
        res.json({ toplam: rows.length, personeller: rows });
    });
});

// ══════════════════════════════════════════════════════════
//  API: PERSONEL GÜNCELLE  (PUT /api/personel/:id)
// ══════════════════════════════════════════════════════════
app.put('/api/personel/:id', (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1)
        return res.status(400).json({ hata: 'Geçersiz personel ID.' });

    const { ad, telefon, email, uzmanlik, calisma_gunleri, acik_mi } = req.body;

    if (!ad || ad.trim().length < 2) {
        return res.status(400).json({ hata: 'Personel adı en az 2 karakter olmalıdır.' });
    }

    if (email && !gecerliEmail(email)) {
        return res.status(400).json({ hata: 'Geçerli bir e-posta adresi giriniz.' });
    }

    const sql = `
        UPDATE personeller SET
            ad = ?, telefon = ?, email = ?, uzmanlik = ?, calisma_gunleri = ?, acik_mi = ?
        WHERE id = ?
    `;

    const acikMi = acik_mi === false ? 0 : 1;
    db.run(sql, [ad.trim(), telefon || null, email || null, uzmanlik || null, calisma_gunleri || 'pzt,sal,car,per,cum', acikMi, id], 
        function (err) {
            if (err) {
                console.error('❌ Personel güncelleme hatası:', err.message);
                return res.status(500).json({ hata: 'Personel güncellenemedi.' });
            }
            if (this.changes === 0)
                return res.status(404).json({ hata: 'Personel bulunamadı.' });

            console.log(`📝 Personel güncellendi → ID: ${id}`);
            res.json({ mesaj: '✅ Personel başarıyla güncellendi.' });
        }
    );
});

// ══════════════════════════════════════════════════════════
//  API: PERSONEL SİL  (DELETE /api/personel/:id)
// ══════════════════════════════════════════════════════════
app.delete('/api/personel/:id', (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1)
        return res.status(400).json({ hata: 'Geçersiz personel ID.' });

    db.run('DELETE FROM personeller WHERE id = ?', [id], function (err) {
        if (err) {
            console.error('❌ Personel silme hatası:', err.message);
            return res.status(500).json({ hata: 'Personel silinemedi.' });
        }
        if (this.changes === 0)
            return res.status(404).json({ hata: 'Personel bulunamadı.' });

        console.log(`🗑️ Personel silindi → ID: ${id}`);
        res.json({ mesaj: '✅ Personel başarıyla silindi.' });
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
    console.log('  POSTİŞLETME:');
    console.log('    POST   /api/isletme-ekle');
    console.log('    GET    /api/isletmeler?q=&kategori=');
    console.log('    GET    /api/isletme/:id');
    console.log('    PUT    /api/isletme/:id');
    console.log('    DELETE /api/isletme/:id');
    console.log('');
    console.log('  HİZMETLER:');
    console.log('    POST   /api/hizmet-ekle');
    console.log('    GET    /api/isletme/:id/hizmetler');
    console.log('');
    console.log('  ÇALIŞMA SAATLERİ:');
    console.log('    POST   /api/calisma-saati-ekle');
    console.log('    GET    /api/isletme/:id/calisma-saatleri');
    console.log('');
    console.log('  MOLALAR:');
    console.log('    POST   /api/mola-ekle');
    console.log('    GET    /api/isletme/:id/molalar');
    console.log('');
    console.log('  PERSONELLER:');
    console.log('    POST   /api/personel-ekle');
    console.log('    GET    /api/isletme/:id/personeller');
    console.log('    PUT    /api/personel/:id');
    console.log('    DELETE /api/personel/:id');
    console.log('');
    console.log('  RANDEVULAR:');
    console.log('    POST   /api/slot-hesapla');
    console.log('    POST   /api/randevu-olustur\n');
});