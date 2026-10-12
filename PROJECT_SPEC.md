# Nox — Air-Gapped Enterprise Communication Platform

> Sürüm: 0.1 (taslak) · Durum: Gözden geçirme bekliyor · Dil: Türkçe (kod ve API isimleri İngilizce)
> Çalışma adı: **Nox** (eski ad: SecureCollab)

---

## 1. Vizyon, kapsam ve varsayımlar

### 1.1 Vizyon
Nox, kritik kurumlar (öncelikle finans kuruluşları) için tamamen on-premise / air-gapped çalışan güvenli iletişim ve işbirliği platformudur. Bir "Teams klonu" değildir: hedef, Teams'in temel işbirliği yetenekleri + sıfır internet bağımlılığı + denetim/uyum kontrolleridir.

### 1.2 Öncelikler
1. **Windows masaüstü istemcisi** (birincil)
2. Web istemcisi (aynı kod tabanı, yönetim paneli dahil)
3. macOS masaüstü (V2, ucuz)
4. iOS / Android (çok sonra; bkz. Bölüm 10)

### 1.3 Kapsam dışı (V1)
- Dış dünya ile federasyon (başka kurum, Teams/Slack köprüsü)
- E2EE (bilinçli karar, bkz. 3.3)
- Toplantı kaydı ve transkript (V2)
- Exchange / Outlook takvim entegrasyonu (V2)
- Mobil istemciler, push bildirimi altyapısı (APNs/FCM)
- Bot / üçüncü taraf uygulama pazaryeri

### 1.4 Varsayımlar
- Hedef ölçek: **2.000–10.000 kullanıcı**, tek veri merkezi (V1), DR sitesi tasarımı hazır.
- Müşteri ortamında Active Directory / LDAP, dahili PKI ve SIEM (örn. QRadar) vardır.
- İstemci cihazlar kurum yönetimindeki Windows 10 22H2 ve Windows 11 x64 makineleridir (Win10 genel desteği bittiği için ESU/kurum yaması varsayılır; test matrisi her ikisini kapsar).
- Dağıtım ve güncellemeler offline aktarım (imzalı paket) ile yapılır.
- Tek kiracılı (single-tenant) kurulum; her kurum kendi kurulumunu işletir.

### 1.5 Terimler
| Terim | Anlamı |
|---|---|
| Zero-Internet | Çalışma anında hiçbir dış ağ bağlantısı gerekmez |
| SFU | Selective Forwarding Unit; grup medya yönlendirici |
| WORM | Write-once-read-many; değiştirilemez kayıt |
| Break-glass | Acil durum yönetici hesabı, kullanımı ayrıca alarmlanır |

---

## 2. Mimari ilkeler

1. **Runtime Zero-Internet Dependency.** Uygulama çalışırken Apple, Google, Microsoft, AWS, Firebase, Cloudflare, GitHub, npm veya herhangi bir dış servise bağlantı kurmaz. Bu kural yazılım tedarik zincirini de kapsar: paketler, container imajları, güncellemeler, sertifikalar ve AV imzaları kontrollü offline aktarımla kuruma alınır.
2. **Önce güvenlik, önce audit.** Her özelliğin tehdit modeli ve audit olayı özellikten önce tanımlanır. Audit yazılamıyorsa kritik işlem başarısız olur (fail-closed).
3. **Sunucu içeriği okuyabilir.** DLP, arama, eDiscovery, saklama ve denetim için (bkz. 3.3).
4. **Tek nokta arızası yok.** Her bileşen için HA stratejisi tasarım aşamasında tanımlanır.
5. **Protokol istemciden bağımsız.** Sync/WebSocket protokolü Windows, web ve gelecekteki mobil için aynıdır.
6. **Minimum yetki.** Servisler arası mTLS, servis başına ayrı DB rolü, yönetici işlemlerinde dört göz prensibi.

### 2.1 Sistem mimarisi

