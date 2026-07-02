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

    // Load active documents based on location filter
    val documents: StateFlow<List<DocumentEntity>> = _currentView
        .flatMapLatest { view ->
            if (view == "all") docDao.getAllDocuments() else docDao.getDocumentsByLocation(view)
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
            val savedToken = settingDao.getSetting("readwise_token")
            // Handle possible quotes from JSON string representation
            _token.value = savedToken?.replace("\"", "")
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

    // Fetch document HTML content dynamically if not loaded
    private fun fetchDocumentContent(docId: String) {
        val currentToken = _token.value ?: return
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
