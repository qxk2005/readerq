package com.readerq.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.readerq.app.ReaderQApp
import com.readerq.app.api.ReadwiseClient
import com.readerq.app.data.DocumentEntity
import com.readerq.app.data.HighlightEntity
import com.readerq.app.data.SettingEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.encodeToString

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val db = (application as ReaderQApp).database
    private val docDao = db.documentDao()
    private val hlDao = db.highlightDao()
    private val settingDao = db.settingDao()

    // UI States
    private val _currentView = MutableStateFlow("new") // inbox
    val currentView: StateFlow<String> = _currentView.asStateFlow()

    private val _selectedDoc = MutableStateFlow<DocumentEntity?>(null)
    val selectedDoc: StateFlow<DocumentEntity?> = _selectedDoc.asStateFlow()

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private val _syncError = MutableStateFlow<String?>(null)
    val syncError: StateFlow<String?> = _syncError.asStateFlow()

    private val _token = MutableStateFlow<String?>(null)
    val token: StateFlow<String?> = _token.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _theme = MutableStateFlow("dark")
    val theme: StateFlow<String> = _theme.asStateFlow()

    // OpenAI settings
    private val _openaiApiKey = MutableStateFlow("")
    val openaiApiKey: StateFlow<String> = _openaiApiKey.asStateFlow()

    private val _openaiBaseUrl = MutableStateFlow("https://api.openai.com/v1")
    val openaiBaseUrl: StateFlow<String> = _openaiBaseUrl.asStateFlow()

    private val _openaiModel = MutableStateFlow("gpt-4o-mini")
    val openaiModel: StateFlow<String> = _openaiModel.asStateFlow()

    // OSS settings
    private val _ossRegion = MutableStateFlow("")
    val ossRegion: StateFlow<String> = _ossRegion.asStateFlow()

    private val _ossBucket = MutableStateFlow("")
    val ossBucket: StateFlow<String> = _ossBucket.asStateFlow()

    private val _ossAccessKeyId = MutableStateFlow("")
    val ossAccessKeyId: StateFlow<String> = _ossAccessKeyId.asStateFlow()

    private val _ossAccessKeySecret = MutableStateFlow("")
    val ossAccessKeySecret: StateFlow<String> = _ossAccessKeySecret.asStateFlow()

    private val _ossCustomDomain = MutableStateFlow("")
    val ossCustomDomain: StateFlow<String> = _ossCustomDomain.asStateFlow()

    private val _ossPathPrefix = MutableStateFlow("readerq")
    val ossPathPrefix: StateFlow<String> = _ossPathPrefix.asStateFlow()

    // Chat histories mapping: docId -> list of OpenAiMessages
    private val _chatHistories = MutableStateFlow<Map<String, List<com.readerq.app.api.OpenAiMessage>>>(emptyMap())
    val chatHistories: StateFlow<Map<String, List<com.readerq.app.api.OpenAiMessage>>> = _chatHistories.asStateFlow()

    // Load active documents based on location filter and search query
    val documents: StateFlow<List<DocumentEntity>> = combine(_currentView, _searchQuery) { view, query ->
        Pair(view, query)
    }.flatMapLatest { (view, query) ->
        val cleanQuery = "%${query.trim()}%"
        if (view == "all") {
            if (query.isBlank()) docDao.getAllDocuments() else docDao.searchAllDocuments(cleanQuery)
        } else {
            if (query.isBlank()) docDao.getDocumentsByLocation(view) else docDao.searchDocumentsByLocation(view, cleanQuery)
        }
    }
    .flowOn(Dispatchers.IO)
    .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Load highlights for currently selected document
    val highlights: StateFlow<List<HighlightEntity>> = _selectedDoc
        .flatMapLatest { doc ->
            if (doc != null) hlDao.getHighlightsForDocument(doc.id) else flowOf(emptyList())
        }
        .flowOn(Dispatchers.IO)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        viewModelScope.launch(Dispatchers.IO) {
            _token.value = settingDao.getSetting("readwise_token")?.replace("\"", "")
            _theme.value = settingDao.getSetting("theme")?.replace("\"", "") ?: "dark"
            
            _openaiApiKey.value = settingDao.getSetting("openai_api_key")?.replace("\"", "") ?: ""
            _openaiBaseUrl.value = settingDao.getSetting("openai_base_url")?.replace("\"", "") ?: "https://api.openai.com/v1"
            _openaiModel.value = settingDao.getSetting("openai_model")?.replace("\"", "") ?: "gpt-4o-mini"

            _ossRegion.value = settingDao.getSetting("oss_region")?.replace("\"", "") ?: ""
            _ossBucket.value = settingDao.getSetting("oss_bucket")?.replace("\"", "") ?: ""
            _ossAccessKeyId.value = settingDao.getSetting("oss_access_key_id")?.replace("\"", "") ?: ""
            _ossAccessKeySecret.value = settingDao.getSetting("oss_access_key_secret")?.replace("\"", "") ?: ""
            _ossCustomDomain.value = settingDao.getSetting("oss_custom_domain")?.replace("\"", "") ?: ""
            _ossPathPrefix.value = settingDao.getSetting("oss_path_prefix")?.replace("\"", "") ?: "readerq"
        }
    }

    fun selectDocument(doc: DocumentEntity?) {
        _selectedDoc.value = doc
        if (doc != null && doc.html_content == null) {
            fetchDocumentContent(doc.id)
        }
    }

    fun changeView(view: String) {
        _currentView.value = view
    }

    fun saveToken(newToken: String) {
        viewModelScope.launch(Dispatchers.IO) {
            settingDao.setSetting(SettingEntity("readwise_token", newToken))
            _token.value = newToken
        }
    }

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun toggleTheme() {
        val newTheme = if (_theme.value == "dark") "light" else "dark"
        _theme.value = newTheme
        viewModelScope.launch(Dispatchers.IO) {
            settingDao.setSetting(SettingEntity("theme", newTheme))
        }
    }

    fun saveOpenAiSettings(apiKey: String, baseUrl: String, model: String) {
        _openaiApiKey.value = apiKey
        _openaiBaseUrl.value = baseUrl
        _openaiModel.value = model
        viewModelScope.launch(Dispatchers.IO) {
            settingDao.setSetting(SettingEntity("openai_api_key", apiKey))
            settingDao.setSetting(SettingEntity("openai_base_url", baseUrl))
            settingDao.setSetting(SettingEntity("openai_model", model))
        }
    }

    fun saveOssSettings(
        region: String,
        bucket: String,
        accessKeyId: String,
        accessKeySecret: String,
        customDomain: String,
        pathPrefix: String
    ) {
        _ossRegion.value = region
        _ossBucket.value = bucket
        _ossAccessKeyId.value = accessKeyId
        _ossAccessKeySecret.value = accessKeySecret
        _ossCustomDomain.value = customDomain
        _ossPathPrefix.value = pathPrefix

        viewModelScope.launch(Dispatchers.IO) {
            settingDao.setSetting(SettingEntity("oss_region", region))
            settingDao.setSetting(SettingEntity("oss_bucket", bucket))
            settingDao.setSetting(SettingEntity("oss_access_key_id", accessKeyId))
            settingDao.setSetting(SettingEntity("oss_access_key_secret", accessKeySecret))
            settingDao.setSetting(SettingEntity("oss_custom_domain", customDomain))
            settingDao.setSetting(SettingEntity("oss_path_prefix", pathPrefix))
        }
    }

    fun sendChatMessage(docId: String, text: String, onResponse: (String) -> Unit, onError: (String) -> Unit) {
        val apiKey = _openaiApiKey.value
        val baseUrl = _openaiBaseUrl.value
        val model = _openaiModel.value

        if (apiKey.isBlank()) {
            onError("请先在设置中配置 OpenAI API Key")
            return
        }

        viewModelScope.launch(Dispatchers.IO) {
            try {
                val currentHistory = _chatHistories.value[docId] ?: emptyList()
                val newHistory = currentHistory + com.readerq.app.api.OpenAiMessage("user", text)
                
                // Update UI state immediately with user message
                _chatHistories.value = _chatHistories.value + (docId to newHistory)

                // Get document context
                val doc = docDao.getDocumentById(docId)
                val docText = doc?.html_content?.replace(Regex("<[^>]*>"), "")?.take(6000) ?: ""
                val systemPrompt = """
                    你是 ReaderQ 阅读助手（代号 GhostReader）。你的任务是帮助用户理解和分析他们正在阅读的文档。请用简体中文回答。
                    当前文档标题: ${doc?.title ?: "未知"}
                    当前文档作者: ${doc?.author ?: "未知"}
                    当前文档部分内容:
                    $docText
                """.trimIndent()

                val client = com.readerq.app.api.OpenAiClient(apiKey, baseUrl, model)
                val response = client.getCompletion(newHistory, systemPrompt)

                val updatedHistory = newHistory + com.readerq.app.api.OpenAiMessage("assistant", response)
                _chatHistories.value = _chatHistories.value + (docId to updatedHistory)

                onResponse(response)
            } catch (e: Exception) {
                e.printStackTrace()
                onError(e.message ?: "AI 回复出错")
            }
        }
    }

    fun executeAiCommand(docId: String, text: String, command: String, onResponse: (String) -> Unit, onError: (String) -> Unit) {
        val apiKey = _openaiApiKey.value
        val baseUrl = _openaiBaseUrl.value
        val model = _openaiModel.value

        if (apiKey.isBlank()) {
            onError("请先在设置中配置 OpenAI API Key")
            return
        }

        viewModelScope.launch(Dispatchers.IO) {
            try {
                val systemPrompt = when (command) {
                    "translate" -> "你是一个专业的翻译助手。请将给定的文本翻译成简体中文。翻译应自然流畅，保持原文的风格和语气。只输出翻译结果，不要添加任何解释。"
                    "simplify" -> "你是一个文本简化助手。请用简体中文将复杂的文本改写成简单易懂的语言，保持核心含义不变。使用日常用语，避免专业术语。"
                    "define" -> "你是一个知识渊博的百科助手。请用简体中文解释所给的词语或概念。回答应简洁、准确、有教育意义。"
                    else -> "你是一个有用的助手。"
                }

                val client = com.readerq.app.api.OpenAiClient(apiKey, baseUrl, model)
                val response = client.getCompletion(listOf(com.readerq.app.api.OpenAiMessage("user", text)), systemPrompt)
                onResponse(response)
            } catch (e: Exception) {
                e.printStackTrace()
                onError(e.message ?: "AI 执行出错")
            }
        }
    }

    fun clearChatHistory(docId: String) {
        _chatHistories.value = _chatHistories.value + (docId to emptyList())
    }

    // Fetch document HTML content dynamically if not loaded
    private fun fetchDocumentContent(docId: String) {
        val currentToken = _token.value ?: return
        if (currentToken == "offline") return
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val client = ReadwiseClient(currentToken)
                val response = client.listDocuments(id = docId, withHtmlContent = true)
                if (response.results.isNotEmpty()) {
                    val item = response.results[0]
                    val localDoc = docDao.getDocumentById(docId)
                    if (localDoc != null) {
                        val updated = localDoc.copy(html_content = item.html_content)
                        docDao.insertDocument(updated)
                        if (_selectedDoc.value?.id == docId) {
                            _selectedDoc.value = updated
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private suspend fun seedOfflineData() {
        if (docDao.getDocumentCount() > 0) return

        val doc1 = DocumentEntity(
            id = "offline_guide",
            url = "https://readerq.offline/guide",
            source_url = "https://readerq.offline/guide",
            title = "ReaderQ 离线使用指南",
            author = "ReaderQ 团队",
            source = "local",
            category = "article",
            location = "new",
            site_name = "ReaderQ",
            word_count = 350,
            reading_time = "2 分钟",
            created_at = System.currentTimeMillis().toString(),
            updated_at = System.currentTimeMillis().toString(),
            published_date = null,
            summary = "本文档介绍了如何在纯离线模式下使用 ReaderQ Android 版，以及对折叠屏自适应布局的说明。",
            notes = "本地离线指南文档",
            image_url = null,
            reading_progress = 0f,
            html_content = """
                <h1>欢迎使用 ReaderQ 纯离线 Android 版</h1>
                <p>这是一个完全在您手机本地运行的阅读辅助工具。在离线模式下，您的所有数据（高亮、笔记、标签）均保存在手机的本地 Room 数据库中，绝对不会上传到任何云端服务器，保障您的隐私安全。</p>
                <p><strong>支持折叠屏：</strong>当您在折叠屏或平板设备上使用时，展开手机即可切换为宽屏双栏布局（左侧列表，右侧正文），折叠后自动切换回单栏视图，且自动保留您的阅读位置，实现无缝切换体验。</p>
                <h2>主要功能特点</h2>
                <ul>
                    <li>支持选中文字创建高亮</li>
                    <li>支持在正文右侧编辑文档笔记</li>
                    <li>多色高亮标注与笔记管理</li>
                </ul>
            """.trimIndent(),
            tags_json = "{\"离线\": 1, \"指南\": 1}",
            synced_at = System.currentTimeMillis().toString()
        )

        val doc2 = DocumentEntity(
            id = "foldable_design",
            url = "https://readerq.offline/foldable_design",
            source_url = "https://readerq.offline/foldable_design",
            title = "折叠屏手机的交互设计演进",
            author = "Android Dev",
            source = "local",
            category = "article",
            location = "new",
            site_name = "Android",
            word_count = 420,
            reading_time = "3 分钟",
            created_at = System.currentTimeMillis().toString(),
            updated_at = System.currentTimeMillis().toString(),
            published_date = null,
            summary = "随着柔性屏技术的成熟，折叠屏手机已从概念产品走向大众市场。折叠屏为用户带来了全新的多任务与大屏体验，但也对软件的自适应布局提出了更高的要求。",
            notes = "关于折叠屏交互设计的参考文章",
            image_url = null,
            reading_progress = 0f,
            html_content = """
                <h1>折叠屏手机的交互设计演进</h1>
                <p>随着柔性屏技术的成熟，折叠屏手机已从概念产品走向大众市场。折叠屏为用户带来了全新的多任务与大屏体验，但同时也对软件的自适应布局提出了更高的要求。</p>
                <p>典型的折叠屏交互设计需要解决以下核心问题：</p>
                <h3>1. 屏幕连续性 (Activity Continuity)</h3>
                <p>当用户在折叠态和展开态之间切换时，应用应该无缝过渡，保留当前的页面状态、输入内容和滚动位置。这就是为什么在 Compose 中我们需要妥善管理 WebView 的生命周期，防止其因布局重构而被销毁。</p>
                <h3>2. 响应式与自适应布局</h3>
                <p>在展开的大屏上，三栏式或双栏式布局能最大化利用屏幕空间；而在外屏的狭窄空间内，单栏列表则是更合适的选择。</p>
            """.trimIndent(),
            tags_json = "{\"折叠屏\": 1, \"设计\": 1}",
            synced_at = System.currentTimeMillis().toString()
        )

        docDao.insertAll(listOf(doc1, doc2))
    }

    // Perform full sync
    fun startSync() {
        val currentToken = _token.value
        if (currentToken.isNullOrBlank()) {
            _syncError.value = "请先配置 Readwise Token"
            return
        }
        if (_isSyncing.value) return

        _isSyncing.value = true
        _syncError.value = null

        if (currentToken == "offline") {
            viewModelScope.launch(Dispatchers.IO) {
                try {
                    seedOfflineData()
                } catch (e: Exception) {
                    e.printStackTrace()
                    _syncError.value = e.message ?: "初始化数据失败"
                } finally {
                    _isSyncing.value = false
                }
            }
            return
        }

        viewModelScope.launch(Dispatchers.IO) {
            try {
                val client = ReadwiseClient(currentToken)
                var pageCursor: String? = null
                
                // Fetch all documents incrementally
                do {
                    val response = client.listDocuments(pageCursor = pageCursor)
                    val entities = response.results.map { item ->
                        DocumentEntity(
                            id = item.id,
                            url = item.url,
                            source_url = item.source_url,
                            title = item.title,
                            author = item.author,
                            source = item.source,
                            category = item.category,
                            location = item.location,
                            site_name = item.site_name,
                            word_count = item.word_count,
                            reading_time = item.reading_time,
                            created_at = item.created_at,
                            updated_at = item.updated_at,
                            published_date = item.published_date,
                            summary = item.summary,
                            notes = item.notes,
                            image_url = item.image_url,
                            reading_progress = item.reading_progress,
                            html_content = null, // load on demand
                            tags_json = Json.encodeToString(item.tags.mapValues { 1 }),
                            synced_at = System.currentTimeMillis().toString()
                        )
                    }
                    docDao.insertAll(entities)
                    pageCursor = response.nextPageCursor
                } while (pageCursor != null)

            } catch (e: Exception) {
                e.printStackTrace()
                _syncError.value = e.message ?: "同步失败"
            } finally {
                _isSyncing.value = false
            }
        }
    }

    // Highlighting - Create
    fun addHighlight(text: String, note: String? = null, color: String = "yellow", location: Int = 0) {
        val doc = _selectedDoc.value ?: return
        val currentToken = _token.value ?: return

        viewModelScope.launch(Dispatchers.IO) {
            val localId = "local_" + System.currentTimeMillis()
            val localHl = HighlightEntity(
                id = localId,
                document_id = doc.id,
                text = text,
                note = note,
                color = color,
                location = location,
                readwise_highlight_id = null,
                tags_json = "[]"
            )
            // Insert local first (Optimistic update)
            hlDao.insertHighlight(localHl)

            if (currentToken == "offline") {
                val finalId = "offline_" + System.currentTimeMillis()
                hlDao.deleteHighlight(localId)
                hlDao.insertHighlight(localHl.copy(id = finalId, readwise_highlight_id = finalId))
                return@launch
            }

            try {
                val client = ReadwiseClient(currentToken)
                val response = client.createHighlight(
                    text = text,
                    title = doc.title,
                    sourceUrl = doc.source_url ?: doc.url,
                    note = note,
                    location = location
                )
                if (response.isNotEmpty() && response[0].modified_highlights.isNotEmpty()) {
                    val remoteId = response[0].modified_highlights[0].toString()
                    // Update with remote ID
                    hlDao.deleteHighlight(localId)
                    hlDao.insertHighlight(localHl.copy(id = remoteId, readwise_highlight_id = remoteId))
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    // Highlighting - Update Note / Tags
    fun updateHighlight(hlId: String, note: String?, tags: List<String>) {
        val currentToken = _token.value ?: return
        viewModelScope.launch(Dispatchers.IO) {
            val local = hlDao.getHighlightById(hlId) ?: return@launch
            val updated = local.copy(note = note, tags_json = Json.encodeToString(tags))
            hlDao.insertHighlight(updated)

            if (currentToken == "offline") return@launch

            try {
                val client = ReadwiseClient(currentToken)
                if (local.readwise_highlight_id != null) {
                    client.patchHighlight(local.readwise_highlight_id, note)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    // Highlighting - Delete
    fun deleteHighlight(hlId: String) {
        val currentToken = _token.value ?: return
        viewModelScope.launch(Dispatchers.IO) {
            val local = hlDao.getHighlightById(hlId) ?: return@launch
            hlDao.deleteHighlight(hlId)

            if (currentToken == "offline") return@launch

            try {
                val client = ReadwiseClient(currentToken)
                if (local.readwise_highlight_id != null) {
                    client.deleteHighlight(local.readwise_highlight_id)
                } else {
                    val doc = docDao.getDocumentById(local.document_id)
                    val url = doc?.source_url ?: doc?.url
                    if (url != null) {
                        client.findAndDeleteHighlight(local.text, url)
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    // Update document note and tags
    fun updateDocumentMetadata(notes: String?, tags: List<String>) {
        val doc = _selectedDoc.value ?: return
        val currentToken = _token.value ?: return

        viewModelScope.launch(Dispatchers.IO) {
            val updated = doc.copy(notes = notes, tags_json = Json.encodeToString(tags.associateWith { 1 }))
            docDao.insertDocument(updated)
            _selectedDoc.value = updated

            if (currentToken == "offline") return@launch

            try {
                val client = ReadwiseClient(currentToken)
                client.updateDocument(doc.id, notes = notes, tags = tags)
                val url = doc.source_url ?: doc.url
                client.syncDocumentTagsV2(url, tags)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