```text
                 AIR-GAPPED CORPORATE NETWORK
┌───────────────────────────────────────────────────────┐
│  Windows Desktop (Electron)      Web (SPA)            │
│            │                        │                 │
│            └───────────┬────────────┘                 │
│                  Internal LB / WAF (mTLS opsiyonel)   │
│                        │                              │
│                   API Gateway                         │
│      ┌─────────────────┼──────────────────┐           │
│   Identity          Messaging           Files         │
│  AD/LDAP/Kerberos   REST + WebSocket    Object store  │
│      │              Search svc          AV (ClamAV)   │
│      │                  │                 │           │
│      └──────────────────┼─────────────────┘           │
│          PostgreSQL (Patroni HA) · Redis · NATS       │
│          OpenSearch/Meilisearch · Vault/KMS           │
│                                                       │
│     ┌──────────────────────────────┐                  │
│     │ SFU (LiveKit) cluster + TURN │  Audio/Video/SS  │
│     └──────────────────────────────┘                  │
│  Audit svc ──► WORM store ──► SIEM (CEF/LEEF/syslog)  │
│  Backup ──► internal backup target                    │
│  Update/Registry (Harbor, installer feed) — internal  │
└───────────────────────────────────────────────────────┘
   ✕ INTERNET  ✕ CLOUD  ✕ APNs/FCM  ✕ TELEMETRY
```

### 2.2 Teknoloji seçimi

| Katman | Seçim | Not |
|---|---|---|
| Masaüstü | Electron + Vite + React + TypeScript | Web ile kod paylaşımı, olgun WebRTC |
| Web | Aynı SPA | Next.js/SSR kullanılmaz |
| Backend | NestJS (TypeScript) | Modüler monolit ile başla, medya/audit ayrı servis |
| DB | PostgreSQL + Patroni | Row-level yetki, pgcrypto/at-rest şifreleme |
| Cache/presence | Redis | |
| Mesaj omurgası | NATS JetStream (öneri) veya Redis Streams | WebSocket node'ları arası fan-out |
| Arama | OpenSearch veya Meilisearch | Karar: M2 başında PoC |
| Object storage | SeaweedFS / Ceph / MinIO | **Lisans ve sürüm durumu doğrulanacak** (AGPL, topluluk sürümü kısıtları) |
| SFU / TURN | LiveKit (öneri), alternatif mediasoup / Janus; coturn | Dahili TURN zorunlu |
| AV | ClamAV (offline imza aktarımı) + opsiyonel ticari AV ICAP | |
| Secrets/KMS | HashiCorp Vault (veya OpenBao) | Lisans kontrolü gerekir |
| Orkestrasyon | Kubernetes (RKE2 / k3s) | |
| Gözlemlenebilirlik | Prometheus, Grafana, Loki, OpenTelemetry (yalnızca lokal) | Telemetri dışarı çıkmaz |
| Registry/paket | Harbor, Nexus / Verdaccio | Offline mirror |

---

## 3. Güvenlik gereksinimleri

### 3.1 Tehdit modeli (STRIDE özeti)
Detaylı model M0'ın teslim edilebilir çıktısıdır (`docs/threat-model.md`). Başlangıç tehditleri:

| Kategori | Örnek tehdit | Azaltım |
|---|---|---|
| Spoofing | Çalınmış token ile oturum | Kısa ömürlü access token, cihaz bağlama, refresh rotasyonu, DPAPI |
| Tampering | Audit log silme/değiştirme | Hash-chain, WORM, ayrı yetki, SIEM'e eşzamanlı akış |
| Repudiation | "Ben göndermedim" | İmzalı olay kaydı, mesaj integrity hash |
| Information disclosure | Mesaj/dosya sızıntısı, istemci önbelleği | At-rest şifreleme, SQLCipher, ekran yakalama engeli, DLP |
| DoS | WebSocket / SFU kaynak tüketimi | Rate limit, kota, oda kapasite limiti |
| Elevation | Yönetici yetkisi kötüye kullanımı | RBAC, dört göz, break-glass alarmı, JIT yetki |
| Supply chain | Zararlı bağımlılık | Offline mirror, SBOM, imza doğrulama, lisans/zafiyet taraması |

### 3.2 Genel gereksinimler
- Tüm trafik TLS 1.2+ (hedef 1.3); servisler arası mTLS; dahili PKI.
- Parola politikası AD'den miras; yerel hesaplar için argon2id, MFA opsiyonu (TOTP, kurum içi doğrulama).
- Oturum: cihaz bazlı, listelenebilir, uzaktan sonlandırılabilir; eşzamanlı oturum limiti politikası.
- Tüm girdiler doğrulanır; dosya yüklemelerinde MIME sniffing + AV taraması tamamlanmadan indirme yok.
- Sırlar kodda/ortam değişkeninde tutulmaz; Vault üzerinden.
- İstemcinin dış ağ çıkışı **yoktur** (bkz. 7.4 doğrulama listesi).

