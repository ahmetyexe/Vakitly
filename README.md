# Randevu Yönetim Sistemi 📅

Bu proje, işletmelerin (Berber, Avukat vb.) kayıt olabileceği, müşterilerin ise bu işletmelerden personel müsaitliğine göre randevu alabileceği web tabanlı bir uygulamadır.

## 🚀 Özellikler

- **İşletme Girişi:** İşletmeler ad, adres, çalışma saatleri ve personel sayısını sisteme kaydeder.
- **Dinamik Arama:** Müşteriler işletme adına veya kategorisine göre arama yapabilir.
- **Akıllı Randevu Sistemi:** - İşletmenin personel sayısına göre kontenjan belirler.
  - Aynı saatte, personel sayısı kadar müşteri randevu alabilir.
  - Randevu süreleri (30 dk / 1 saat) seçilebilir.
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
Proje randevu.db adında yerel bir dosya kullanır.

businesses Tablosu: İşletme detayları ve personel sayısı.

appointments Tablosu: Müşteri bilgileri, tarih, saat ve işletme ID'si.

📝 Geliştirici Notları
Proje şu an geliştirme aşamasındadır (Localhost).

"Personel Sayısı" mantığı sayesinde, bir berberde 3 koltuk varsa aynı saat dilimine 3 farklı kişi randevu alabilir. 4. kişiye sistem izin vermez.

Geliştirici: [Ahmet Y.]
