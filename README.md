# Randevu Yönetim Sistemi 📅

Bu proje, işletmelerin (Berber, Avukat vb.) kayıt olabileceği, müşterilerin ise bu işletmelerden personel müsaitliğine göre randevu alabileceği web tabanlı bir uygulamadır.

## 🚀 Özellikler

- **İşletme Kayıt Sistemi:**
  - İşletme bilgileri, kategorisi, adres, telefon, e-posta
  - Günlere özel çalışma saatleri (Pazartesi-Cuma 09:00-18:00 vs. Çarşamba 09:00-14:00)
  - Birden fazla saat aralığında mola tanımlaması
  - İşletmeye özel hizmetler ve her hizmetin minimum süresi (Saç Kesimi 60 dk, Ense Alma 20 dk)
  
- **Personel Yönetimi:**
  - Her işletmeye özel personeller eklenebilir
  - Personellerin günlere göre çalışma durumu belirlenebilir
  - Her personelin ayrı randevu takvimi
  - Personel uzmanlık alanları kaydedilebilir
  
- **Akıllı Randevu Sistemi:**
  - Hizmet süresi dikkate alınır (En az 15 dakika)
  - Günlere özel çalışma saatleri kontrol edilir
  - Molalar esnasında randevu verilmez
  - Personel kapasitesi dikkate alınır (Her personele max 1 randevu aynı saatte)
  - Personel seçimine göre randevu alınabilir
  
- **Dinamik Arama:** Müşteriler işletme adına veya kategorisine göre arama yapabilir.

- **Veritabanı:** Tüm veriler SQLite üzerinde güvenli ve kalıcı olarak saklanır.

## 🛠️ Kullanılan Teknolojiler

- **Frontend:** HTML5, CSS3, JavaScript 
- **Backend:** Node.js, Express.js
- **Veritabanı:** SQLite3

## ⚙️ Kurulum Talimatları

Projeyi bilgisayarınızda çalıştırmak için aşağıdaki adımları izleyin:

1. **Gereksinimler:** Bilgisayarınızda [Node.js](https://nodejs.org/) kurulu olmalıdır.
2. **Projeyi İndirin:** Bu klasörü bilgisayarınıza kaydedin.
3. **Terminali Açın:** Proje klasörüne sağ tıklayıp terminali/komut satırını açın.
4. **Bağımlılıkları Yükleyin:**
   ```bash
   npm install
Uygulamayı Başlatın:

Bash
node server.js
Tarayıcıda Açın: Adres çubuğuna http://localhost:3000 yazarak projeyi görüntüleyin.

📂 Veritabanı Yapısı

Proje `vakitly.db` adında yerel bir SQLite dosyası kullanır.

**Tablolar:**

1. **isletmeler** - İşletme detayları (ad, kategori, adres, telefon, açılış/kapanış saati, personel sayısı)
2. **personeller** - İşletmeye ait personeller (ad, telefon, e-posta, uzmanlık, çalışma günleri)
3. **hizmetler** - İşletmedeki hizmetler (ad, minimum süre)
4. **calisma_saatleri** - Günlere özel çalışma saatleri
5. **molalar** - Günlere özel mola tanımlaması (başlangıç-bitiş saati)
6. **randevular** - Müşteri randevuları (müşteri bilgileri, tarih, saat, personel ID)

📝 Geliştirici Notları

✅ **Tamamlanan Özellikler:**
- İşletme kayıt sistemi (hizmetler, molalar, günlere özel çalışma saatleri)
- Personel yönetimi (ekleme, düzenleme, silme)
- Akıllı slot hesaplama algoritması (personele göre)
- Randevu oluşturma (personel seçimi ile)

📌 **Nasıl Çalışır:**
- Bir berberde **3 personel (Ayşe, Fatma, Zehra)** varsa, aynı saatte max **3 randevu** alınabilir
- Eğer **Ayşe çarşamba günü çalışmıyorsa**, çarşamba günü Ayşe'ye randevu verilmez
- Hizmetlerin **minimum süreleri** dikkate alınır (Saç kesimi 60 dk boyu kaplar, ense alma 20 dk)
- **Molalar** sırasında randevu verilmez

🔧 **Yapılacak Şeyler:**
- Müşteri tarafında randevu sorgulama ve iptal etme
- Admin panelinde personel yönetimi
- SMS/Email bildirim sistemi
- Periyodik randevular (sadece insan adayları)

Geliştirici: [Ahmet Y.]