### 3.3 Gizlilik modeli (karar)
**Sunucu okuyabilir; E2EE yok.** Gerekçe: eDiscovery, DLP, saklama/yasal bekletme, arama ve denetim finans düzenlemeleri için zorunlu. Koruma: TLS + at-rest şifreleme + KMS anahtar rotasyonu + erişim denetimi. Toplantı medyası DTLS-SRTP ile hop-by-hop şifrelidir (SFU medyayı çözmez, yönlendirir).

### 3.4 Uyum eşlemesi
BDDK Bilgi Sistemleri Yönetmeliği, KVKK, ISO/IEC 27001 kontrollerinin eşlemesi M0'da hazırlanır. Spec seviyesinde kesin gereksinimler: log saklama süresi yapılandırılabilir, verinin yurt içinde kalması (air-gapped olduğu için sağlanır), yetki ayrımı, erişim kayıtlarının değiştirilemezliği, break-glass prosedürü.

---

## 4. Modüller (V1)

### 4.1 Kimlik ve erişim (Identity)
- AD/LDAP(S) entegrasyonu; grup eşleme → rol; periyodik senkron + anlık doğrulama.
- **Windows sessiz SSO:** Kerberos/SPNEGO (Negotiate). Yedek: kullanıcı adı + parola.
- Yerel hesap opsiyonu (break-glass ve AD'siz kurulum).
- RBAC: roller (SuperAdmin, SecurityAdmin, Auditor, Admin, ChannelOwner, Member, Guest). Auditor rolü içerik değil audit görür; SecurityAdmin ve Admin ayrılır.
- **Guest (iç misafir):** AD dışı yerel hesap (müteahhit/denetçi); yalnızca açıkça davet edildiği kanal ve toplantılara erişir, dizin aramada görünmez, dosya indirme varsayılan kapalı, MFA zorunlu, hesap süresi (expiry) zorunlu, tüm eylemleri ayrıca audit'lenir. Kurumlar arası federasyon kapsam dışıdır.
- Cihaz kaydı, oturum listesi, uzaktan çıkış, cihaz engelleme.

**Kabul:** AD'den giriş yapan kullanıcı domain makinede şifresiz giriş yapar; grup değişikliği ≤ 15 dk içinde role yansır; sonlandırılan oturum ≤ 5 sn içinde WebSocket'ten düşer.

### 4.2 Mesajlaşma (Messaging)
- Birebir, grup, kanal/team yapısı (özel/genel kanallar).
- Yanıt (thread), düzenleme (**tüm sürümler saklanır**; kullanıcı yalnızca son sürümü görür, Auditor/eDiscovery tüm geçmişi görür), silme (soft delete; kalıcı silme yalnızca retention bitince ve legal hold yoksa, audit'li), mention, tepki, okunma bilgisi, yazıyor göstergesi, presence.
- Mesaj sınıflandırma etiketi (Public/Internal/Confidential/Secret — kurum yapılandırır).
- Offline kuyruk, cursor tabanlı senkronizasyon, sıralama garantisi (konuşma başına monoton `seq`).
- Mesaj başına: sender, conversation, timestamp, message id, classification, retention policy, integrity hash, audit reference.

**Kabul:** 10.000 eşzamanlı bağlantıda p95 mesaj teslim gecikmesi < 300 ms (LAN); bağlantı kopup gelince kayıp mesaj yok.

### 4.3 Dosya (Files)
- Yükleme/indirme (chunked, devam edilebilir), önizleme (PDF, görsel, Office → sunucuda güvenli render, dışa bağlantısız).
- Yetki: konuşma/kanal üyeliğine bağlı + sınıflandırma politikası.
- Her dosya: uploader, SHA-256, MIME, size, classification, AV status, access policy, download history, retention.
- Durum makinesi: `uploaded → scanning → clean | infected | scan_failed`. Yalnızca `clean` indirilebilir.
- Yasaklı uzantı/MIME politikası, boyut kotası.

**Kabul:** EICAR test dosyası karantinaya alınır ve audit olayı üretir; hash uyuşmazlığı indirmede tespit edilir.

### 4.4 Toplantı (Meetings)
- 1:1 sesli/görüntülü arama, grup toplantısı, ekran paylaşımı (pencere/ekran), mute/kamera kontrolü, katılımcı listesi, lobi (opsiyonel), toplantı sahibi kontrolleri.
- WebRTC; medya self-hosted SFU üzerinden, TURN dahili. Simulcast ve bant genişliği adaptasyonu.
- Toplantı oluşturma, bağlantı/davet, `.ics` dışa aktarma. (Exchange entegrasyonu V2.)
- Medya kaydı yok (V1). Toplantı metadata'sı audit'e yazılır (kim katıldı/ayrıldı, süre, paylaşım başlatma).

**Kabul:** 50 katılımcılı toplantı (4 video, kalan ses) LAN'da stabil; SFU düğümü kaybında oda 10 sn içinde yeniden bağlanır.

### 4.5 Arama
- Mesaj ve dosya içeriğinde tam metin arama; yetkiye göre filtreli (kullanıcı göremediğini bulamaz).
- Türkçe analizör (ASCII katlama, kök bulma).

### 4.6 Audit ve SIEM
- Her kritik olay için: **WHO, WHAT, WHEN, WHERE, RESULT, OBJECT, SESSION, DEVICE**.
- Kapsam: login/logout/başarısız giriş, mesaj, dosya, toplantı, yetki değişikliği, yönetici faaliyeti, politika değişikliği, break-glass kullanımı.
- Append-only, **hash-chain**'li (her kayıt öncekinin hash'ini içerir); periyodik zincir doğrulama job'ı; WORM depolamaya replikasyon.
- SIEM: syslog (TLS), **CEF**, **LEEF**, ve pull API. QRadar için LEEF profili.
- Auditor arayüzü: filtre, dışa aktarma, zincir bütünlük raporu.

**Kabul:** Bir audit kaydı elle değiştirilirse doğrulama job'ı ≤ 1 saat içinde alarm üretir; SIEM kaybında olaylar kuyruklanır, kayıp yok.

### 4.7 Yönetim paneli
Kullanıcı, grup, kanal, cihaz, politika (saklama, sınıflandırma, dosya, parola/oturum), güvenlik ayarları, lisans durumu, sistem sağlığı. Kritik değişiklikler dört göz onayı ile.

### 4.8 Saklama ve yasal bekletme
Konuşma/kanal/sınıflandırma bazlı retention; yasal bekletme (legal hold) retention'ı ezer; süresi dolan veri kontrollü silinir ve silme audit'lenir.

---

## 5. Veri modeli (özet)

```text
users(id, ad_sid, upn, display_name, status, auth_source, created_at)
roles / user_roles / groups / group_members
devices(id, user_id, fingerprint, os, first_seen, last_seen, status)
sessions(id, user_id, device_id, issued_at, expires_at, revoked_at, ip)

conversations(id, type[dm|group|channel], team_id, name, classification, retention_policy_id, created_by)
conversation_members(conversation_id, user_id, role, joined_at, last_read_seq)
messages(id, conversation_id, seq, sender_id, body_enc, classification,
         reply_to, edited_at, deleted_at, integrity_hash, audit_ref, created_at)
message_edits(message_id, version, body_enc, edited_at)
reactions / mentions / read_receipts

files(id, uploader_id, conversation_id, object_key, sha256, mime, size,
      classification, av_status, av_scanned_at, retention_policy_id, created_at)
file_access_log(file_id, user_id, action, at, ip, device_id)

meetings(id, title, owner_id, scheduled_at, sfu_room, status)
meeting_participants(meeting_id, user_id, joined_at, left_at, device_id)

audit_events(id, seq, prev_hash, hash, who, what, at, where_ip, result,
             object_type, object_id, session_id, device_id, details_jsonb)
policies / retention_policies / legal_holds
```
Notlar: `body_enc` uygulama seviyesinde şifrelenir (envelope encryption, KMS). `audit_events` ayrı şema/rol; uygulama yalnızca INSERT yetkisine sahiptir.

---

## 6. API tasarımı (özet)

- **REST** `/api/v1/*` (OpenAPI üretimi zorunlu): `auth`, `users`, `conversations`, `messages`, `files`, `meetings`, `search`, `admin/*`, `audit/*`.
- **WebSocket** `/ws`: abonelik tabanlı olay akışı. Olaylar: `message.created|updated|deleted`, `receipt.updated`, `presence.changed`, `typing`, `call.incoming`, `session.revoked`.
- **Sync protokolü:** istemci `since_cursor` ile `GET /sync` çağırır; sunucu konuşma başına `seq` ve global değişiklik cursor'ı döner. Aynı protokol mobilde açılışta senkron için kullanılacaktır.
- Idempotency: istemci üretimli `client_msg_id`.
- Hata modeli: RFC 7807 problem+json. Versiyonlama: URL path.
- Toplantı: `POST /meetings/{id}/join` → kısa ömürlü SFU token; medya SFU'ya doğrudan bağlanır.

---

## 7. Windows istemcisi

### 7.1 Teknoloji ve yapı
Electron (güncel LTS), Vite + React + TypeScript, paylaşılan `packages/ui` ve `packages/sdk` (web ile ortak). Main/renderer ayrımı; `contextIsolation: true`, `nodeIntegration: false`, sandbox, katı CSP, IPC allow-list.

### 7.2 Dağıtım ve güncelleme
- MSI (GPO/SCCM/Intune) ve MSIX çıktısı; kod imzalama kurum içi CA/EV ile.
- Güncelleme: dahili, imzalı update feed (electron-updater generic provider veya MSI üzerinden yönetim). İmza doğrulaması zorunlu; kademeli dağıtım (ring) desteği.
- Sunucu sürümüyle uyumluluk matrisi; eski istemci reddi politikası.

### 7.3 İstemci güvenliği
- Token'lar DPAPI / Windows Credential Manager.
- Yerel mesaj önbelleği SQLCipher (anahtar DPAPI ile korunur); çıkışta/uzaktan silmede temizlenir.
- `SetWindowDisplayAffinity` ile ekran görüntüsü engelleme (politika ile açılır).
- İndirme, pano ve dosya kaydetme politikaları; opsiyonel filigran.
- Cihaz bağlama (sertifika veya donanım parmak izi), uzaktan oturum silme.
- Tray/arka plan çalışma, otomatik başlatma, Windows toast bildirimleri (WebSocket tabanlı; dış push yok).
- Sistem proxy'sini kullanmaz; yalnızca yapılandırılmış Nox sunucu adresine bağlanır.

### 7.4 Zero-Internet doğrulama listesi (istemci)
Aşağıdakiler kapatılır ve CI'da ağ yakalama testi ile doğrulanır (tüm uygulama akışı boyunca yalnızca izinli iç host'lara trafik çıkmalı):
- Crash reporter, Chromium component updater, Safe Browsing, DNS prefetch / preconnect, network prediction
- Link önizleme (unfurl), uzaktan font/emoji/GIF, OCSP/CRL dış sorguları (iç PKI kullanılır)
- Telemetri, auto-update'in dış kaynakları, WebRTC STUN varsayılanları (yalnızca dahili TURN)

