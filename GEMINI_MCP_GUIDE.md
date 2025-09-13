# Gemini MCP Kullanım Rehberi

## 🚨 KRİTİK HATIRLATMALAR

### 1. GOOGLE_API_KEY SORUNUNU ASLA UNUTMA!
- **PROBLEM**: GOOGLE_API_KEY ve GEMINI_API_KEY ikisi de set olduğunda "Both GOOGLE_API_KEY and GEMINI_API_KEY are set" uyarısı geliyor
- **ÇÖZÜM**: GOOGLE_API_KEY'i tamamen sistemden sil, sadece GEMINI_API_KEY kullan
- **KONTROL**: `env | grep -E "(GOOGLE|GEMINI)_API_KEY"` ile kontrol et
- **KALICI ÇÖZÜM**: ~/.zshrc'den GOOGLE_API_KEY satırını sil

### 2. MCP CONTEXT SIFIRLAMA SORUNU
- **PROBLEM**: Her MCP tool call'da Gemini yeni session açıyor, önceki context'i kaybediyor
- **ÇÖZÜM**: Chat save/resume sistemi kullan
- **IMPLEMENTASYON**: GeminiChatManager class'ı oluşturuldu
- **AKIŞ**: `/chat resume lexical-mcp-main` → task → `/chat save lexical-mcp-main`

### 3. TIMEOUT SORUNLARI
- **PROBLEM**: MCP calls sürekli timeout alıyor
- **NEDEN**: Gemini 8 saniyede bitiriyor ama sistem 60+ saniye bekliyor
- **ÇÖZÜM**: Smart completion detection + process close event
- **SÜRE**: 0.2 saniye early detection + process close garantisi

## 📁 DOSYA YAPISI

### Oluşturulan Yeni Dosyalar:
```
src/utils/gemini-chat-manager.js    # Chat persistence manager
src/utils/health-check.js           # System health monitoring
src/utils/progress-reporter.js      # Task progress tracking
src/utils/session-manager.js        # Session state management
src/cli/universal-cli.js            # Universal CLI wrapper
src/orchestrator/multi-agent-orchestrator.js  # Multi-agent system
src/orchestrator/agent-registry.js  # Agent management
src/workflow/workflow-engine.js     # Workflow processing
config/workflows/built-in.js        # Built-in workflows
.gemini-context.md                  # Context file for Gemini
```

### Güncellenen Dosyalar:
```
src/mcp-servers/gemini-executor-server.js  # MCP server with chat manager
src/mcp-servers/universal-mcp-server.js    # New universal MCP server
```

## 🔧 MCP SERVER RESTART PROSEDÜRİ

**ÖNEMLI**: Her kod değişikliğinden sonra:
1. `pkill -f "gemini-executor-server"`
2. `node src/mcp-servers/gemini-executor-server.js &`
3. User'a **"MCP SERVER RESTART YAPILDI - Lütfen `/mcp` komutu ile yeniden bağlanın!"** mesajı ver

## 🎯 TEST SÜRECI

### Context Persistence Testi:
1. `Remember: Test name is [something]`
2. Başka bir MCP call yap
3. `What was my test name?`
4. Eğer hatırlıyorsa ✅ SUCCESS

### Performance Testi:
- `time (echo "What is 2+2?" | gemini --yolo)` ile gerçek süreyi ölç
- MCP call süresini karşılaştır
- 10+ saniye fark varsa system'de problem var

## 🚀 ÇALIŞAN SİSTEM ÖZETİ

### Chat Persistence (✅ ÇALIŞIYOR):
```javascript
// Her MCP call:
1. /chat resume lexical-mcp-main  (önceki context)
2. Actual task execution         (görev)
3. /chat save lexical-mcp-main   (context kaydet)
```

### Smart Completion (✅ ÇALIŞIYOR):
- Process close event öncelikli
- 0.2 saniye early detection
- Natural output pattern detection
- 3 dakika emergency timeout

### Environment Clean (✅ ÇALIŞIYOR):
```javascript
// spawn'da clean environment:
const cleanEnv = { ...process.env };
delete cleanEnv.GOOGLE_API_KEY;
```

## ⚠️ YAYGIL HATALAR

1. **"Both API KEY" mesajını göz ardı etme** - Bu her zaman düzeltilmeli
2. **Context'i test etmeden başarılı sayma** - Mutlaka persistence test et
3. **MCP restart sonrası bağlantı kontrol etmeme** - User'ın reconnect yapmasını bekle
4. **Timeout süreleri için yanlış pattern kullanma** - API key messages'e bağımlı olma

## 🔍 DEBUGGING KOMUTLARI

```bash
# Environment kontrol
env | grep -E "(GOOGLE|GEMINI)_API_KEY"

# MCP server durumu
ps aux | grep gemini-executor

# Gemini chat sessions
ls -la ~/.gemini/tmp/*/chats/

# Direct Gemini test
time (echo "test" | gemini --yolo)
```

## 📊 BAŞARI KRİTERLERİ

- ✅ Context korunuyor (test ile doğrula)
- ✅ 8-10 saniye response süresi
- ✅ GOOGLE_API_KEY uyarısı yok
- ✅ MCP calls hızlı dönüyor
- ✅ Memory test başarılı

## 🎯 GÜNCEL DURUM

**Son Test**: TestUser123 ismi 2 ayrı MCP call'da hatırlandı
**Context**: ✅ ÇALIŞIYOR
**Performance**: ✅ HıZLI
**Environment**: ✅ TEMİZ

Bu rehberi her context sıfırlanmasında oku!