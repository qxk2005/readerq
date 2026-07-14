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
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.encodeToString
import com.readerq.app.api.HighlightImage
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.serialization.kotlinx.json.json
import io.ktor.client.call.body

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val db = (application as ReaderQApp).database
    private val docDao = db.documentDao()
    private val hlDao = db.highlightDao()
    private val settingDao = db.settingDao()

    private var syncJob: Job? = null

    // UI States
    private val _currentView = MutableStateFlow("new") // inbox
    val currentView: StateFlow<String> = _currentView.asStateFlow()

    private val _currentTab = MutableStateFlow("library") // library, feed, notebook, settings
    val currentTab: StateFlow<String> = _currentTab.asStateFlow()

    private val _selectedDoc = MutableStateFlow<DocumentEntity?>(null)
    val selectedDoc: StateFlow<DocumentEntity?> = _selectedDoc.asStateFlow()

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private val _syncStatus = MutableStateFlow("idle")
    val syncStatus: StateFlow<String> = _syncStatus.asStateFlow()

    private val _syncProgress = MutableStateFlow<SyncProgress?>(null)
    val syncProgress: StateFlow<SyncProgress?> = _syncProgress.asStateFlow()

    private val _syncCounts = MutableStateFlow(SyncCounts(0, 0, null))
    val syncCounts: StateFlow<SyncCounts> = _syncCounts.asStateFlow()

    private val _syncError = MutableStateFlow<String?>(null)
    val syncError: StateFlow<String?> = _syncError.asStateFlow()

    private val _token = MutableStateFlow<String?>(null)
    val token: StateFlow<String?> = _token.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _theme = MutableStateFlow("dark")
    val theme: StateFlow<String> = _theme.asStateFlow()

    // Category & Tag filter states
    private val _selectedCategory = MutableStateFlow<String?>(null)
    val selectedCategory: StateFlow<String?> = _selectedCategory.asStateFlow()

    private val _selectedTag = MutableStateFlow<String?>(null)
    val selectedTag: StateFlow<String?> = _selectedTag.asStateFlow()

    private data class DocFilter(val view: String, val query: String, val category: String?, val tag: String?)

    // Appearance settings
    private val _fontSize = MutableStateFlow(16)
    val fontSize: StateFlow<Int> = _fontSize.asStateFlow()

    private val _fontFamily = MutableStateFlow("sans")
    val fontFamily: StateFlow<String> = _fontFamily.asStateFlow()

    private val _lineHeight = MutableStateFlow(1.6f)
    val lineHeight: StateFlow<Float> = _lineHeight.asStateFlow()

    private val _contentWidth = MutableStateFlow(700)
    val contentWidth: StateFlow<Int> = _contentWidth.asStateFlow()

    // Sidebar Drag & Collapse States
    private val _sidebarWidthDp = MutableStateFlow(360f)
    val sidebarWidthDp: StateFlow<Float> = _sidebarWidthDp.asStateFlow()

    private val _isSidebarCollapsed = MutableStateFlow(false)
    val isSidebarCollapsed: StateFlow<Boolean> = _isSidebarCollapsed.asStateFlow()

    // Detail Pane Toggling & Width States
    private val _detailPaneType = MutableStateFlow<String?>(null)
    val detailPaneType: StateFlow<String?> = _detailPaneType.asStateFlow()

    private val _detailPaneWidthDp = MutableStateFlow(320f)
    val detailPaneWidthDp: StateFlow<Float> = _detailPaneWidthDp.asStateFlow()

    private val _isDetailPaneCollapsed = MutableStateFlow(true)
    val isDetailPaneCollapsed: StateFlow<Boolean> = _isDetailPaneCollapsed.asStateFlow()

    // Highlight Synchronization and Navigation Flows
    private val _scrollToHighlightEvent = MutableSharedFlow<String>(extraBufferCapacity = 1)
    val scrollToHighlightEvent = _scrollToHighlightEvent.asSharedFlow()

    private val _scrollNotebookToHighlightEvent = MutableSharedFlow<String>(extraBufferCapacity = 1)
    val scrollNotebookToHighlightEvent = _scrollNotebookToHighlightEvent.asSharedFlow()

    fun triggerScrollToHighlight(hlId: String) {
        viewModelScope.launch {
            _scrollToHighlightEvent.emit(hlId)
        }
    }

    fun onHighlightClickedFromWeb(hlId: String) {
        viewModelScope.launch {
            _scrollNotebookToHighlightEvent.emit(hlId)
        }
    }

    // OpenAI settings
    private val _openaiApiKey = MutableStateFlow("")
    val openaiApiKey: StateFlow<String> = _openaiApiKey.asStateFlow()

    private val _openaiBaseUrl = MutableStateFlow("https://api.openai.com/v1")
    val openaiBaseUrl: StateFlow<String> = _openaiBaseUrl.asStateFlow()

    private val _openaiModel = MutableStateFlow("gpt-4o-mini")
    val openaiModel: StateFlow<String> = _openaiModel.asStateFlow()

    private val _openaiMaxTokens = MutableStateFlow(4096)
    val openaiMaxTokens: StateFlow<Int> = _openaiMaxTokens.asStateFlow()

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

    // API Test States
    private val _testStages = MutableStateFlow<List<TestStage>?>(null)
    val testStages: StateFlow<List<TestStage>?> = _testStages.asStateFlow()

    private val _testResult = MutableStateFlow<TestResult?>(null)
    val testResult: StateFlow<TestResult?> = _testResult.asStateFlow()

    private val _testLoading = MutableStateFlow(false)
    val testLoading: StateFlow<Boolean> = _testLoading.asStateFlow()

    // OSS Test States
    private val _ossTestResult = MutableStateFlow<OssTestResult?>(null)
    val ossTestResult: StateFlow<OssTestResult?> = _ossTestResult.asStateFlow()

    private val _ossTestLoading = MutableStateFlow(false)
    val ossTestLoading: StateFlow<Boolean> = _ossTestLoading.asStateFlow()

    // Changelog States
    private val _githubReleases = MutableStateFlow<List<GitHubRelease>>(emptyList())
    val githubReleases: StateFlow<List<GitHubRelease>> = _githubReleases.asStateFlow()

    private val _changelogLoading = MutableStateFlow(false)
    val changelogLoading: StateFlow<Boolean> = _changelogLoading.asStateFlow()

    private val _changelogError = MutableStateFlow<String?>(null)
    val changelogError: StateFlow<String?> = _changelogError.asStateFlow()

    // Chat histories mapping: docId -> list of OpenAiMessages
    private val _chatHistories = MutableStateFlow<Map<String, List<com.readerq.app.api.OpenAiMessage>>>(emptyMap())
    val chatHistories: StateFlow<Map<String, List<com.readerq.app.api.OpenAiMessage>>> = _chatHistories.asStateFlow()

    // Load active documents based on location filter, search query, category, and tag filters
    val documents: StateFlow<List<DocumentEntity>> = combine(
        _currentView, 
        _searchQuery, 
        _selectedCategory, 
        _selectedTag
    ) { view, query, category, tag ->
        DocFilter(view, query, category, tag)
    }.flatMapLatest { filter ->
        val cleanQuery = "%${filter.query.trim()}%"
        val docsFlow = if (filter.view == "all") {
            if (filter.query.isBlank()) docDao.getAllDocuments() else docDao.searchAllDocuments(cleanQuery)
        } else {
            if (filter.query.isBlank()) docDao.getDocumentsByLocation(filter.view) else docDao.searchDocumentsByLocation(filter.view, cleanQuery)
        }
        docsFlow.map { list ->
            var filtered = list
            if (filter.category != null) {
                filtered = filtered.filter { it.category?.lowercase() == filter.category.lowercase() }
            }
            if (filter.tag != null) {
                filtered = filtered.filter { doc ->
                    val tagsMap = try {
                        doc.tags_json?.let { Json.decodeFromString<Map<String, Int>>(it) } ?: emptyMap()
                    } catch (e: Exception) {
                        emptyMap()
                    }
                    tagsMap.containsKey(filter.tag)
                }
            }
            filtered
        }
    }
    .flowOn(Dispatchers.IO)
    .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Live counts of documents grouped by category
    val categoryCounts: StateFlow<Map<String, Int>> = docDao.getAllDocuments()
        .map { list ->
            val counts = mutableMapOf<String, Int>()
            list.forEach { doc ->
                val cat = doc.category?.lowercase() ?: ""
                if (cat.isNotEmpty()) {
                    counts[cat] = counts.getOrDefault(cat, 0) + 1
                }
            }
            counts
        }
        .flowOn(Dispatchers.IO)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    // Live list of all tags present in the documents database
    val allTags: StateFlow<List<String>> = docDao.getAllDocuments()
        .map { list ->
            val tagsSet = mutableSetOf<String>()
            list.forEach { doc ->
                try {
                    doc.tags_json?.let {
                        val tagsMap = Json.decodeFromString<Map<String, Int>>(it)
                        tagsSet.addAll(tagsMap.keys)
                    }
                } catch (e: Exception) {}
            }
            tagsSet.sorted()
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

    // Load documents that contain highlights
    val documentsWithHighlights: StateFlow<List<DocumentEntity>> = docDao.getDocumentsWithHighlights()
        .flowOn(Dispatchers.IO)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        viewModelScope.launch(Dispatchers.IO) {
            _token.value = settingDao.getSetting("readwise_token")?.replace("\"", "")
            _theme.value = settingDao.getSetting("theme")?.replace("\"", "") ?: "dark"

            _fontSize.value = settingDao.getSetting("fontSize")?.replace("\"", "")?.toIntOrNull() ?: 16
            _fontFamily.value = settingDao.getSetting("fontFamily")?.replace("\"", "") ?: "sans"
            _lineHeight.value = settingDao.getSetting("lineHeight")?.replace("\"", "")?.toFloatOrNull() ?: 1.6f
            _contentWidth.value = settingDao.getSetting("contentWidth")?.replace("\"", "")?.toIntOrNull() ?: 700
            
            _sidebarWidthDp.value = settingDao.getSetting("sidebar_width")?.replace("\"", "")?.toFloatOrNull() ?: 360f
            _isSidebarCollapsed.value = settingDao.getSetting("sidebar_collapsed")?.replace("\"", "")?.toBooleanStrictOrNull() ?: false
            
            _openaiApiKey.value = settingDao.getSetting("openai_api_key")?.replace("\"", "") ?: ""
            _openaiBaseUrl.value = settingDao.getSetting("openai_base_url")?.replace("\"", "") ?: "https://api.openai.com/v1"
            _openaiModel.value = settingDao.getSetting("openai_model")?.replace("\"", "") ?: "gpt-4o-mini"
            _openaiMaxTokens.value = settingDao.getSetting("openai_max_tokens")?.replace("\"", "")?.toIntOrNull() ?: 4096

            _ossRegion.value = settingDao.getSetting("oss_region")?.replace("\"", "") ?: ""
            _ossBucket.value = settingDao.getSetting("oss_bucket")?.replace("\"", "") ?: ""
            _ossAccessKeyId.value = settingDao.getSetting("oss_access_key_id")?.replace("\"", "") ?: ""
            _ossAccessKeySecret.value = settingDao.getSetting("oss_access_key_secret")?.replace("\"", "") ?: ""
            _ossCustomDomain.value = settingDao.getSetting("oss_custom_domain")?.replace("\"", "") ?: ""
            _ossPathPrefix.value = settingDao.getSetting("oss_path_prefix")?.replace("\"", "") ?: "readerq"

            val lastSync = settingDao.getSetting("lastDocumentSync")?.replace("\"", "")
            val remoteCount = settingDao.getSetting("remote_doc_count")?.replace("\"", "")?.toIntOrNull() ?: 0
            val localCount = docDao.getDocumentCount()
            _syncCounts.value = SyncCounts(local = localCount, remote = remoteCount, lastSync = lastSync)
        }
    }

    fun selectDocument(doc: DocumentEntity?) {
        // 切换文档时停止 TTS 播放
        if (_selectedDoc.value?.id != doc?.id) {
            stopTts()
        }
        _selectedDoc.value = doc
        if (doc != null && doc.html_content == null) {
            fetchDocumentContent(doc.id)
        }
    }

    fun changeView(view: String) {
        _currentView.value = view
    }

    fun changeTab(tab: String) {
        _currentTab.value = tab
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

    fun selectCategory(category: String?) {
        _selectedCategory.value = category
        _selectedTag.value = null
        _currentView.value = "all"
        _currentTab.value = "library"
    }

    fun selectTag(tag: String?) {
        _selectedTag.value = tag
        _selectedCategory.value = null
        _currentView.value = "all"
        _currentTab.value = "library"
    }

    fun clearFilters() {
        _selectedCategory.value = null
        _selectedTag.value = null
    }

    fun toggleTheme() {
        val newTheme = when (_theme.value) {
            "light" -> "sepia"
            "sepia" -> "dark"
            else -> "light"
        }
        _theme.value = newTheme
        viewModelScope.launch(Dispatchers.IO) {
            settingDao.setSetting(SettingEntity("theme", newTheme))
        }
    }

    fun setTheme(newTheme: String) {
        _theme.value = newTheme
        viewModelScope.launch(Dispatchers.IO) {
            settingDao.setSetting(SettingEntity("theme", newTheme))
        }
    }

    fun archiveDocument(docId: String) {
        viewModelScope.launch(Dispatchers.IO) {
            val doc = docDao.getDocumentById(docId) ?: return@launch
            val nowStr = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }.format(java.util.Date())
            val updated = doc.copy(location = "archive", updated_at = nowStr)
            docDao.insertDocument(updated)
            if (_selectedDoc.value?.id == docId) {
                _selectedDoc.value = updated
            }
            
            val currentToken = _token.value ?: return@launch
            if (currentToken != "offline") {
                try {
                    val client = ReadwiseClient(currentToken)
                    client.updateDocument(docId, location = "archive")
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    fun deleteDocument(docId: String) {
        viewModelScope.launch(Dispatchers.IO) {
            val doc = docDao.getDocumentById(docId) ?: return@launch
            val nowStr = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }.format(java.util.Date())
            val updated = doc.copy(location = "trash", updated_at = nowStr)
            docDao.insertDocument(updated)
            if (_selectedDoc.value?.id == docId) {
                _selectedDoc.value = updated
            }
            
            val currentToken = _token.value ?: return@launch
            if (currentToken != "offline") {
                try {
                    val client = ReadwiseClient(currentToken)
                    client.deleteDocument(docId)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    fun restoreDocument(docId: String) {
        viewModelScope.launch(Dispatchers.IO) {
            val doc = docDao.getDocumentById(docId) ?: return@launch
            val nowStr = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }.format(java.util.Date())
            val updated = doc.copy(location = "new", updated_at = nowStr)
            docDao.insertDocument(updated)
            if (_selectedDoc.value?.id == docId) {
                _selectedDoc.value = updated
            }
        }
    }

    fun permanentlyDeleteDocument(docId: String) {
        viewModelScope.launch(Dispatchers.IO) {
            docDao.deleteDocument(docId)
            hlDao.deleteHighlightsForDocument(docId)
            if (_selectedDoc.value?.id == docId) {
                _selectedDoc.value = null
            }
            val currentToken = _token.value ?: return@launch
            if (currentToken != "offline") {
                try {
                    val client = ReadwiseClient(currentToken)
                    client.deleteDocument(docId)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    fun saveOpenAiSettings(apiKey: String, baseUrl: String, model: String, maxTokens: Int) {
        _openaiApiKey.value = apiKey
        _openaiBaseUrl.value = baseUrl
        _openaiModel.value = model
        _openaiMaxTokens.value = maxTokens
        viewModelScope.launch(Dispatchers.IO) {
            settingDao.setSetting(SettingEntity("openai_api_key", apiKey))
            settingDao.setSetting(SettingEntity("openai_base_url", baseUrl))
            settingDao.setSetting(SettingEntity("openai_model", model))
            settingDao.setSetting(SettingEntity("openai_max_tokens", maxTokens.toString()))
        }
    }

    fun saveAppearanceSettings(fontFamily: String, fontSize: Int, lineHeight: Float, contentWidth: Int) {
        _fontFamily.value = fontFamily
        _fontSize.value = fontSize
        _lineHeight.value = lineHeight
        _contentWidth.value = contentWidth
        viewModelScope.launch(Dispatchers.IO) {
            settingDao.setSetting(SettingEntity("fontFamily", fontFamily))
            settingDao.setSetting(SettingEntity("fontSize", fontSize.toString()))
            settingDao.setSetting(SettingEntity("lineHeight", lineHeight.toString()))
            settingDao.setSetting(SettingEntity("contentWidth", contentWidth.toString()))
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

    fun updateSidebarWidth(width: Float) {
        _sidebarWidthDp.value = width
        viewModelScope.launch(Dispatchers.IO) {
            settingDao.setSetting(SettingEntity("sidebar_width", width.toString()))
        }
    }

    fun toggleSidebarCollapsed() {
        val newState = !_isSidebarCollapsed.value
        _isSidebarCollapsed.value = newState
        viewModelScope.launch(Dispatchers.IO) {
            settingDao.setSetting(SettingEntity("sidebar_collapsed", newState.toString()))
        }
    }

    fun openDetailPane(type: String) {
        _detailPaneType.value = type
        _isDetailPaneCollapsed.value = false
        _isSidebarCollapsed.value = true
        viewModelScope.launch(Dispatchers.IO) {
            settingDao.setSetting(SettingEntity("sidebar_collapsed", "true"))
        }
    }

    fun closeDetailPane() {
        _detailPaneType.value = null
        _isDetailPaneCollapsed.value = true
    }

    fun updateDetailPaneWidth(width: Float) {
        _detailPaneWidthDp.value = width
    }

    fun toggleDetailPaneCollapsed() {
        val newState = !_isDetailPaneCollapsed.value
        _isDetailPaneCollapsed.value = newState
        if (newState) {
            _detailPaneType.value = null
        }
    }

    fun showSidebarAndCloseDetail() {
        _isSidebarCollapsed.value = false
        _isDetailPaneCollapsed.value = true
        _detailPaneType.value = null
        viewModelScope.launch(Dispatchers.IO) {
            settingDao.setSetting(SettingEntity("sidebar_collapsed", "false"))
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
    fun startSync(fullSync: Boolean = false) {
        val currentToken = _token.value
        if (currentToken.isNullOrBlank()) {
            _syncError.value = "请先配置 Readwise Token"
            _syncStatus.value = "error"
            return
        }
        if (_isSyncing.value) return

        _isSyncing.value = true
        _syncStatus.value = "syncing"
        _syncError.value = null
        _syncProgress.value = SyncProgress("starting", 0, 0)

        if (currentToken == "offline") {
            syncJob = viewModelScope.launch(Dispatchers.IO) {
                try {
                    seedOfflineData()
                    val localCount = docDao.getDocumentCount()
                    _syncCounts.value = _syncCounts.value.copy(local = localCount, lastSync = System.currentTimeMillis().toString())
                    _syncProgress.value = SyncProgress("done", localCount, localCount)
                    _syncStatus.value = "idle"
                } catch (e: Exception) {
                    e.printStackTrace()
                    _syncError.value = e.message ?: "初始化数据失败"
                    _syncStatus.value = "error"
                } finally {
                    _isSyncing.value = false
                }
            }
            return
        }

        syncJob = viewModelScope.launch(Dispatchers.IO) {
            try {
                val client = ReadwiseClient(currentToken)

                // 1. 验证 Token 是否有效
                val isValidToken = client.validateToken()
                if (!isValidToken) {
                    throw Exception("Readwise API Token 无效")
                }

                if (fullSync) {
                    docDao.deleteAll()
                    hlDao.deleteAll()
                }

                val lastSyncedAt = if (fullSync) null else settingDao.getSetting("lastDocumentSync")?.replace("\"", "")
                val lastV2SyncedAt = if (fullSync) null else settingDao.getSetting("lastV2HighlightSync")?.replace("\"", "")

                // 阶段 1: 拉取文档
                _syncProgress.value = SyncProgress("documents", 0, 0)
                val trashIdsSet = docDao.getTrashDocumentIds().toSet()
                var pageCursor: String? = null
                var totalFetchedDocs = 0
                var remoteDocCount = 0

                do {
                    if (checkCancelled()) throw kotlinx.coroutines.CancellationException("Sync cancelled by user")

                    val response = client.listDocuments(
                        updatedAfter = lastSyncedAt,
                        pageCursor = pageCursor
                    )

                    if (remoteDocCount == 0 && response.count != null) {
                        remoteDocCount = response.count
                    }

                    val results = response.results
                    val regularDocs = mutableListOf<DocumentEntity>()
                    val highlightDocs = mutableListOf<HighlightEntity>()

                    for (item in results) {
                        if (item.category == "highlight") {
                            val text = item.html_content ?: item.summary ?: item.title
                            highlightDocs.add(
                                HighlightEntity(
                                    id = item.id,
                                    document_id = item.parent_id ?: "",
                                    text = text,
                                    note = item.notes,
                                    color = "yellow",
                                    location = 0,
                                    readwise_highlight_id = item.id,
                                    tags_json = Json.encodeToString(item.tags.keys.toList())
                                )
                            )
                        } else {
                            val targetLocation = if (trashIdsSet.contains(item.id)) "trash" else item.location
                            regularDocs.add(
                                DocumentEntity(
                                    id = item.id,
                                    url = item.url,
                                    source_url = item.source_url,
                                    title = item.title,
                                    author = item.author,
                                    source = item.source,
                                    category = item.category,
                                    location = targetLocation,
                                    site_name = item.site_name,
                                    word_count = item.word_count,
                                    reading_time = item.reading_time,
                                    created_at = item.created_at,
                                    updated_at = item.updated_at,
                                    published_date = item.publishedDateString,
                                    summary = item.summary,
                                    notes = item.notes,
                                    image_url = item.image_url,
                                    reading_progress = item.reading_progress,
                                    html_content = null,
                                    tags_json = Json.encodeToString(item.tags.mapValues { 1 }),
                                    synced_at = System.currentTimeMillis().toString()
                                )
                            )
                        }
                    }

                    if (regularDocs.isNotEmpty()) {
                        docDao.insertAll(regularDocs)
                    }
                    if (highlightDocs.isNotEmpty()) {
                        hlDao.insertAll(highlightDocs)
                    }

                    totalFetchedDocs += results.size
                    _syncProgress.value = SyncProgress("documents", totalFetchedDocs, remoteDocCount)

                    pageCursor = response.nextPageCursorString
                } while (pageCursor != null)

                // 阶段 2: 拉取 V2 高亮
                _syncProgress.value = SyncProgress("highlights", 0, 0)
                client.fetchAllV2Highlights(
                    updatedAfter = lastV2SyncedAt,
                    onProgress = { fetched, totalBook ->
                        _syncProgress.value = SyncProgress("highlights", fetched, totalBook)
                    },
                    checkCancel = { checkCancelled() },
                    onBatch = { batchBooks ->
                        val highlightsToInsert = mutableListOf<HighlightEntity>()
                        for (book in batchBooks) {
                            var documentId = docDao.findDocumentIdBySourceUrl(book.source_url ?: "")
                            if (documentId == null) {
                                documentId = docDao.findDocumentIdByTitle(book.title)
                            }
                            if (documentId == null) continue

                            for (h in book.highlights) {
                                highlightsToInsert.add(
                                    HighlightEntity(
                                        id = h.id.toString(),
                                        document_id = documentId,
                                        text = h.text,
                                        note = h.note,
                                        color = h.color ?: "yellow",
                                        location = h.location ?: 0,
                                        readwise_highlight_id = h.id.toString(),
                                        tags_json = Json.encodeToString(h.tags.map { it.name })
                                    )
                                )
                            }
                        }
                        if (highlightsToInsert.isNotEmpty()) {
                            hlDao.insertAll(highlightsToInsert)
                        }
                    }
                )

                // 阶段 3: 拉取标签
                _syncProgress.value = SyncProgress("tags", 0, 0)
                client.fetchAllTags(
                    onProgress = { fetched, total ->
                        _syncProgress.value = SyncProgress("tags", fetched, total)
                    },
                    checkCancel = { checkCancelled() },
                    onBatch = { batchTags ->
                        // Android 本地数据库没有 Tags 表，此处解析而不写入，维持进度一致性
                    }
                )

                // 保存最后同步时间
                val now = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).apply {
                    timeZone = java.util.TimeZone.getTimeZone("GMT")
                }.format(java.util.Date())

                settingDao.setSetting(SettingEntity("lastDocumentSync", now))
                settingDao.setSetting(SettingEntity("lastV2HighlightSync", now))
                settingDao.setSetting(SettingEntity("remote_doc_count", remoteDocCount.toString()))

                val localCount = docDao.getDocumentCount()
                _syncCounts.value = SyncCounts(local = localCount, remote = remoteDocCount, lastSync = now)
                _syncProgress.value = SyncProgress("done", totalFetchedDocs, remoteDocCount)
                _syncStatus.value = "idle"

            } catch (e: kotlinx.coroutines.CancellationException) {
                println("Sync cancelled by user")
                _syncStatus.value = "canceled"
            } catch (e: Exception) {
                e.printStackTrace()
                _syncError.value = e.message ?: "同步失败"
                _syncStatus.value = "error"
            } finally {
                _isSyncing.value = false
            }
        }
    }

    fun cancelSync() {
        if (_isSyncing.value) {
            _syncStatus.value = "canceling"
            syncJob?.cancel()
        }
    }

    private fun checkCancelled(): Boolean {
        val job = syncJob
        return job != null && !job.isActive
    }

    @Suppress("UNUSED_PARAMETER")
    fun testConfig(apiKey: String, baseUrl: String, model: String, maxTokens: Int) {
        _testLoading.value = true
        _testResult.value = null
        val stages = listOf(
            TestStage("validate", "配置参数校验", "pending", "等待开始..."),
            TestStage("connect", "服务器连通性测试", "pending", "等待开始..."),
            TestStage("chat", "对话模型可用性测试", "pending", "等待开始...")
        )
        _testStages.value = stages

        viewModelScope.launch(Dispatchers.IO) {
            val startTime = System.currentTimeMillis()
            var step1Success = false
            var step2Success = false
            var step3Success = false
            var finalDuration = 0L
            var finalReply: String? = null
            var finalError: String? = null

            // 1. 参数校验
            updateTestStage("validate", "running", "校验参数中...")
            if (apiKey.isBlank()) {
                updateTestStage("validate", "failed", "API Key 不能为空")
                finalError = "API Key 不能为空"
            } else if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
                updateTestStage("validate", "failed", "服务器地址格式错误，必须以 http:// 或 https:// 开头")
                finalError = "服务器地址格式错误"
            } else if (model.isBlank()) {
                updateTestStage("validate", "failed", "模型名称不能为空")
                finalError = "模型名称不能为空"
            } else {
                updateTestStage("validate", "success", "参数校验成功")
                step1Success = true
            }

            // 2. 连通性测试
            if (step1Success) {
                updateTestStage("connect", "running", "尝试连接服务器...")
                val tempClient = HttpClient(Android)
                try {
                    val endpoint = if (baseUrl.endsWith("/")) "${baseUrl}models" else "$baseUrl/models"
                    val response = tempClient.get(endpoint) {
                        header("Authorization", "Bearer $apiKey")
                    }
                    updateTestStage("connect", "success", "服务器响应成功，状态码: ${response.status.value}")
                    step2Success = true
                } catch (e: Exception) {
                    updateTestStage("connect", "failed", "无法连接到服务器: ${e.message ?: "未知网络错误"}")
                    finalError = "网络请求失败，请检查本地网络连接与地址配置。(${e.message})"
                } finally {
                    tempClient.close()
                }
            }

            // 3. 对话可用性测试
            if (step2Success) {
                updateTestStage("chat", "running", "发送对话请求中...")
                try {
                    val client = com.readerq.app.api.OpenAiClient(apiKey, baseUrl, model)
                    val response = client.getCompletion(
                        listOf(com.readerq.app.api.OpenAiMessage("user", "Hello, please answer with exactly 'Hello Connection Success!'")),
                        "You are a test assistant."
                    )
                    finalReply = response
                    updateTestStage("chat", "success", "对话模型测试成功")
                    step3Success = true
                } catch (e: Exception) {
                    updateTestStage("chat", "failed", "AI 接口请求失败: ${e.message}")
                    finalError = "AI 接口请求失败: ${e.message}"
                }
            }

            finalDuration = System.currentTimeMillis() - startTime
            _testResult.value = TestResult(
                success = step3Success,
                duration = finalDuration,
                reply = finalReply,
                error = finalError
            )
            _testLoading.value = false
        }
    }

    private fun updateTestStage(id: String, status: String, message: String) {
        _testStages.value = _testStages.value?.map { stage ->
            if (stage.id == id) stage.copy(status = status, message = message) else stage
        }
    }

    fun testOssConfig(
        region: String,
        bucket: String,
        accessKeyId: String,
        accessKeySecret: String,
        customDomain: String,
        pathPrefix: String
    ) {
        _ossTestLoading.value = true
        _ossTestResult.value = null

        viewModelScope.launch(Dispatchers.IO) {
            try {
                if (region.isBlank() || bucket.isBlank() || accessKeyId.isBlank() || accessKeySecret.isBlank()) {
                    throw Exception("必填参数不能为空（Region、Bucket、AccessKey ID、AccessKey Secret）")
                }

                val oss = com.readerq.app.api.OssClient(
                    region = region,
                    bucket = bucket,
                    accessKeyId = accessKeyId,
                    accessKeySecret = accessKeySecret,
                    customDomain = if (customDomain.isBlank()) null else customDomain,
                    pathPrefix = pathPrefix
                )

                val testContent = "Test OSS Connection from ReaderQ Android Client".toByteArray()
                val fileName = "test_connection_${System.currentTimeMillis()}.txt"
                val url = oss.uploadImage(testContent, "test_connection", fileName)

                _ossTestResult.value = OssTestResult(
                    success = true,
                    ossUrl = url,
                    error = null
                )
            } catch (e: Exception) {
                e.printStackTrace()
                _ossTestResult.value = OssTestResult(
                    success = false,
                    ossUrl = null,
                    error = e.message ?: "OSS 连接测试失败"
                )
            } finally {
                _ossTestLoading.value = false
            }
        }
    }

    fun fetchGithubReleases() {
        _changelogLoading.value = true
        _changelogError.value = null
        _githubReleases.value = emptyList()

        viewModelScope.launch(Dispatchers.IO) {
            val jsonDecoder = Json {
                ignoreUnknownKeys = true
                coerceInputValues = true
            }
            val tempClient = HttpClient(Android) {
                install(io.ktor.client.plugins.contentnegotiation.ContentNegotiation) {
                    json(jsonDecoder)
                }
            }

            try {
                val url = "https://api.github.com/repos/qxk2005/readerq/releases?per_page=50"
                val response: List<GitHubRelease> = tempClient.get(url) {
                    header("Accept", "application/vnd.github.v3+json")
                    header("User-Agent", "ReaderQ-Android-App")
                }.body()

                _githubReleases.value = response.filter { !it.draft }
            } catch (e: Exception) {
                e.printStackTrace()
                _changelogError.value = e.message ?: "获取更新日志失败，请检查网络连接。"
            } finally {
                tempClient.close()
                _changelogLoading.value = false
            }
        }
    }

    // Highlighting - Create
    fun addHighlight(
        text: String,
        note: String? = null,
        color: String = "yellow",
        location: Int = 0,
        images: List<HighlightImage> = emptyList()
    ) {
        val doc = _selectedDoc.value ?: return
        val currentToken = _token.value ?: return

        viewModelScope.launch(Dispatchers.IO) {
            val localId = "local_" + System.currentTimeMillis()
            var localHl = HighlightEntity(
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

            var updatedText = text
            if (images.isNotEmpty()) {
                val region = _ossRegion.value
                val bucket = _ossBucket.value
                val accessKeyId = _ossAccessKeyId.value
                val accessKeySecret = _ossAccessKeySecret.value
                val customDomain = _ossCustomDomain.value
                val pathPrefix = _ossPathPrefix.value

                if (region.isNotBlank() && bucket.isNotBlank() && accessKeyId.isNotBlank() && accessKeySecret.isNotBlank()) {
                    val httpClient = HttpClient(Android)
                    val oss = com.readerq.app.api.OssClient(
                        region = region,
                        bucket = bucket,
                        accessKeyId = accessKeyId,
                        accessKeySecret = accessKeySecret,
                        customDomain = if (customDomain.isBlank()) null else customDomain,
                        pathPrefix = pathPrefix
                    )

                    var hasUploadSuccess = false
                    for (img in images) {
                        try {
                            val httpResponse = httpClient.get(img.src)
                            if (httpResponse.status.value in 200..299) {
                                val bytes = httpResponse.body<ByteArray>()
                                val fileName = if (img.src.contains("/")) img.src.substringAfterLast("/") else "image.jpg"
                                val ossUrl = oss.uploadImage(bytes, doc.id, fileName)
                                
                                val placeholder = "[图片: ${img.alt}]"
                                val markdownImg = "![${img.alt}]($ossUrl)"
                                updatedText = updatedText.replace(placeholder, markdownImg)
                                hasUploadSuccess = true
                            }
                        } catch (err: Exception) {
                            err.printStackTrace()
                        }
                    }
                    httpClient.close()

                    if (hasUploadSuccess && updatedText != text) {
                        localHl = localHl.copy(text = updatedText)
                        hlDao.insertHighlight(localHl)
                    }
                }
            }

            if (currentToken == "offline") {
                val finalId = "offline_" + System.currentTimeMillis()
                hlDao.deleteHighlight(localId)
                hlDao.insertHighlight(localHl.copy(id = finalId, readwise_highlight_id = finalId))
                return@launch
            }

            try {
                val client = ReadwiseClient(currentToken)
                val response = client.createHighlight(
                    text = updatedText,
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

            // 自动将高亮的 tags 合并到文档的 tags 中（去重）
            // 与 Web/macOS 客户端行为一致
            if (tags.isNotEmpty()) {
                val doc = _selectedDoc.value ?: docDao.getDocumentById(local.document_id)
                if (doc != null) {
                    val currentDocTags = try {
                        doc.tags_json?.let {
                            Json.decodeFromString<Map<String, Int>>(it).keys.toMutableSet()
                        } ?: mutableSetOf()
                    } catch (e: Exception) {
                        mutableSetOf()
                    }
                    var hasNewTag = false
                    for (tag in tags) {
                        if (tag !in currentDocTags) {
                            currentDocTags.add(tag)
                            hasNewTag = true
                        }
                    }
                    if (hasNewTag) {
                        val mergedTagsJson = Json.encodeToString(currentDocTags.associateWith { 1 })
                        val updatedDoc = doc.copy(tags_json = mergedTagsJson)
                        docDao.insertDocument(updatedDoc)
                        _selectedDoc.value = updatedDoc

                        // 同步文档 tags 到远端
                        if (currentToken != "offline") {
                            try {
                                val client = ReadwiseClient(currentToken)
                                val mergedTagList = currentDocTags.toList()
                                client.updateDocument(doc.id, tags = mergedTagList)
                                val url = doc.source_url ?: doc.url
                                client.syncDocumentTagsV2(url, mergedTagList)
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }
                    }
                }
            }

            if (currentToken == "offline") return@launch

            try {
                val client = ReadwiseClient(currentToken)
                val remoteId = local.readwise_highlight_id
                if (remoteId != null) {
                    client.patchHighlight(remoteId, note)
                    for (tag in tags) {
                        try {
                            client.addHighlightTag(remoteId, tag)
                        } catch (tagErr: Exception) {
                            tagErr.printStackTrace()
                        }
                    }
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

    // Update reading progress (local DB + best-effort Readwise sync)
    fun updateReadingProgress(docId: String, progress: Float) {
        val currentToken = _token.value ?: return
        viewModelScope.launch(Dispatchers.IO) {
            // 只取最大值（不因回滚降低进度）
            val existingDoc = docDao.getDocumentById(docId)
            val maxProgress = maxOf(progress, existingDoc?.reading_progress ?: 0f)
            docDao.updateReadingProgress(docId, maxProgress)

            // 更新内存中的 selectedDoc
            _selectedDoc.value?.let { doc ->
                if (doc.id == docId) {
                    _selectedDoc.value = doc.copy(reading_progress = maxProgress)
                }
            }

            // 尝试同步到 Readwise（最佳努力，不阻塞）
            if (currentToken != "offline") {
                try {
                    val client = ReadwiseClient(currentToken)
                    client.updateDocument(docId, reading_progress = maxProgress)
                } catch (e: Exception) {
                    // 静默失败 - Readwise API 可能不支持此字段
                }
            }
        }
    }

    // --- TTS 文章朗读 ---
    private val ttsManager = TtsManager(application)
    val ttsState: StateFlow<TtsState> = ttsManager.ttsState

    fun startTts(htmlContent: String) {
        ttsManager.speak(htmlContent)
    }

    fun toggleTts() {
        ttsManager.togglePlayPause()
    }

    fun stopTts() {
        ttsManager.stop()
    }

    fun nextTtsChunk() {
        ttsManager.nextChunk()
    }

    fun previousTtsChunk() {
        ttsManager.previousChunk()
    }

    override fun onCleared() {
        super.onCleared()
        ttsManager.shutdown()
    }
}

data class SyncProgress(val phase: String, val fetched: Int, val total: Int)
data class SyncCounts(val local: Int, val remote: Int, val lastSync: String?)

data class TestStage(
    val id: String,
    val name: String,
    val status: String, // "pending", "running", "success", "failed"
    val message: String
)

data class TestResult(
    val success: Boolean,
    val duration: Long,
    val reply: String?,
    val error: String?
)

data class OssTestResult(
    val success: Boolean,
    val ossUrl: String?,
    val error: String?
)

@Serializable
data class GitHubRelease(
    val tag_name: String,
    val name: String,
    val body: String? = null,
    val published_at: String? = null,
    val prerelease: Boolean = false,
    val draft: Boolean = false,
    val html_url: String? = null,
    val assets: List<GitHubAsset> = emptyList()
)

@Serializable
data class GitHubAsset(
    val name: String,
    val size: Long,
    val browser_download_url: String
)
