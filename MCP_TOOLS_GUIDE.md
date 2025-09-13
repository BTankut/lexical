# 🛠️ MCP Tools Kullanım Rehberi

## 📋 Tüm Tool'ların Listesi ve Amaçları

### 1. **list_agents**
**Amaç:** Sistemde kullanılabilir agent'ları listeler
**Ne zaman kullanılır:** Hangi agent'ların mevcut olduğunu görmek için
**Örnek Kullanım:**
```javascript
mcp__lexical-universal__list_agents()
// Dönen: { agents: [{name: 'claude', capabilities: [...]}, {name: 'gemini', ...}] }
```

### 2. **list_workflows**
**Amaç:** Önceden tanımlı workflow'ları listeler
**Ne zaman kullanılır:** Hangi çalışma akışlarının kullanılabileceğini görmek için
**Örnek Kullanım:**
```javascript
mcp__lexical-universal__list_workflows()
// Dönen: { workflows: [{name: 'direct', description: '...'}, {name: 'plan-execute', ...}] }
```

### 3. **execute_code** (Legacy)
**Amaç:** Gemini ile kod üretir
**Ne zaman kullanılır:** Hızlı kod üretimi için
**Örnek Kullanım:**
```javascript
mcp__lexical-universal__execute_code({
  prompt: "Write a Python function to calculate factorial"
})
// Dönen: { success: true, code: "...", message: "Code generated successfully" }
```

### 4. **execute_task** (Legacy)
**Amaç:** Herhangi bir görevi Gemini ile çalıştırır
**Ne zaman kullanılır:** Genel amaçlı görevler için
**Örnek Kullanım:**
```javascript
mcp__lexical-universal__execute_task({
  task: {
    prompt: "Explain quantum computing",
    id: "task_123" // optional
  }
})
// Dönen: { success: true, result: "...", taskId: "task_123" }
```

### 5. **save_chat_session**
**Amaç:** Gemini chat oturumunu kaydeder
**Ne zaman kullanılır:** Context'i korumak için görev sonrası
**Örnek Kullanım:**
```javascript
mcp__lexical-universal__save_chat_session()
// Dönen: true/false
```

### 6. **resume_chat_session**
**Amaç:** Önceki chat oturumunu geri yükler
**Ne zaman kullanılır:** Context'i geri getirmek için görev öncesi
**Örnek Kullanım:**
```javascript
mcp__lexical-universal__resume_chat_session()
// Dönen: true/false
```

### 7. **orchestrate** ⭐ (Yeni)
**Amaç:** Akıllı agent ve workflow seçimi ile görevi işler
**Ne zaman kullanılır:** Otomatik optimizasyon istediğinizde
**Örnek Kullanım:**
```javascript
mcp__lexical-universal__orchestrate({
  prompt: "Create a REST API with authentication",
  preferences: {
    agent: "gemini",     // optional: 'claude', 'gemini', 'auto'
    workflow: "direct"   // optional: 'direct', 'plan-execute'
  }
})
// Dönen: { success: true, result: "...", agent: "gemini", workflow: "direct" }
```

### 8. **orchestrate_workflow** ⭐ (Yeni)
**Amaç:** Belirli bir workflow ile görevi çalıştırır
**Ne zaman kullanılır:** Spesifik çalışma akışı istediğinizde
**Örnek Kullanım:**
```javascript
mcp__lexical-universal__orchestrate_workflow({
  workflow: "plan-execute",  // 'direct', 'plan-execute', 'competitive', 'iterative'
  input: "Build a todo app",
  context: { language: "Python" },  // optional
  overrides: { timeout: 60000 }     // optional
})
// Dönen: { success: true, workflow: "plan-execute", result: {...}, duration: 5000 }
```

### 9. **orchestrate_parallel** ⭐ (Yeni)
**Amaç:** Birden fazla agent'ı paralel çalıştırır
**Ne zaman kullanılır:** Hız veya karşılaştırma için
**Örnek Kullanım:**
```javascript
mcp__lexical-universal__orchestrate_parallel({
  prompt: "Write a sorting algorithm",
  agents: ["claude", "gemini"],
  mode: "all",        // 'race' (ilk biten), 'all' (hepsi), 'vote' (oylama)
  role: "executor"    // optional
})
// Dönen: { success: true, mode: "all", agents: [...], results: [...] }
```

### 10. **get_capabilities** ⭐ (Yeni)
**Amaç:** Görev için en uygun agent'ı önerir
**Ne zaman kullanılır:** Agent seçimi için analiz gerektiğinde
**Örnek Kullanım:**
```javascript
mcp__lexical-universal__get_capabilities({
  task: "Debug JavaScript code",
  requirements: {
    language: "javascript",
    complexity: "high"
  }
})
// Dönen: { task: "...", recommendations: [{agent: "claude", score: 95, reasons: [...]}] }
```