---

## 8. Dağıtım ve operasyon

- **Offline teslim paketi:** imzalı bundle (container imajları, Helm chart'ları, istemci installer'ları, AV imzaları, SBOM, hash listesi). Kuruma aktarım prosedürü dokümante edilir.
- **Tedarik zinciri:** SBOM (CycloneDX), imzalı artifact, bağımlılık zafiyet ve **lisans taraması** (AGPL/SSPL riskleri), reproducible build hedefi, dahili npm/OCI mirror.
- **Lisanslama:** imzalı offline lisans dosyası (kullanıcı sayısı, süre, özellikler); doğrulama tamamen lokal.
- **HA/DR:** PostgreSQL Patroni (3 düğüm), Redis Sentinel/Cluster, NATS cluster, birden fazla SFU/TURN düğümü, object storage replikasyonu. RPO/RTO hedefleri: RPO ≤ 5 dk, RTO ≤ 1 saat (V1 hedefi, müşteriyle teyit edilir). Yedekleme: şifreli, düzenli geri yükleme testi.
- **Gözlemlenebilirlik:** Prometheus + Grafana + Loki lokal; uyarı kuralları; sağlık uç noktaları.
- **Yükseltme:** sıfıra yakın kesinti, geri alınabilir migration'lar, sürüm uyumluluk matrisi.
- **Kapasite planı:** SFU bant genişliği hesabı, WebSocket bağlantı kapasitesi, depolama büyümesi; M0'da referans mimari ve sizing tablosu.

