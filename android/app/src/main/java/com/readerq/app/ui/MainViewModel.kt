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
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.put
import kotlinx.serialization.json.add
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.encodeToString
import com.readerq.app.api.HighlightImage
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
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

    private val _token = MutableStateFlow<String?>("mock_readwise_token")
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

    // 瀑布流配置状态 (Home Feed Settings)
    private val _homeFeedColumns = MutableStateFlow(0) // 0 为智能自适应，1, 2, 3, 4
    val homeFeedColumns: StateFlow<Int> = _homeFeedColumns.asStateFlow()

    private val _homeFeedShowSummary = MutableStateFlow(true)
    val homeFeedShowSummary: StateFlow<Boolean> = _homeFeedShowSummary.asStateFlow()

    private val _homeFeedShowTags = MutableStateFlow(true)
    val homeFeedShowTags: StateFlow<Boolean> = _homeFeedShowTags.asStateFlow()

    private val _homeFeedShowCover = MutableStateFlow(true)
    val homeFeedShowCover: StateFlow<Boolean> = _homeFeedShowCover.asStateFlow()

    // 首页 Advanced Tab / Inbox / Tag Filter States
    private val _homeFeedTab = MutableStateFlow("all") // "all" 或 "tag"
    val homeFeedTab: StateFlow<String> = _homeFeedTab.asStateFlow()

    private val _homeFeedPrioritizeInbox = MutableStateFlow(true)
    val homeFeedPrioritizeInbox: StateFlow<Boolean> = _homeFeedPrioritizeInbox.asStateFlow()

    private val _homeFeedFilterTags = MutableStateFlow(listOf("readerq"))
    val homeFeedFilterTags: StateFlow<List<String>> = _homeFeedFilterTags.asStateFlow()

    private val _homeFeedSummaryMaxLines = MutableStateFlow(3)
    val homeFeedSummaryMaxLines: StateFlow<Int> = _homeFeedSummaryMaxLines.asStateFlow()

    private val _homeFeedShowHighlightsCount = MutableStateFlow(true)
    val homeFeedShowHighlightsCount: StateFlow<Boolean> = _homeFeedShowHighlightsCount.asStateFlow()

    private val _homeFeedLimit = MutableStateFlow(20)
    val homeFeedLimit: StateFlow<Int> = _homeFeedLimit.asStateFlow()

    // 禅阅读状态 (Zen Read States)
    private val _zenCurrentDocIndex = MutableStateFlow(0)
    val zenCurrentDocIndex: StateFlow<Int> = _zenCurrentDocIndex.asStateFlow()

    private val _zenUserRating = MutableStateFlow(0)
    val zenUserRating: StateFlow<Int> = _zenUserRating.asStateFlow()

    private fun saveSetting(key: String, value: String) {
        viewModelScope.launch(Dispatchers.IO) {
            settingDao.setSetting(SettingEntity(key, value))
        }
    }

    fun updateHomeFeedColumns(cols: Int) {
        _homeFeedColumns.value = cols
        saveSetting("ui_home_feed_cols", cols.toString())
    }

    fun updateHomeFeedShowSummary(show: Boolean) {
        _homeFeedShowSummary.value = show
        saveSetting("ui_home_feed_show_summary", show.toString())
    }

    fun updateHomeFeedShowTags(show: Boolean) {
        _homeFeedShowTags.value = show
        saveSetting("ui_home_feed_show_tags", show.toString())
    }

    fun updateHomeFeedShowCover(show: Boolean) {
        _homeFeedShowCover.value = show
        saveSetting("ui_home_feed_show_cover", show.toString())
    }

    // 每日回顾 Daily Review States & Readwise Sync
    private val _reviewHighlights = MutableStateFlow<List<HighlightEntity>>(emptyList())
    val reviewHighlights: StateFlow<List<HighlightEntity>> = _reviewHighlights.asStateFlow()

    private val _reviewCurrentIndex = MutableStateFlow(0)
    val reviewCurrentIndex: StateFlow<Int> = _reviewCurrentIndex.asStateFlow()

    private val _reviewSubTab = MutableStateFlow("daily") // "daily" (每日高亮) 或 "stats" (回顾统计)
    val reviewSubTab: StateFlow<String> = _reviewSubTab.asStateFlow()

    private val _reviewedCountToday = MutableStateFlow(0)
    val reviewedCountToday: StateFlow<Int> = _reviewedCountToday.asStateFlow()

    private val _streakDays = MutableStateFlow(5)
    val streakDays: StateFlow<Int> = _streakDays.asStateFlow()

    private val _isReviewCompleted = MutableStateFlow(false)
    val isReviewCompleted: StateFlow<Boolean> = _isReviewCompleted.asStateFlow()

    private val _currentReviewId = MutableStateFlow<Long?>(null)
    val currentReviewId: StateFlow<Long?> = _currentReviewId.asStateFlow()

    private val _isSyncingReviewComplete = MutableStateFlow(false)
    val isSyncingReviewComplete: StateFlow<Boolean> = _isSyncingReviewComplete.asStateFlow()

    private val _reviewCompleteSyncSuccess = MutableStateFlow<Boolean?>(null)
    val reviewCompleteSyncSuccess: StateFlow<Boolean?> = _reviewCompleteSyncSuccess.asStateFlow()

    fun setReviewSubTab(tab: String) {
        _reviewSubTab.value = tab
    }

    fun nextReviewCard() {
        if (_reviewHighlights.value.isNotEmpty()) {
            val total = _reviewHighlights.value.size
            val currentHl = _reviewHighlights.value.getOrNull(_reviewCurrentIndex.value)

            // 1. 异步提交当前划线操作至 Readwise 官方 API
            if (currentHl != null) {
                sendReviewActionToOfficial(currentHl, "keep")
            }

            if (_reviewCurrentIndex.value < total - 1) {
                _reviewCurrentIndex.value += 1
                _reviewedCountToday.value += 1
                saveSetting("review_today_count", _reviewedCountToday.value.toString())
            } else {
                // 读完最后一条，触发胜利完成结算
                _isReviewCompleted.value = true
                _reviewedCountToday.value += 1
                saveSetting("review_today_count", _reviewedCountToday.value.toString())
                
                // 2. 触发向 Readwise 官方 API 提交 Complete 打卡完成标记！
                submitOfficialReviewComplete()
            }
        }
    }

    fun sendReviewActionToOfficial(highlight: HighlightEntity, action: String) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val currentToken = settingDao.getSetting("readwise_token")?.replace("\"", "")
                if (!currentToken.isNullOrBlank()) {
                    val client = ReadwiseClient(currentToken)
                    val realIdStr = highlight.readwise_highlight_id ?: highlight.id.removePrefix("rw_")
                    val hlIdLong = realIdStr.toLongOrNull()
                    if (hlIdLong != null) {
                        client.submitReviewAction(highlightId = hlIdLong, action = action, reviewId = _currentReviewId.value)
                        println("[Readwise Official Sync] 成功发送 Review Action ($action) for highlight $hlIdLong")
                    } else {
                        println("[Readwise Official Sync] 划线 ${highlight.id} 无有效的 Readwise 数字 ID，跳过 Action 发送")
                    }
                }
            } catch (e: Exception) {
                println("[Readwise Official Sync] 发送 Review Action 失败: ${e.message}")
            }
        }
    }

    fun submitOfficialReviewComplete() {
        viewModelScope.launch(Dispatchers.IO) {
            _isSyncingReviewComplete.value = true
            _reviewCompleteSyncSuccess.value = null
            try {
                val currentToken = settingDao.getSetting("readwise_token")?.replace("\"", "")
                if (!currentToken.isNullOrBlank()) {
                    val client = ReadwiseClient(currentToken)
                    val response = client.markDailyReviewComplete()
                    val responseBody = response.bodyAsText()
                    println("[Readwise Official Sync] markDailyReviewComplete 官方 API 响应 HTTP ${response.status.value}: $responseBody")
                    _reviewCompleteSyncSuccess.value = true
                    println("[Readwise Official Sync] ✅ 成功向 Readwise 官方 API 标记今日 Daily Review 已 100% 完成打卡！")
                } else {
                    println("[Readwise Official Sync] ⚠️ 未设置 Readwise API Token，跳过官方打卡同步")
                    _reviewCompleteSyncSuccess.value = true
                }
            } catch (e: Exception) {
                println("[Readwise Official Sync] ❌ 标记 Readwise 官方 Daily Review 完成失败: ${e.message}")
                e.printStackTrace()
                _reviewCompleteSyncSuccess.value = false
            } finally {
                _isSyncingReviewComplete.value = false
            }
        }
    }

    fun prevReviewCard() {
        if (_isReviewCompleted.value) {
            _isReviewCompleted.value = false
        } else if (_reviewCurrentIndex.value > 0) {
            _reviewCurrentIndex.value -= 1
        }
    }

    fun restartReviewSession() {
        viewModelScope.launch(Dispatchers.IO) {
            _reviewCompleteSyncSuccess.value = null
            var fetchedOfficialHls: List<HighlightEntity>? = null

            // 1. 尝试向 Readwise 官方 API 获取当前用户专属的 15 条 Daily Review 划线
            try {
                val currentToken = settingDao.getSetting("readwise_token")?.replace("\"", "")
                if (!currentToken.isNullOrBlank()) {
                    val client = ReadwiseClient(currentToken)
                    try {
                        val officialReview = client.getDailyReview()
                        _currentReviewId.value = officialReview.review_id
                        println("[Readwise Official Sync] 获取到官方 Daily Review 会话 ID: ${officialReview.review_id}")

                        val items = officialReview.review_items ?: officialReview.results
                        if (!items.isNullOrEmpty()) {
                            val docs = docDao.getAllDocumentsSync()
                            val docsById = docs.associateBy { it.id }
                            val docsByUrl = docs.mapNotNull { d -> 
                                if (!d.source_url.isNullOrBlank()) d.source_url to d 
                                else if (!d.url.isNullOrBlank()) d.url to d 
                                else null 
                            }.toMap()

                            val officialMapped = items.mapNotNull { item ->
                                val hlDetail = item.highlight
                                val realHlId = (hlDetail?.id ?: item.highlight_id ?: item.id)?.toString() ?: return@mapNotNull null
                                val text = hlDetail?.text ?: item.text ?: ""
                                if (text.isBlank()) return@mapNotNull null

                                val note = hlDetail?.note ?: item.note
                                val title = hlDetail?.title ?: item.title
                                val author = hlDetail?.author ?: item.author
                                val docId = hlDetail?.source_url ?: item.source_url ?: "official_review_$realHlId"

                                val matchedDoc = docsById[docId] ?: docsByUrl[docId]
                                val finalTitle = if (!title.isNullOrBlank()) title else (matchedDoc?.title ?: "Readwise Review")
                                val finalAuthor = if (!author.isNullOrBlank()) author else (matchedDoc?.author ?: matchedDoc?.site_name ?: "")

                                HighlightEntity(
                                    id = "rw_$realHlId",
                                    document_id = matchedDoc?.id ?: docId,
                                    text = text,
                                    note = note,
                                    color = hlDetail?.color ?: "yellow",
                                    location = 0,
                                    readwise_highlight_id = realHlId,
                                    tags_json = "[]",
                                    document_title = finalTitle,
                                    author = finalAuthor
                                )
                            }

                            if (officialMapped.isNotEmpty()) {
                                fetchedOfficialHls = officialMapped
                                println("[Readwise Official Sync] 成功提炼 Readwise 官方推荐的 ${officialMapped.size} 条复习划线！")
                            }
                        }
                    } catch (e: Exception) {
                        println("[Readwise Official Sync] 获取官方 Daily Review 会话失败: ${e.message}")
                    }
                }
            } catch (e: Exception) {}

            // 2. 如果官方 API 获取到了划线，优先使用官方划线；否则使用本地数据库 Smart Sample 抽样 15 条兜底
            try {
                if (!fetchedOfficialHls.isNullOrEmpty()) {
                    _reviewHighlights.value = fetchedOfficialHls!!
                } else {
                    val allHls = hlDao.getAllHighlightsSync()
                    val docs = docDao.getAllDocumentsSync()
                    val docsById = docs.associateBy { it.id }
                    val docsByUrl = docs.mapNotNull { d -> 
                        if (!d.source_url.isNullOrBlank()) d.source_url to d 
                        else if (!d.url.isNullOrBlank()) d.url to d 
                        else null 
                    }.toMap()

                    val enrichedHls = allHls.map { hl ->
                        val matchedDoc = docsById[hl.document_id] ?: docsByUrl[hl.document_id]
                        val finalTitle = if (!hl.document_title.isNullOrBlank()) hl.document_title else matchedDoc?.title
                        val finalAuthor = if (!hl.author.isNullOrBlank()) hl.author else (matchedDoc?.author ?: matchedDoc?.site_name)
                        if (finalTitle != hl.document_title || finalAuthor != hl.author) {
                            hl.copy(document_title = finalTitle, author = finalAuthor)
                        } else {
                            hl
                        }
                    }

                    val validHls = enrichedHls.filter { it.text.trim().isNotEmpty() || !it.note.isNullOrBlank() }
                    if (validHls.isNotEmpty()) {
                        _reviewHighlights.value = validHls.shuffled().take(15)
                    }
                }
            } catch (e: Exception) {}

            _reviewCurrentIndex.value = 0
            _isReviewCompleted.value = false
        }
    }

    fun toggleReviewHighlightFavorite(highlight: HighlightEntity) {
        viewModelScope.launch(Dispatchers.IO) {
            val existingTags = try {
                if (highlight.tags_json.isNullOrBlank()) emptyList()
                else if (highlight.tags_json.startsWith("[")) Json.decodeFromString<List<String>>(highlight.tags_json)
                else Json.decodeFromString<Map<String, Int>>(highlight.tags_json).keys.toList()
            } catch (e: Exception) { emptyList() }

            val mutableTags = existingTags.toMutableList()
            val isFav = mutableTags.contains("favorite") || mutableTags.contains("收藏")
            if (isFav) {
                mutableTags.remove("favorite")
                mutableTags.remove("收藏")
            } else {
                mutableTags.add("favorite")
            }

            val newTagsJson = Json.encodeToString(mutableTags)
            val updated = highlight.copy(tags_json = newTagsJson)
            hlDao.insertHighlight(updated)

            // 更新本地列表状态
            _reviewHighlights.value = _reviewHighlights.value.map { if (it.id == highlight.id) updated else it }

            // 异步同步更新至 Readwise 云端 API
            val tokenVal = _token.value
            if (!tokenVal.isNullOrBlank() && !highlight.readwise_highlight_id.isNullOrBlank()) {
                try {
                    val client = ReadwiseClient(tokenVal)
                    if (!isFav) {
                        client.addHighlightTag(highlight.readwise_highlight_id, "favorite")
                    }
                } catch (e: Exception) {
                    println("Sync favorite to Readwise Cloud failed: ${e.message}")
                }
            }
        }
    }

    fun addReviewHighlightTag(highlight: HighlightEntity, newTag: String) {
        val cleanTag = newTag.trim().removePrefix("#")
        if (cleanTag.isBlank()) return
        viewModelScope.launch(Dispatchers.IO) {
            val existingTags = try {
                if (highlight.tags_json.isNullOrBlank()) emptyList()
                else if (highlight.tags_json.startsWith("[")) Json.decodeFromString<List<String>>(highlight.tags_json)
                else Json.decodeFromString<Map<String, Int>>(highlight.tags_json).keys.toList()
            } catch (e: Exception) { emptyList() }

            if (!existingTags.contains(cleanTag)) {
                val mutableTags = existingTags + cleanTag
                val newTagsJson = Json.encodeToString(mutableTags)
                val updated = highlight.copy(tags_json = newTagsJson)
                hlDao.insertHighlight(updated)

                _reviewHighlights.value = _reviewHighlights.value.map { if (it.id == highlight.id) updated else it }

                // 异步同步添加标签至 Readwise 云端 API 数据库
                val tokenVal = _token.value
                if (!tokenVal.isNullOrBlank() && !highlight.readwise_highlight_id.isNullOrBlank()) {
                    try {
                        val client = ReadwiseClient(tokenVal)
                        client.addHighlightTag(highlight.readwise_highlight_id, cleanTag)
                    } catch (e: Exception) {
                        println("Sync tag to Readwise Cloud failed: ${e.message}")
                    }
                }
            }
        }
    }

    fun updateReviewHighlightTextAndNote(highlight: HighlightEntity, newText: String, newNote: String?) {
        val cleanText = newText.trim()
        if (cleanText.isBlank()) return
        viewModelScope.launch(Dispatchers.IO) {
            val updated = highlight.copy(text = cleanText, note = newNote?.trim()?.ifBlank { null })
            hlDao.insertHighlight(updated)

            _reviewHighlights.value = _reviewHighlights.value.map { if (it.id == highlight.id) updated else it }

            // 异步同步更新至 Readwise 云端 API
            val tokenVal = _token.value
            if (!tokenVal.isNullOrBlank() && !highlight.readwise_highlight_id.isNullOrBlank()) {
                try {
                    val client = ReadwiseClient(tokenVal)
                    client.patchHighlight(highlight.readwise_highlight_id, text = cleanText, note = newNote?.trim()?.ifBlank { null })
                } catch (e: Exception) {
                    println("Sync updated highlight text & note to Readwise Cloud failed: ${e.message}")
                }
            }
        }
    }

    fun setHomeFeedTab(tab: String) {
        _homeFeedTab.value = tab
        saveSetting("ui_home_feed_tab", tab)
    }

    fun toggleHomeFeedPrioritizeInbox() {
        val newVal = !_homeFeedPrioritizeInbox.value
        _homeFeedPrioritizeInbox.value = newVal
        saveSetting("ui_home_feed_prioritize_inbox", newVal.toString())
    }

    fun addHomeFeedFilterTag(tag: String) {
        val cleanTag = tag.trim().removePrefix("#")
        if (cleanTag.isNotBlank() && !_homeFeedFilterTags.value.contains(cleanTag)) {
            val newList = _homeFeedFilterTags.value + cleanTag
            _homeFeedFilterTags.value = newList
            saveSetting("ui_home_feed_filter_tags", newList.joinToString(","))
        }
    }

    fun removeHomeFeedFilterTag(tag: String) {
        val newList = _homeFeedFilterTags.value - tag
        _homeFeedFilterTags.value = newList
        saveSetting("ui_home_feed_filter_tags", newList.joinToString(","))
    }

    fun updateHomeFeedSummaryMaxLines(lines: Int) {
        _homeFeedSummaryMaxLines.value = lines
        saveSetting("ui_home_feed_summary_max_lines", lines.toString())
    }

    fun updateHomeFeedShowHighlightsCount(show: Boolean) {
        _homeFeedShowHighlightsCount.value = show
        saveSetting("ui_home_feed_show_hl_count", show.toString())
    }

    fun loadMoreHomeFeed() {
        _homeFeedLimit.value += 20
    }

    // Sidebar Drag & Collapse States
    private val _sidebarWidthDp = MutableStateFlow(360f)
    val sidebarWidthDp: StateFlow<Float> = _sidebarWidthDp.asStateFlow()

    private val _isSidebarCollapsed = MutableStateFlow(false)
    val isSidebarCollapsed: StateFlow<Boolean> = _isSidebarCollapsed.asStateFlow()

    private val _isNavBarCollapsed = MutableStateFlow(false)
    val isNavBarCollapsed: StateFlow<Boolean> = _isNavBarCollapsed.asStateFlow()

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
                val targetCat = filter.category.lowercase().trim()
                filtered = filtered.filter { doc ->
                    val docCat = doc.category?.lowercase()?.trim() ?: ""
                    when (targetCat) {
                        "rss" -> docCat in listOf("rss", "feed", "rss_feed", "rss订阅", "rss 订阅")
                        "article" -> docCat in listOf("article", "articles")
                        "book" -> docCat in listOf("book", "books")
                        "pdf" -> docCat in listOf("pdf", "epub")
                        "video" -> docCat in listOf("video", "youtube")
                        "tweet" -> docCat in listOf("tweet", "short", "twitter")
                        else -> docCat == targetCat
                    }
                }
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
                val rawCat = doc.category?.lowercase()?.trim() ?: ""
                val cat = when (rawCat) {
                    "rss", "feed", "rss_feed", "rss订阅", "rss 订阅" -> "rss"
                    "article", "articles" -> "article"
                    "book", "books" -> "book"
                    "pdf", "epub" -> "pdf"
                    "video", "youtube" -> "video"
                    "tweet", "short", "twitter" -> "tweet"
                    else -> rawCat
                }
                if (cat.isNotEmpty()) {
                    counts[cat] = counts.getOrDefault(cat, 0) + 1
                }
            }
            counts
        }
        .flowOn(Dispatchers.IO)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    // Live list of all tags present in the documents & highlights database
    val allTags: StateFlow<List<String>> = combine(docDao.getAllDocuments(), hlDao.getAllHighlights()) { docs, hls ->
        val tagsSet = mutableSetOf<String>()
        docs.forEach { doc ->
            try {
                doc.tags_json?.let {
                    if (it.startsWith("{")) {
                        val tagsMap = Json.decodeFromString<Map<String, Int>>(it)
                        tagsSet.addAll(tagsMap.keys)
                    } else if (it.startsWith("[")) {
                        val tagsList = Json.decodeFromString<List<String>>(it)
                        tagsSet.addAll(tagsList)
                    }
                    Unit
                }
            } catch (e: Exception) {}
        }
        hls.forEach { hl ->
            try {
                hl.tags_json?.let {
                    if (it.startsWith("[")) {
                        val tagsList = Json.decodeFromString<List<String>>(it)
                        tagsSet.addAll(tagsList)
                    } else if (it.startsWith("{")) {
                        val tagsMap = Json.decodeFromString<Map<String, Int>>(it)
                        tagsSet.addAll(tagsMap.keys)
                    }
                    Unit
                }
            } catch (e: Exception) {}
        }
        tagsSet.filter { it.isNotBlank() }.sorted()
    }
    .flowOn(Dispatchers.IO)
    .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Highlight sort mode: position_asc, position_desc, time_asc, time_desc
    private val _highlightSortMode = MutableStateFlow("position_asc")
    val highlightSortMode: StateFlow<String> = _highlightSortMode.asStateFlow()

    fun setHighlightSortMode(mode: String) {
        _highlightSortMode.value = mode
        viewModelScope.launch(Dispatchers.IO) {
            settingDao.setSetting(SettingEntity("highlight_sort_mode", mode))
        }
    }

    // Load highlights for currently selected document (raw, unsorted)
    private val _rawHighlights: StateFlow<List<HighlightEntity>> = _selectedDoc
        .flatMapLatest { doc ->
            if (doc != null) hlDao.getHighlightsForDocument(doc.id) else flowOf(emptyList())
        }
        .flowOn(Dispatchers.IO)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Highlight positions cache (computed by WebView JS text matching)
    private val _highlightPositions = MutableStateFlow<Map<String, Int>>(emptyMap())

    fun updateHighlightPositions(positions: Map<String, Int>) {
        _highlightPositions.value = positions
    }

    // Sorted highlights based on current sort mode, using cached positions for accuracy
    val highlights: StateFlow<List<HighlightEntity>> = combine(_rawHighlights, _highlightSortMode, _highlightPositions) { hls, mode, posMap ->
        when (mode) {
            "position_desc" -> hls.sortedByDescending { posMap[it.id] ?: it.location }
            "time_asc" -> hls.sortedBy { it.created_at ?: "" }
            "time_desc" -> hls.sortedByDescending { it.created_at ?: "" }
            else -> hls.sortedBy { posMap[it.id] ?: it.location } // position_asc (default)
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Load documents that contain highlights
    val documentsWithHighlights: StateFlow<List<DocumentEntity>> = docDao.getDocumentsWithHighlights()
        .flowOn(Dispatchers.IO)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        viewModelScope.launch(Dispatchers.IO) {
            _token.value = settingDao.getSetting("readwise_token")?.replace("\"", "")?.ifBlank { "mock_readwise_token" } ?: "mock_readwise_token"
            _theme.value = settingDao.getSetting("theme")?.replace("\"", "") ?: "dark"

            _fontSize.value = settingDao.getSetting("fontSize")?.replace("\"", "")?.toIntOrNull() ?: 16
            _fontFamily.value = settingDao.getSetting("fontFamily")?.replace("\"", "") ?: "sans"
            _lineHeight.value = settingDao.getSetting("lineHeight")?.replace("\"", "")?.toFloatOrNull() ?: 1.6f
            _contentWidth.value = settingDao.getSetting("contentWidth")?.replace("\"", "")?.toIntOrNull() ?: 700
            
            _sidebarWidthDp.value = settingDao.getSetting("sidebar_width")?.replace("\"", "")?.toFloatOrNull() ?: 360f
            _isSidebarCollapsed.value = settingDao.getSetting("sidebar_collapsed")?.replace("\"", "")?.toBooleanStrictOrNull() ?: false
            _isNavBarCollapsed.value = settingDao.getSetting("navbar_collapsed")?.replace("\"", "")?.toBooleanStrictOrNull() ?: false
            _highlightSortMode.value = settingDao.getSetting("highlight_sort_mode")?.replace("\"", "") ?: "position_asc"
            
            _homeFeedColumns.value = settingDao.getSetting("ui_home_feed_cols")?.replace("\"", "")?.toIntOrNull() ?: 0
            _homeFeedShowSummary.value = settingDao.getSetting("ui_home_feed_show_summary")?.replace("\"", "")?.toBooleanStrictOrNull() ?: true
            _homeFeedShowTags.value = settingDao.getSetting("ui_home_feed_show_tags")?.replace("\"", "")?.toBooleanStrictOrNull() ?: true
            _homeFeedShowCover.value = settingDao.getSetting("ui_home_feed_show_cover")?.replace("\"", "")?.toBooleanStrictOrNull() ?: true
            
            _selectedDoc.value = null
            _currentTab.value = "review"
            _homeFeedTab.value = settingDao.getSetting("ui_home_feed_tab")?.replace("\"", "") ?: "all"
            _homeFeedPrioritizeInbox.value = settingDao.getSetting("ui_home_feed_prioritize_inbox")?.replace("\"", "")?.toBooleanStrictOrNull() ?: true
            val storedTags = settingDao.getSetting("ui_home_feed_filter_tags")?.replace("\"", "")
            if (!storedTags.isNullOrBlank()) {
                _homeFeedFilterTags.value = storedTags.split(",").map { it.trim() }.filter { it.isNotBlank() }
            }
            _homeFeedSummaryMaxLines.value = settingDao.getSetting("ui_home_feed_summary_max_lines")?.replace("\"", "")?.toIntOrNull() ?: 3
            _homeFeedShowHighlightsCount.value = settingDao.getSetting("ui_home_feed_show_hl_count")?.replace("\"", "")?.toBooleanStrictOrNull() ?: true
            
            _reviewedCountToday.value = settingDao.getSetting("review_today_count")?.replace("\"", "")?.toIntOrNull() ?: 0

            viewModelScope.launch(Dispatchers.IO) {
                combine(hlDao.getAllHighlights(), docDao.getAllDocuments()) { hls, docs ->
                    val docsById = docs.associateBy { it.id }
                    val docsByUrl = docs.mapNotNull { d -> 
                        if (!d.source_url.isNullOrBlank()) d.source_url to d 
                        else if (!d.url.isNullOrBlank()) d.url to d 
                        else null 
                    }.toMap()

                    hls.map { hl ->
                        val matchedDoc = docsById[hl.document_id] ?: docsByUrl[hl.document_id]
                        val finalTitle = if (!hl.document_title.isNullOrBlank()) hl.document_title else matchedDoc?.title
                        val finalAuthor = if (!hl.author.isNullOrBlank()) hl.author else (matchedDoc?.author ?: matchedDoc?.site_name)
                        if (finalTitle != hl.document_title || finalAuthor != hl.author) {
                            hl.copy(document_title = finalTitle, author = finalAuthor)
                        } else {
                            hl
                        }
                    }
                }.collect { enrichedHls ->
                    val validHls = enrichedHls.filter { it.text.trim().isNotEmpty() || !it.note.isNullOrBlank() }
                    if (_reviewHighlights.value.isEmpty()) {
                        if (validHls.isNotEmpty()) {
                            _reviewHighlights.value = validHls.shuffled().take(15)
                        } else {
                            _reviewHighlights.value = listOf(
                                HighlightEntity("hl_rev_1", "doc_1", "美国《福布斯》杂志网站称，过去几年中国的直播行业稳步增长，数据调查机构eMarketer的报告称，**2022年**，中国的直播业务销售额超过**5140亿美元**，并保持了**每年19%的增长**势头。", "直播行业观察", "yellow", 10, "rw_hl_1", "[\"数据统计\", \"直播领域\"]", document_title = "编码代理的高级上下文工程/wsff.md", author = "Humanloop"),
                                HighlightEntity("hl_rev_2", "doc_2", "Qwen-Agent是一个成熟的智能体生态系统，让Qwen模型能够自主规划、调用函数并立刻执行复杂的多步骤任务。", "智能体", "blue", 20, "rw_hl_2", "[\"Agent\", \"AI\"]", document_title = "Qwen-Agent框架：阿里巴巴Qwen模型家族的智能体AI", author = "Turing Post"),
                                HighlightEntity("hl_rev_3", "doc_3", "把一次生成改成可回退流程。PRD 不是线性流程，而是判断网络。", "PRD方法论", "purple", 30, "rw_hl_3", "[\"设计\"]", document_title = "别让 AI 一口气写完：把一次生成改成可回退流程", author = "人人都是产品经理")
                            )
                        }
                    } else {
                        val validMap = validHls.associateBy { it.id }
                        _reviewHighlights.value = _reviewHighlights.value.map { current ->
                            validMap[current.id] ?: current
                        }
                    }
                }
            }
            
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
        if (doc != null) {
            _currentTab.value = "library"
            if (doc.html_content == null) {
                fetchDocumentContent(doc.id)
            }
        }
    }

    fun changeView(view: String) {
        _currentView.value = view
    }

    fun changeTab(tab: String) {
        _selectedDoc.value = null
        _currentTab.value = tab
        viewModelScope.launch(Dispatchers.IO) {
            saveSetting("ui_current_tab", tab)
        }
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
        _selectedDoc.value = null
    }

    fun selectTag(tag: String?) {
        _selectedTag.value = tag
        _selectedCategory.value = null
        _currentView.value = "all"
        _selectedDoc.value = null
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

    fun moveDocument(docId: String, newLocation: String) {
        viewModelScope.launch(Dispatchers.IO) {
            val doc = docDao.getDocumentById(docId) ?: return@launch
            val updated = doc.copy(location = newLocation)
            docDao.insertDocument(updated)
            if (_selectedDoc.value?.id == docId) {
                _selectedDoc.value = updated
            }

            // 💡 自动后台全局同步向 Readwise 云端 API 推送更新
            val currentToken = _token.value
            if (!currentToken.isNullOrBlank() && currentToken != "offline") {
                try {
                    val client = ReadwiseClient(currentToken)
                    if (newLocation == "trash") {
                        client.deleteDocument(docId)
                    } else {
                        client.updateDocument(docId, location = newLocation)
                    }
                } catch (e: Exception) {
                    println("[moveDocument] Background Readwise sync error: ${e.message}")
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

            // 💡 自动后台全局同步向 Readwise 云端 API 更新位置为 "new"
            val currentToken = _token.value
            if (!currentToken.isNullOrBlank() && currentToken != "offline") {
                try {
                    val client = ReadwiseClient(currentToken)
                    client.updateDocument(docId, location = "new")
                } catch (e: Exception) {
                    println("[restoreDocument] Background Readwise sync error: ${e.message}")
                }
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
                    println("[permanentlyDeleteDocument] Background Readwise sync error: ${e.message}")
                }
            }
        }
    }

    /**
     * 清空垃圾箱：彻底物理删除所有 location == 'trash' 的本地文档，并自动并发推送至 Readwise API
     */
    fun emptyTrash() {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val trashIds = docDao.getTrashDocumentIds()
                if (trashIds.isEmpty()) return@launch

                // 1. 本地数据库清空
                trashIds.forEach { id ->
                    docDao.deleteDocument(id)
                    hlDao.deleteHighlightsForDocument(id)
                }
                if (_selectedDoc.value?.id in trashIds) {
                    _selectedDoc.value = null
                }

                // 2. 自动并发向 Readwise 云端 API 推送彻底删除请求
                val currentToken = _token.value
                if (!currentToken.isNullOrBlank() && currentToken != "offline") {
                    val client = ReadwiseClient(currentToken)
                    trashIds.map { id ->
                        launch(Dispatchers.IO) {
                            try {
                                client.deleteDocument(id)
                            } catch (e: Exception) {
                                println("[emptyTrash] Background Readwise sync delete error for $id: ${e.message}")
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                println("[emptyTrash] EXCEPTION: ${e.message}")
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

    private suspend fun getServerBaseUrl(): String {
        val custom = settingDao.getSetting("server_base_url")?.trim()
        if (!custom.isNullOrBlank()) {
            return custom.removeSuffix("/")
        }
        // 默认回退至 10.0.2.2:3000（供模拟器调试宿主服务）
        return "http://10.0.2.2:3000"
    }

    // --- Save Document Methods ---

    private val _saveDocResult = MutableStateFlow<SaveDocResult?>(null)
    val saveDocResult: StateFlow<SaveDocResult?> = _saveDocResult.asStateFlow()

    private val _isSavingDoc = MutableStateFlow(false)
    val isSavingDoc: StateFlow<Boolean> = _isSavingDoc.asStateFlow()

    // 视频处理管线实时进度
    private val _videoPipelineProgress = MutableStateFlow<String?>(null)
    val videoPipelineProgress: StateFlow<String?> = _videoPipelineProgress.asStateFlow()

    fun clearSaveDocResult() {
        _saveDocResult.value = null
        _videoPipelineProgress.value = null
    }

    fun saveDocumentByUrl(
        url: String,
        tags: List<String>? = null,
        author: String? = null,
        notes: String? = null
    ) {
        val currentToken = _token.value ?: return
        _isSavingDoc.value = true
        _saveDocResult.value = null
        _videoPipelineProgress.value = null

        val isVideoUrl = url.contains("youtube.com") || url.contains("youtu.be")

        viewModelScope.launch(Dispatchers.IO) {
            try {
                val client = ReadwiseClient(currentToken)
                val serverUrl = getServerBaseUrl()

                // 步骤 1：保存到 Readwise
                if (isVideoUrl) {
                    _videoPipelineProgress.value = "⌛ [1/5] 正在保存视频文章到 Readwise..."
                }
                val request = com.readerq.app.api.ReadwiseSaveRequest(
                    url = url,
                    tags = if (!tags.isNullOrEmpty()) tags else null,
                    author = author?.takeIf { it.isNotBlank() },
                    notes = notes?.takeIf { it.isNotBlank() }
                )

                // 优先通过服务器端保存（会触发 oEmbed 获取真实标题）
                var docId: String? = null
                // 🎯 步骤 1：直接调用 Readwise 官方 API 进行真实保存
                val rwSaveResult = try {
                    client.saveDocument(request)
                } catch (rwErr: Exception) {
                    println("[saveDocumentByUrl] Readwise 官方 API 保存报错: ${rwErr.message}")
                    throw Exception("保存到 Readwise 官方接口失败: ${rwErr.message}")
                }

                // 🎯 步骤 2：锁定 Readwise 官方返回的绝对权威 ID (例如 "01kyrq0jfj7cwqy9ybzcdpj4pq")
                val officialDocId = rwSaveResult.id
                    ?: rwSaveResult.url?.split("/")?.filter { it.isNotBlank() }?.lastOrNull()
                    ?: throw Exception("Readwise 官方接口未返回有效文档 ID")

                val officialReadwiseUrl = rwSaveResult.url ?: "https://read.readwise.io/read/$officialDocId"

                // 🎯 步骤 3：以官方权威 ID 立即落盘写入 Android 本地 Room 数据库，保证 ID 100% 官方一致，UI 列表秒刷
                val nowIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).format(java.util.Date())
                val newDocEntity = DocumentEntity(
                    id = officialDocId, // 100% 绑定 Readwise 官方唯一 ID！
                    url = url,
                    source_url = officialReadwiseUrl,
                    title = if (isVideoUrl) "YouTube 视频文章" else "已保存文章",
                    author = author,
                    source = if (isVideoUrl) "youtube" else "web",
                    category = if (isVideoUrl) "video" else "article",
                    location = "new",
                    site_name = if (isVideoUrl) "YouTube" else null,
                    word_count = null,
                    reading_time = null,
                    created_at = nowIso,
                    updated_at = nowIso,
                    published_date = null,
                    summary = null,
                    notes = notes,
                    image_url = null,
                    reading_progress = 0f,
                    html_content = null,
                    tags_json = if (!tags.isNullOrEmpty()) {
                        try {
                            val tagMap = tags.associateWith { mapOf("name" to it) }
                            kotlinx.serialization.json.Json.encodeToString(tagMap)
                        } catch (_: Exception) { null }
                    } else null,
                    synced_at = nowIso
                )
                try {
                    docDao.insertDocument(newDocEntity)
                } catch (dbErr: Exception) {
                    println("[saveDocumentByUrl] insertDocument error: ${dbErr.message}")
                }

                docId = officialDocId

                if (isVideoUrl) {
                    _videoPipelineProgress.value = "✅ [1/4] 文章已保存 → ${newDocEntity.title}"
                    kotlinx.coroutines.delay(500)

                    _videoPipelineProgress.value = "⌛ [2/4] 正在从 YouTube 提取字幕中..."

                    // 1. 异步触发服务器端 Pipeline 任务（无阻断直连处理）
                    viewModelScope.launch(Dispatchers.IO) {
                        try {
                            val pipelineUrl = "$serverUrl/api/video-pipeline/process"
                            HttpClient(Android) {
                                install(ContentNegotiation) {
                                    json(Json { ignoreUnknownKeys = true })
                                }
                                install(io.ktor.client.plugins.HttpTimeout) {
                                    requestTimeoutMillis = 90_000
                                    connectTimeoutMillis = 10_000
                                }
                            }.use { httpClient ->
                                httpClient.post(pipelineUrl) {
                                    contentType(ContentType.Application.Json)
                                    setBody("""{"docId":"$docId","url":"$url","title":"${docTitle ?: "视频文章"}"}""")
                                }
                            }
                        } catch (e: Exception) {
                            println("[video-pipeline] 触发视频处理任务: ${e.message}")
                        }
                    }

                    // 2. 启动 Android 端优雅轮询器，持续向服务端复核字幕就绪状态
                    var subtitleSuccess = false
                    val maxPolls = 10
                    for (attempt in 1..maxPolls) {
                        kotlinx.coroutines.delay(2000L)
                        val checkSub = client.fetchSubtitleFromServerFull(serverUrl, docId)
                        if (checkSub != null && (checkSub.exists || checkSub.subtitles != null)) {
                            _videoPipelineProgress.value = "✅ [完成] 字幕与 AI 双语对照已成功就绪！"
                            subtitleSuccess = true
                            break
                        } else {
                            if (attempt <= 3) {
                                _videoPipelineProgress.value = "⌛ [2/4] 正在从 YouTube 提取字幕中 (${attempt * 2}s)..."
                            } else if (attempt <= 7) {
                                _videoPipelineProgress.value = "⌛ [3/4] 字幕已抓取，正在进行 AI 中英对照翻译 (${attempt * 2}s)..."
                            } else {
                                _videoPipelineProgress.value = "⌛ [4/4] 正在生成视频精选博客文章 (${attempt * 2}s)..."
                            }
                        }
                    }

                    if (!subtitleSuccess) {
                        _videoPipelineProgress.value = "ℹ️ 视频已保存，字幕处理已转为云端后台运行"
                    }

                    _saveDocResult.value = SaveDocResult(
                        success = true,
                        message = "✅ 视频文章添加完成！字幕与博客已自动处理"
                    )
                } else {
                    _saveDocResult.value = SaveDocResult(
                        success = true,
                        message = "文章已保存到 ReaderQ"
                    )
                }

                // 触发同步以获取新文章
                startSync()
            } catch (e: Exception) {
                _saveDocResult.value = SaveDocResult(
                    success = false,
                    message = "保存失败: ${e.message}"
                )
            } finally {
                _isSavingDoc.value = false
                // 延迟清除进度信息
                if (isVideoUrl) {
                    kotlinx.coroutines.delay(2000)
                    _videoPipelineProgress.value = null
                }
            }
        }
    }

    fun saveDocumentWithHtml(
        title: String,
        html: String,
        tags: List<String>? = null,
        author: String? = null,
        notes: String? = null
    ) {
        val currentToken = _token.value ?: return
        _isSavingDoc.value = true
        _saveDocResult.value = null

        viewModelScope.launch(Dispatchers.IO) {
            try {
                val client = ReadwiseClient(currentToken)
                // 使用特殊 URL 格式来保存纯文本/HTML 内容
                val request = com.readerq.app.api.ReadwiseSaveRequest(
                    url = "https://readerq.app/upload/${System.currentTimeMillis()}",
                    html = html,
                    should_clean_html = false,
                    title = title,
                    tags = if (!tags.isNullOrEmpty()) tags else null,
                    author = author?.takeIf { it.isNotBlank() },
                    notes = notes?.takeIf { it.isNotBlank() }
                )
                val result = client.saveDocument(request)
                _saveDocResult.value = SaveDocResult(
                    success = true,
                    message = "文档已上传到 ReaderQ"
                )
                startSync()
            } catch (e: Exception) {
                _saveDocResult.value = SaveDocResult(
                    success = false,
                    message = "上传失败: ${e.message}"
                )
            } finally {
                _isSavingDoc.value = false
            }
        }
    }

    // --- Subtitle & Blog Multi-Device Sync States ---

    private val _subtitles = MutableStateFlow<List<com.readerq.app.api.SubtitleSegment>>(emptyList())
    val subtitles: StateFlow<List<com.readerq.app.api.SubtitleSegment>> = _subtitles.asStateFlow()

    private val _subtitleLoading = MutableStateFlow(false)
    val subtitleLoading: StateFlow<Boolean> = _subtitleLoading.asStateFlow()

    private val _subtitleSrtContent = MutableStateFlow<String?>(null)

    // 跨设备最新字幕版本提醒
    private val _hasNewerSubtitleVersion = MutableStateFlow(false)
    val hasNewerSubtitleVersion: StateFlow<Boolean> = _hasNewerSubtitleVersion.asStateFlow()
    private val _newerSrtContent = MutableStateFlow<String?>(null)

    private val _subtitleLocalVersion = MutableStateFlow<String?>(null)
    val subtitleLocalVersion: StateFlow<String?> = _subtitleLocalVersion.asStateFlow()
    private val _subtitleCloudVersion = MutableStateFlow<String?>(null)
    val subtitleCloudVersion: StateFlow<String?> = _subtitleCloudVersion.asStateFlow()

    // 跨设备最新博客版本提醒
    private val _hasNewerBlogVersion = MutableStateFlow(false)
    val hasNewerBlogVersion: StateFlow<Boolean> = _hasNewerBlogVersion.asStateFlow()
    private val _newerBlogContent = MutableStateFlow<String?>(null)

    private val _blogLocalVersion = MutableStateFlow<String?>(null)
    val blogLocalVersion: StateFlow<String?> = _blogLocalVersion.asStateFlow()
    private val _blogCloudVersion = MutableStateFlow<String?>(null)
    val blogCloudVersion: StateFlow<String?> = _blogCloudVersion.asStateFlow()

    // 视频跳播全局事件
    private val _videoSeekEvent = MutableSharedFlow<Float>(extraBufferCapacity = 1)
    val videoSeekEvent: SharedFlow<Float> = _videoSeekEvent.asSharedFlow()

    fun seekVideoTo(seconds: Float) {
        viewModelScope.launch {
            _videoSeekEvent.emit(seconds)
        }
    }

    private var subtitleJob: Job? = null
    private var blogJob: Job? = null

    fun loadSubtitles(documentId: String) {
        subtitleJob?.cancel()
        _subtitles.value = emptyList()
        _subtitleSrtContent.value = null
        _hasNewerSubtitleVersion.value = false
        _newerSrtContent.value = null
        _subtitleLocalVersion.value = null
        _subtitleCloudVersion.value = null

        subtitleJob = viewModelScope.launch(Dispatchers.IO) {
            _subtitleLoading.value = true
            try {
                // 1. 尝试从本地加载
                val localSrt = settingDao.getSetting("subtitle_$documentId")
                if (!localSrt.isNullOrBlank()) {
                    _subtitleSrtContent.value = localSrt
                    val parsed = com.readerq.app.api.SrtParser.parseAnySubtitle(localSrt)
                    _subtitles.value = parsed
                    val isBilingual = parsed.any { !it.zh.isNullOrBlank() } || localSrt.contains("\"zh\"")
                    _subtitleLocalVersion.value = if (isBilingual) "双语字幕 (本地)" else "单语字幕 (本地)"
                    _subtitleLoading.value = false
                } else {
                    _subtitleLocalVersion.value = "未生成 / 暂无 (本地)"
                }

                // 2. 检查 OSS 是否已配置，优先直接访问云端 OSS
                val region = _ossRegion.value
                val bucket = _ossBucket.value
                val akId = _ossAccessKeyId.value
                val akSecret = _ossAccessKeySecret.value
                val isOssConfigured = region.isNotBlank() && bucket.isNotBlank() && akId.isNotBlank() && akSecret.isNotBlank()

                var ossHandled = false
                if (isOssConfigured) {
                    try {
                        val oss = com.readerq.app.api.OssClient(
                            region, bucket, akId, akSecret,
                            _ossCustomDomain.value, _ossPathPrefix.value
                        )
                        val remoteSrt = oss.downloadSubtitle(documentId)
                        if (!remoteSrt.isNullOrBlank()) {
                            ossHandled = true
                            val isRemoteBilingual = remoteSrt.contains("\"zh\"") || remoteSrt.contains("zh:")
                            _subtitleCloudVersion.value = if (isRemoteBilingual) "最新双语字幕 (云端)" else "单语字幕 (云端)"

                            if (localSrt.isNullOrBlank()) {
                                // 本地为空，自动同步并渲染
                                settingDao.setSetting(com.readerq.app.data.SettingEntity("subtitle_$documentId", remoteSrt))
                                _subtitleSrtContent.value = remoteSrt
                                val parsed = com.readerq.app.api.SrtParser.parseAnySubtitle(remoteSrt)
                                _subtitles.value = parsed
                                _subtitleLocalVersion.value = if (isRemoteBilingual) "双语字幕 (本地已同步)" else "单语字幕 (本地已同步)"
                                println("[loadSubtitles] Auto-synced from OSS directly")
                            } else {
                                // 本地已有，检查是否有更新/双语扩展
                                val isLocalBilingual = _subtitles.value.any { !it.zh.isNullOrBlank() } || (localSrt.contains("\"zh\""))
                                if (localSrt.trim() != remoteSrt.trim() || (!isLocalBilingual && isRemoteBilingual)) {
                                    _newerSrtContent.value = remoteSrt
                                    _hasNewerSubtitleVersion.value = true
                                    println("[loadSubtitles] TRIGGER BANNER via OSS direct sync")
                                }
                            }
                        }
                    } catch (e: Exception) {
                        println("[loadSubtitles] OSS direct EXCEPTION: ${e.message}")
                    }
                }

                // 3. 如果 OSS 未配置或未获取到，回退到 Server API
                if (!ossHandled) {
                    val token = settingDao.getSetting("readwise_token")?.replace("\"", "") ?: ""
                    val client = com.readerq.app.api.ReadwiseClient(token)
                    val serverUrl = getServerBaseUrl()

                    val serverResp = try {
                        client.fetchSubtitleFromServerFull(serverUrl, documentId)
                    } catch (e: Exception) {
                        println("[loadSubtitles] Server API EXCEPTION: ${e.message}")
                        null
                    }

                    if (serverResp != null && serverResp.exists) {
                        _subtitleCloudVersion.value = "最新字幕 (服务器)"
                        if (localSrt.isNullOrBlank()) {
                            val contentToSave = serverResp.newerSrtContent ?: serverResp.subtitles?.toString()
                            if (!contentToSave.isNullOrBlank()) {
                                settingDao.setSetting(com.readerq.app.data.SettingEntity("subtitle_$documentId", contentToSave))
                                _subtitleSrtContent.value = contentToSave
                                _subtitles.value = com.readerq.app.api.SrtParser.parseAnySubtitle(contentToSave)
                            }
                        } else if (serverResp.hasNewerVersion && !serverResp.newerSrtContent.isNullOrBlank()) {
                            _newerSrtContent.value = serverResp.newerSrtContent
                            _hasNewerSubtitleVersion.value = true
                        }
                    }
                }
            } catch (e: Exception) {
                println("[loadSubtitles] TOP-LEVEL EXCEPTION: ${e.message}")
            } finally {
                _subtitleLoading.value = false
            }
        }
    }

    /**
     * 一键应用云端最新的字幕版本
     */
    fun applyNewerSubtitle(documentId: String) {
        val newSrt = _newerSrtContent.value ?: return
        viewModelScope.launch(Dispatchers.IO) {
            settingDao.setSetting(SettingEntity("subtitle_$documentId", newSrt))
            _subtitleSrtContent.value = newSrt
            val parsed = com.readerq.app.api.SrtParser.parseAnySubtitle(newSrt)
            _subtitles.value = parsed
            val isBilingual = parsed.any { !it.zh.isNullOrBlank() } || newSrt.contains("\"zh\"")
            _subtitleLocalVersion.value = if (isBilingual) "双语字幕 (本地)" else "单语字幕 (本地)"
            _hasNewerSubtitleVersion.value = false
            _newerSrtContent.value = null
        }
    }

    fun ignoreNewerSubtitle() {
        _hasNewerSubtitleVersion.value = false
    }

    private val _blogContent = MutableStateFlow<String?>(null)
    val blogContent: StateFlow<String?> = _blogContent.asStateFlow()

    private val _blogLoading = MutableStateFlow(false)
    val blogLoading: StateFlow<Boolean> = _blogLoading.asStateFlow()

    fun loadBlog(documentId: String) {
        blogJob?.cancel()
        _blogContent.value = null
        _hasNewerBlogVersion.value = false
        _newerBlogContent.value = null
        _blogLocalVersion.value = null
        _blogCloudVersion.value = null

        blogJob = viewModelScope.launch(Dispatchers.IO) {
            _blogLoading.value = true
            try {
                // 1. 尝试从本地加载
                val localBlog = settingDao.getSetting("blog_$documentId")
                if (!localBlog.isNullOrBlank()) {
                    _blogContent.value = localBlog
                    _blogLocalVersion.value = "已存本地博客"
                    _blogLoading.value = false
                } else {
                    _blogLocalVersion.value = "未生成 / 暂无 (本地)"
                }

                // 2. 检查 OSS 是否已配置，优先直接访问云端 OSS
                val region = _ossRegion.value
                val bucket = _ossBucket.value
                val akId = _ossAccessKeyId.value
                val akSecret = _ossAccessKeySecret.value
                val isOssConfigured = region.isNotBlank() && bucket.isNotBlank() && akId.isNotBlank() && akSecret.isNotBlank()

                var ossHandled = false
                if (isOssConfigured) {
                    try {
                        val oss = com.readerq.app.api.OssClient(
                            region, bucket, akId, akSecret,
                            _ossCustomDomain.value, _ossPathPrefix.value
                        )
                        val remoteBlog = oss.downloadBlog(documentId)
                        if (!remoteBlog.isNullOrBlank()) {
                            ossHandled = true
                            _blogCloudVersion.value = "最新视频博客 (云端)"
                            if (localBlog.isNullOrBlank()) {
                                // 本地无博客，但云端有博客 → 弹提醒供用户下载
                                _blogContent.value = null
                                _newerBlogContent.value = remoteBlog
                                _hasNewerBlogVersion.value = true
                                println("[loadBlog] TRIGGER BANNER: local empty, OSS has blog")
                            } else if (localBlog.trim() != remoteBlog.trim()) {
                                // 本地有博客，但云端博客内容不同 → 弹提醒
                                _newerBlogContent.value = remoteBlog
                                _hasNewerBlogVersion.value = true
                                println("[loadBlog] TRIGGER BANNER: local differs from OSS blog")
                            } else {
                                println("[loadBlog] NO BANNER: local blog matches OSS blog")
                            }
                        }
                    } catch (e: Exception) {
                        println("[loadBlog] OSS direct EXCEPTION: ${e.message}")
                    }
                }

                // 3. 如果 OSS 未配置或未获取到，回退到 Server API
                if (!ossHandled) {
                    val token = settingDao.getSetting("readwise_token")?.replace("\"", "") ?: ""
                    val client = com.readerq.app.api.ReadwiseClient(token)
                    val serverUrl = getServerBaseUrl()

                    val serverResp = try {
                        client.fetchBlogFromServerFull(serverUrl, documentId)
                    } catch (e: Exception) {
                        println("[loadBlog] Server API EXCEPTION: ${e.message}")
                        null
                    }

                    if (serverResp != null && serverResp.exists) {
                        _blogCloudVersion.value = "最新视频博客 (服务器)"
                        val bestBlog = serverResp.newerBlogContent ?: serverResp.blogContent
                        if (!bestBlog.isNullOrBlank()) {
                            if (localBlog.isNullOrBlank()) {
                                _blogContent.value = null
                                _newerBlogContent.value = bestBlog
                                _hasNewerBlogVersion.value = true
                            } else {
                                val serverHasUpdate = serverResp.hasNewerVersion && !serverResp.newerBlogContent.isNullOrBlank()
                                val contentDiffers = localBlog.trim() != bestBlog.trim()
                                if (serverHasUpdate || contentDiffers) {
                                    _newerBlogContent.value = bestBlog
                                    _hasNewerBlogVersion.value = true
                                }
                            }
                        }
                    }
                }
            } finally {
                _blogLoading.value = false
            }
        }
    }

    /**
     * 一键应用云端最新的博客版本
     */
    fun applyNewerBlog(documentId: String) {
        val newBlog = _newerBlogContent.value ?: return
        viewModelScope.launch(Dispatchers.IO) {
            settingDao.setSetting(SettingEntity("blog_$documentId", newBlog))
            _blogContent.value = newBlog
            _hasNewerBlogVersion.value = false
            _newerBlogContent.value = null
        }
    }

    fun ignoreNewerBlog() {
        _hasNewerBlogVersion.value = false
    }

    fun saveBlog(documentId: String, content: String) {
        viewModelScope.launch(Dispatchers.IO) {
            _blogLoading.value = true
            try {
                settingDao.setSetting(SettingEntity("blog_$documentId", content))
                _blogContent.value = content

                // 同步到 OSS
                val region = _ossRegion.value
                val bucket = _ossBucket.value
                val akId = _ossAccessKeyId.value
                val akSecret = _ossAccessKeySecret.value
                if (region.isNotBlank() && bucket.isNotBlank() && akId.isNotBlank() && akSecret.isNotBlank()) {
                    try {
                        val oss = com.readerq.app.api.OssClient(
                            region, bucket, akId, akSecret,
                            _ossCustomDomain.value, _ossPathPrefix.value
                        )
                        oss.uploadBlog(documentId, content)
                    } catch (e: Exception) {
                        // 忽略 OSS 同步失败
                    }
                }
            } catch (e: Exception) {
                // 忽略异常
            } finally {
                _blogLoading.value = false
            }
        }
    }

    fun uploadSubtitle(documentId: String, srtContent: String) {
        viewModelScope.launch(Dispatchers.IO) {
            _subtitleLoading.value = true
            try {
                // 解析验证
                val segments = com.readerq.app.api.SrtParser.parse(srtContent)
                if (segments.isEmpty()) {
                    _subtitleLoading.value = false
                    return@launch
                }

                // 保存到本地
                settingDao.setSetting(SettingEntity("subtitle_$documentId", srtContent))
                _subtitleSrtContent.value = srtContent
                _subtitles.value = segments

                // 同步到 OSS
                val region = _ossRegion.value
                val bucket = _ossBucket.value
                val akId = _ossAccessKeyId.value
                val akSecret = _ossAccessKeySecret.value
                if (region.isNotBlank() && bucket.isNotBlank() && akId.isNotBlank() && akSecret.isNotBlank()) {
                    try {
                        val oss = com.readerq.app.api.OssClient(
                            region, bucket, akId, akSecret,
                            _ossCustomDomain.value, _ossPathPrefix.value
                        )
                        oss.uploadSubtitle(documentId, srtContent)
                    } catch (e: Exception) {
                        // OSS 同步失败不影响本地使用
                    }
                }
            } catch (e: Exception) {
                // 解析或保存失败
            } finally {
                _subtitleLoading.value = false
            }
        }
    }

    fun deleteSubtitle(documentId: String) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                settingDao.removeSetting("subtitle_$documentId")
                _subtitles.value = emptyList()
                _subtitleSrtContent.value = null

                // 同时删除 OSS
                val region = _ossRegion.value
                val bucket = _ossBucket.value
                val akId = _ossAccessKeyId.value
                val akSecret = _ossAccessKeySecret.value
                if (region.isNotBlank() && bucket.isNotBlank() && akId.isNotBlank() && akSecret.isNotBlank()) {
                    try {
                        val oss = com.readerq.app.api.OssClient(
                            region, bucket, akId, akSecret,
                            _ossCustomDomain.value, _ossPathPrefix.value
                        )
                        oss.deleteSubtitle(documentId)
                    } catch (e: Exception) {
                        // 忽略
                    }
                }
            } catch (e: Exception) {
                // 忽略
            }
        }
    }

    // 远程触发服务器端字幕自动下载（通过 video-pipeline API）
    private val _subtitleDownloading = MutableStateFlow(false)
    val subtitleDownloading: StateFlow<Boolean> = _subtitleDownloading.asStateFlow()

    private val _downloadingDocId = MutableStateFlow<String?>(null)
    val downloadingDocId: StateFlow<String?> = _downloadingDocId.asStateFlow()

    private val _activeSubtitleProgress = MutableStateFlow<String?>(null)
    val activeSubtitleProgress: StateFlow<String?> = _activeSubtitleProgress.asStateFlow()

    fun downloadSubtitleFromServer(documentId: String, videoUrl: String, title: String = "视频文章") {
        viewModelScope.launch(Dispatchers.IO) {
            _subtitleDownloading.value = true
            _downloadingDocId.value = documentId
            _subtitleLoading.value = true
            _activeSubtitleProgress.value = "⌛ [1/4 抓取字幕] 正在尝试从 YouTube 免 Cookie 提取字幕轨..."

            // 后台步进提示
            val progressJob = viewModelScope.launch(Dispatchers.IO) {
                val steps = listOf(
                    3000L to "⌛ [1/4 抓取字幕] 正在解析带时间戳字幕卡片...",
                    7000L to "⌛ [2/4 双语翻译] 正在调用 AI 进行中英对照翻译...",
                    16000L to "⌛ [3/4 博客转换] 正在生成 Markdown 精选视频博客...",
                    25000L to "☁️ [4/4 OSS 同步] 正在无缝同步到阿里云 OSS...",
                )
                for ((delay, msg) in steps) {
                    kotlinx.coroutines.delay(delay)
                    if (_downloadingDocId.value == documentId) {
                        _activeSubtitleProgress.value = msg
                    }
                }
            }

            try {
                val token = settingDao.getSetting("readwise_token")?.replace("\"", "") ?: ""
                val client = com.readerq.app.api.ReadwiseClient(token)
                val serverUrl = getServerBaseUrl()

                try {
                    client.triggerServerSubtitleDownload(serverUrl, documentId, videoUrl, title)
                } catch (e: Exception) {
                    println("[downloadSubtitleFromServer] Pipeline trigger error: ${e.message}")
                }

                progressJob.cancel()
                _activeSubtitleProgress.value = "✅ 处理完成！正在刷新字幕..."

                // 重新从服务器/本地拉取最新字幕和博客
                loadSubtitles(documentId)
                loadBlog(documentId)
            } catch (e: Exception) {
                progressJob.cancel()
                println("[downloadSubtitleFromServer] EXCEPTION: ${e.message}")
            } finally {
                _subtitleDownloading.value = false
                _downloadingDocId.value = null
                _subtitleLoading.value = false
                _activeSubtitleProgress.value = null
            }
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

    fun setNavBarCollapsed(collapsed: Boolean) {
        _isNavBarCollapsed.value = collapsed
        viewModelScope.launch(Dispatchers.IO) {
            settingDao.setSetting(SettingEntity("navbar_collapsed", collapsed.toString()))
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
                                    tags_json = Json.encodeToString(item.tags.keys.toList()),
                                    created_at = item.created_at
                                )
                            )
                        } else {
                            val targetLocation = item.location ?: "new"
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
                    if (remoteDocCount < totalFetchedDocs) {
                        remoteDocCount = totalFetchedDocs
                    }
                    _syncProgress.value = SyncProgress("documents", totalFetchedDocs, remoteDocCount)

                    pageCursor = response.nextPageCursorString
                } while (pageCursor != null)

                // 阶段 2: 拉取 V2 高亮
                _syncProgress.value = SyncProgress("highlights", 0, 0)
                client.fetchAllV2Highlights(
                    updatedAfter = lastV2SyncedAt,
                    onProgress = { fetchedBookCount, totalBookCount ->
                        _syncProgress.value = SyncProgress("highlights", fetchedBookCount, totalBookCount)
                    },
                    checkCancel = { checkCancelled() },
                    onBatch = { batchBooks ->
                        val highlightsToInsert = mutableListOf<HighlightEntity>()
                        for (book in batchBooks) {
                            var documentId = docDao.findDocumentIdBySourceUrl(book.source_url ?: "")
                            if (documentId == null) {
                                documentId = docDao.findDocumentIdByTitle(book.title)
                            }
                            val targetDocId = documentId ?: "rw_book_${book.user_book_id}"

                            for (h in book.highlights) {
                                highlightsToInsert.add(
                                    HighlightEntity(
                                        id = h.id.toString(),
                                        document_id = targetDocId,
                                        text = h.text,
                                        note = h.note,
                                        color = h.color ?: "yellow",
                                        location = h.location ?: 0,
                                        readwise_highlight_id = h.id.toString(),
                                        tags_json = Json.encodeToString(h.tags.map { it.name }),
                                        created_at = h.highlighted_at ?: h.created_at,
                                        document_title = book.title,
                                        author = book.author
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

                // 阶段 4: 增量模式下的轻量擦除核对（全量模式直接跳过，防止假死）
                if (!fullSync) {
                    verifyAndPurgeOrphanDocuments(client, false)
                }

                // 保存最后同步时间
                val now = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).apply {
                    timeZone = java.util.TimeZone.getTimeZone("GMT")
                }.format(java.util.Date())

                val localCount = docDao.getDocumentCount()
                settingDao.setSetting(SettingEntity("lastDocumentSync", now))
                settingDao.setSetting(SettingEntity("lastV2HighlightSync", now))
                settingDao.setSetting(SettingEntity("remote_doc_count", localCount.toString()))

                _syncCounts.value = SyncCounts(local = localCount, remote = localCount, lastSync = now)
                _syncProgress.value = SyncProgress("done", totalFetchedDocs, localCount)
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

    /**
     * 智能比对擦除：
     * 普通同步 (fullSync = false)：仅发起 1 次极其轻量的 API 请求 (limit = 50)，秒级拉取远端 trash 分类下最新被删除的项目并擦除本地，绝对不发起多页翻页轮询。
     * 全量同步 (fullSync = true)：进行深层完整比对。
     */
    private suspend fun verifyAndPurgeOrphanDocuments(client: ReadwiseClient, fullSync: Boolean) {
        try {
            if (fullSync) {
                // 全量模式：拉取存活集合比对
                val localDocIds = docDao.getAllDocumentIdsSync().filter { !it.startsWith("local_") }
                if (localDocIds.isEmpty()) return

                val liveRemoteDocIds = mutableSetOf<String>()
                val locationsToFetch = listOf("new", "later", "archive", "feed", "trash")

                for (loc in locationsToFetch) {
                    var pageCursor: String? = null
                    do {
                        if (checkCancelled()) break
                        val response = client.listDocuments(location = loc, pageCursor = pageCursor)
                        response.results.forEach { liveRemoteDocIds.add(it.id) }
                        pageCursor = response.nextPageCursorString
                    } while (pageCursor != null)
                }

                val orphanedDocIds = localDocIds.filter { id -> !liveRemoteDocIds.contains(id) }
                if (orphanedDocIds.isNotEmpty()) {
                    println("[SmartPurge] 全量比对物理擦除 ${orphanedDocIds.size} 篇远端已清空文档")
                    orphanedDocIds.forEach { id ->
                        docDao.deleteDocument(id)
                        hlDao.deleteHighlightsForDocument(id)
                    }
                    if (_selectedDoc.value?.id in orphanedDocIds) {
                        _selectedDoc.value = null
                    }
                }
            } else {
                // 普通增量同步模式：极其轻量！只做 1 次请求 (limit 50)，绝不翻页！
                val trashResp = client.listDocuments(location = "trash", limit = 50)
                val trashRemoteIds = trashResp.results.map { it.id }.toSet()
                if (trashRemoteIds.isNotEmpty()) {
                    val localAllDocIds = docDao.getAllDocumentIdsSync()
                    val toPurge = localAllDocIds.filter { trashRemoteIds.contains(it) }
                    if (toPurge.isNotEmpty()) {
                        println("[SmartPurge] 轻量快速擦除 ${toPurge.size} 篇移入垃圾箱文档: $toPurge")
                        toPurge.forEach { id ->
                            docDao.deleteDocument(id)
                            hlDao.deleteHighlightsForDocument(id)
                        }
                    }
                }
            }
        } catch (e: Exception) {
            println("[SmartPurge] 比对被删文档捕获异常 (不影响主流程): ${e.message}")
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
        if (text.trim().isEmpty() && images.isEmpty()) return
        val doc = _selectedDoc.value ?: return
        val currentToken = _token.value ?: return

        viewModelScope.launch(Dispatchers.IO) {
            val localId = "local_" + System.currentTimeMillis()
            val nowIso = java.time.Instant.now().toString()
            var localHl = HighlightEntity(
                id = localId,
                document_id = doc.id,
                text = text,
                note = note,
                color = color,
                location = location,
                readwise_highlight_id = null,
                tags_json = "[]",
                created_at = nowIso
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
                                val cleanFileName = if (img.src.contains("/")) img.src.substringAfterLast("/").substringBefore("?") else "image.jpg"
                                val ossUrl = oss.uploadImage(bytes, doc.id, cleanFileName)
                                
                                val rawMarkdownImg = "![${img.alt}](${img.src})"
                                val newMarkdownImg = "![${img.alt}]($ossUrl)"
                                if (updatedText.contains(rawMarkdownImg)) {
                                    updatedText = updatedText.replace(rawMarkdownImg, newMarkdownImg)
                                } else {
                                    val placeholder = "[图片: ${img.alt}]"
                                    updatedText = updatedText.replace(placeholder, newMarkdownImg)
                                }
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

            // Readwise V3 API 不支持通过公开端点写入 reading_progress 字段
            // 阅读进度仅本地持久化，同步拉取时取远端与本地的最大值
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
data class SaveDocResult(val success: Boolean, val message: String)

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