### 11. **get_process_stats** ⭐ (Yeni)
**Amaç:** Sistem process durumunu gösterir
**Ne zaman kullanılır:** Performans monitoring için
**Örnek Kullanım:**
```javascript
mcp__lexical-universal__get_process_stats()
// Dönen: {
//   monitoring: { active: true, ... },
//   processes: [{pid: 123, name: "gemini-chat", ...}],
//   summary: { totalActiveProcesses: 2, systemHealth: "good" }
// }
```

## 🎯 Kullanım Senaryoları

### Senaryo 1: Basit Kod Üretimi
```javascript
// Hızlı ve direkt
execute_code({ prompt: "Python fibonacci function" })
```

### Senaryo 2: Planlı Proje Geliştirme
```javascript
// Claude planlar, Gemini uygular
orchestrate_workflow({
  workflow: "plan-execute",
  input: "Create a blog platform with user authentication"
})
```

### Senaryo 3: Karşılaştırmalı Çözüm
```javascript
// İki agent'ı karşılaştır
orchestrate_parallel({
  prompt: "Optimize this SQL query",
  agents: ["claude", "gemini"],
  mode: "all"
})
```

### Senaryo 4: Context Korumalı Çalışma
```javascript
// 1. Resume context
resume_chat_session()

// 2. Execute task
execute_task({ task: { prompt: "Continue the previous implementation" }})

// 3. Save context
save_chat_session()
```

### Senaryo 5: İteratif İyileştirme
```javascript
orchestrate_workflow({
  workflow: "iterative",
  input: "Refactor this legacy code",
  context: { maxIterations: 3 }
})
```

## 🔄 Workflow Tipleri

### **direct**
- Tek adımda çalıştırma
- En hızlı yöntem
- Basit görevler için ideal

### **plan-execute**
- İki aşamalı: Planlama + Uygulama
- Claude planlar, Gemini uygular
- Karmaşık projeler için ideal

### **competitive**
- Paralel execution
- En iyi sonucu seçme
- Kalite odaklı görevler için

### **iterative**
- Execute → Review → Refine döngüsü
- Sürekli iyileştirme
- Mükemmeliyetçi görevler için

## 📊 Agent Yetenekleri

### **Claude**
- ✅ Planlama (95%)
- ✅ Code review (90%)
- ✅ Dokümantasyon
- ✅ Mimari tasarım
- Context: 200K token

### **Gemini**
- ✅ Hızlı execution (95%)
- ✅ Kod üretimi
- ✅ Pratik çözümler
- ✅ Chat persistence
- Context: 1M token

## ⚡ Performance İpuçları

1. **Basit görevler** → `execute_code` veya `execute_task`
2. **Karmaşık projeler** → `orchestrate_workflow` ile plan-execute
3. **Hız kritik** → `orchestrate_parallel` ile race mode
4. **Kalite kritik** → `orchestrate_parallel` ile all mode + vote
5. **Context önemli** → Her zaman `save/resume_chat_session` kullan

## 🚨 Önemli Notlar

- **Context Management**: Gemini her MCP call'da context kaybeder, `save/resume` kullanın
- **Timeout**: Process monitor 50% CPU'da uyarır, 5 dakikada timeout
- **Workflow Selection**: Emin değilseniz `orchestrate` otomatik seçim yapar
- **Legacy Tools**: `execute_code` ve `execute_task` geriye uyumluluk için

## 🔧 Troubleshooting

### "Gemini command failed"
- Process monitor runaway algılamış olabilir
- CPU kullanımını kontrol edin: `get_process_stats()`

### "Context lost"
- `resume_chat_session()` kullanmayı unutmuş olabilirsiniz
- Her görev öncesi resume, sonrası save yapın

### "Workflow not found"
- Built-in workflow'ları kontrol edin: `list_workflows()`
- Workflow adını doğru yazdığınızdan emin olun

## 📈 Best Practices

1. **Her zaman context koru**: Resume → Execute → Save
2. **Doğru workflow seç**: Görev karmaşıklığına göre
3. **Process monitor'ü izle**: `get_process_stats()` ile
4. **Agent yeteneklerini kullan**: `get_capabilities()` ile analiz
5. **Paralel çalıştır**: Zaman kritikse `orchestrate_parallel()`

---
*Bu rehber Universal MCP Server v2.0 için hazırlanmıştır*