---

## 9. Kalite, test ve gözlem

- Birim + entegrasyon testleri; kritik akışlar için E2E (Playwright; Electron için `@playwright/_electron`).
- Yük testleri: WebSocket 10k bağlantı, SFU toplantı senaryoları.
- Güvenlik: SAST/DAST, bağımlılık taraması, dış pentest (pilot öncesi), ağ yakalama ile Zero-Internet regresyon testi.
- Audit tamlık testi: her kritik API için "olay üretildi mi" sözleşme testi.
- i18n: Türkçe + İngilizce baştan; erişilebilirlik (klavye, ekran okuyucu) temel seviyede.

---

## 10. Mobil (sonra) — bilinen kısıt

APNs/FCM kullanılmayacağı için uygulama kapalı/askıdayken Teams/WhatsApp seviyesinde push ve gelen çağrı garantisi **verilemez**. Modeller:
- **Foreground:** WebSocket → mesaj, presence, çağrı gerçek zamanlı.
- **Background/terminated:** OS'in izin verdiği sınırlı mekanizmalar; uygulama açılınca `sync` ile telafi.

Bu kısıt ürün gereksinimlerinde açıkça yazılır. Native (Swift/SwiftUI, Kotlin/Compose) tercih edilir. API ve sync protokolü bu yüzden şimdiden istemciden bağımsız tasarlanır.

