# Nox

Air-gapped kurumsal iletişim ve işbirliği platformu. Ürün tanımı, mimari ve yol haritası: [PROJECT_SPEC.md](PROJECT_SPEC.md).

## Durum (M1 başlangıcı)

Çalışan ilk dikey dilim:

- **Sunucu** (`apps/server`, NestJS + PostgreSQL): yerel hesapla giriş, oturum yönetimi (iptal edilebilir), RBAC (`admin` / `auditor` / `member`), kullanıcı oluşturma, **hash-chain'li append-only audit** (DB trigger'ı ile UPDATE/DELETE/TRUNCATE engelli), zincir doğrulama.
- **Masaüstü** (`apps/desktop`, Electron + Vite + React): giriş ekranı, sunucu durumu, denetim kayıtları ve zincir doğrulama. Token yalnızca main süreçte tutulur, OS anahtar deposuyla (Windows'ta DPAPI) şifreli saklanır. Renderer'dan dışarı çıkan tüm istekler engellenir (egress guard), Chromium'un arka plan ağ özellikleri kapalıdır.

Henüz yok: AD/LDAP, sohbet, dosya, toplantı, yönetim paneli, MSI paketi (bkz. yol haritası).

## Gereksinimler

- Node.js 22+ ve npm 10+
- PostgreSQL 16 — geliştirme için Docker (`docker-compose.dev.yml`) ya da kendi Postgres'iniz

## Kurulum ve çalıştırma

```bash
npm install
npm run infra:up          # Postgres (127.0.0.1:5433)
npm run dev:server        # API: http://localhost:4000/api/v1
npm run dev:desktop       # Electron uygulaması (ayrı terminalde)
```

İlk açılışta kullanıcı yoksa sunucu bir `admin` oluşturur. Parola `NOX_BOOTSTRAP_ADMIN_PASSWORD` ile verilebilir; verilmezse **rastgele üretilir ve sunucu logunda bir kez** yazılır.

PowerShell'de ortam değişkeni: `$env:NOX_BOOTSTRAP_ADMIN_PASSWORD = "..."` · cmd: `set NOX_BOOTSTRAP_ADMIN_PASSWORD=...`

### Windows'ta test (iki seçenek)

1. **Her şey Windows'ta:** Docker Desktop kuruluysa yukarıdaki adımlar aynen çalışır.
2. **Sunucu Mac'te, istemci Windows'ta:** Mac'te sunucu `0.0.0.0:4000`'de dinler. Windows'ta yalnızca `npm install` + `npm run dev:desktop` çalıştırın; giriş ekranında **"Sunucu adresini değiştir"** ile `http://<mac-ip>:4000` girin. (Mac güvenlik duvarı 4000 portuna izin vermeli.)

Varsayılan sunucu adresini `NOX_SERVER_URL` ile de verebilirsiniz.

## Ortam değişkenleri (sunucu)

| Değişken | Varsayılan | Not |
|---|---|---|
| `PORT` | `4000` | |
| `DATABASE_URL` | `postgres://nox:nox@localhost:5433/nox` | |
| `NOX_JWT_SECRET` | dev'e özel sabit | **production'da zorunlu** |
| `NOX_SESSION_TTL_SECONDS` | `28800` | |
| `NOX_BOOTSTRAP_ADMIN_USER` / `_PASSWORD` | `admin` / üretilir | |

## Komutlar

```bash
npm run typecheck   # sunucu + masaüstü
npm test            # sunucu birim testleri (audit zinciri)
npm run build       # sunucu + masaüstü derleme
```

## Bilinen kısıtlar (bilinçli, spec'e bağlı)

- Parola özeti şimdilik `scrypt` (spec argon2id ister; native bağımlılık/Windows build riski nedeniyle ertelendi).
- Oturum tek token ile 8 saat; kısa ömürlü access + refresh rotasyonu M1 sonunda.
- Zincirin sonundan kesme (tail truncation) zincirle tespit edilemez; harici çıpa/SIEM akışı M5.
- Zero-Internet doğrulaması (ağ yakalama testi) M0 çıktısı olarak CI'a eklenecek.
- Electron paketleme (MSI/MSIX, imzalama, güncelleme) henüz yok; yalnızca geliştirme modu.