---

## 11. Yol haritası

| Aşama | İçerik | Çıkış kriteri |
|---|---|---|
| **M0 Temeller** | Tehdit modeli, uyum eşlemesi, referans mimari + sizing, repo/monorepo, CI, offline build zinciri, PoC'ler (SFU, arama motoru, object storage lisansı) | Onaylı spec + çalışan iskelet CI |
| **M1 Kimlik + Audit + Kabuk** | AD/LDAP, Kerberos SSO, RBAC, cihaz/oturum, audit çekirdeği (hash-chain), Electron kabuğu, MSI iskeleti | AD kullanıcısı girer, olay audit'e düşer |
| **M2 Chat** | DM/grup/kanal, thread, mention, read, presence, sync, arama | Bağlantı kopması senaryolarında kayıpsız |
| **M3 Dosya** | Yükleme/indirme, AV, hash, önizleme, yetki, download history | EICAR ve hash testleri geçer |
| **M4 Toplantı** | 1:1 arama → grup toplantı, ekran paylaşımı, TURN, davet/.ics | 50 katılımcı hedefi |
| **M5 Yönetim + SIEM + HA/DR** | Admin paneli, politikalar, CEF/LEEF/syslog, retention/legal hold, HA kurulum, yedek/geri yükleme, pentest | Pilot kabul testleri |
| **V2** | Toplantı kaydı + offline transkript (GPU), Exchange takvim, macOS, mobil, E2EE-opsiyonlu 1:1 (değerlendirme) | — |

HA/DR **tasarımı** M0'da yapılır; çoklu düğüm aktif doğrulaması M5'te.

---

## 12. Açık sorular ve riskler

| # | Konu | Risk/Soru |
|---|---|---|
| 1 | Object storage | MinIO lisans/sürüm durumu → SeaweedFS/Ceph karşılaştırması |
| 2 | SFU | LiveKit self-host kapasite ve lisans doğrulaması; ekran paylaşımı kalitesi LAN/WAN |
| 3 | Şube/WAN | Şubelerde SFU yerleşimi gerekecek mi? |
| 4 | Ofis önizleme | Offline Office render çözümü (LibreOffice sandbox mi?) |
| 5 | Arama | OpenSearch (güçlü, ağır) vs Meilisearch (hafif) — Türkçe kalite PoC |
| 6 | Vault | OpenBao vs HashiCorp Vault lisansı |
| 7 | Uyum | Hedef müşteriye göre BDDK/KVKK gereksinim detayları ve log saklama süreleri |
| 8 | Kapsam | V1 çok geniş; M-aşamaları sırayla ve her aşama bağımsız teslim edilebilir olmalı |
| 9 | Kerberos SSO | Electron'da Negotiate yetkilendirme allow-list ve SPN yapılandırması doğrulanmalı |
| 11 | Guest hesapları | Misafir MFA yöntemi (air-gapped'te TOTP) ve hesap yaşam döngüsü sahibi netleşmeli |
| 10 | Pilot | Pilot müşteri ve ağ topolojisi (VLAN, güvenlik duvarı kuralları) netleşmeli |
