package com.readerq.app.api

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.android.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.plugins.logging.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json

class ReadwiseClient(private val token: String) {

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    private val client = HttpClient(Android) {
        install(ContentNegotiation) {
            json(json)
        }
        install(Logging) {
            level = LogLevel.INFO
        }
    }

    private fun HttpRequestBuilder.authHeaders() {
        header(HttpHeaders.Authorization, "Token $token")
        header(HttpHeaders.ContentType, ContentType.Application.Json)
    }

    private suspend fun executeWithRetry(
        url: String,
        retries: Int = 3,
        block: suspend HttpClient.() -> HttpResponse
    ): HttpResponse {
        var lastException: Exception? = null
        for (i in 0 until retries) {
            try {
                val response = client.block()
                if (response.status == HttpStatusCode.TooManyRequests) {
                    val retryAfter = response.headers["Retry-After"]?.toIntOrNull() ?: 5
                    println("Rate limited, retrying after $retryAfter seconds...")
                    delay(retryAfter * 1000L)
                    continue
                }
                if (!response.status.isSuccess()) {
                    val errorText = response.bodyAsText()
                    throw Exception("Readwise API error (${response.status.value}): $errorText")
                }
                return response
            } catch (e: Exception) {
                lastException = e
                if (i < retries - 1) {
                    println("Request failed: ${e.message}, retrying in 1 second...")
                    delay(1000L)
                }
            }
        }
        throw lastException ?: Exception("Max retries exceeded")
    }

    // 1. 获取文档列表 (V3 API)
    suspend fun listDocuments(
        id: String? = null,
        updatedAfter: String? = null,
        location: String? = null,
        category: String? = null,
        tag: String? = null,
        limit: Int? = null,
        pageCursor: String? = null,
        withHtmlContent: Boolean = false
    ): ReadwiseDocResponse {
        val url = "https://readwise.io/api/v3/list/"
        val response = executeWithRetry(url) {
            get(url) {
                authHeaders()
                id?.let { parameter("id", it) }
                updatedAfter?.let { parameter("updatedAfter", it) }
                location?.let { parameter("location", it) }
                category?.let { parameter("category", it) }
                tag?.let { parameter("tag", it) }
                limit?.let { parameter("limit", it.toString()) }
                pageCursor?.let { parameter("pageCursor", it) }
                if (withHtmlContent) {
                    parameter("withHtmlContent", "true")
                }
            }
        }
        return response.body()
    }

    // 2. 更新文档 (V3 API)
    suspend fun updateDocument(
        documentId: String,
        notes: String? = null,
        tags: List<String>? = null,
        location: String? = null
    ): HttpResponse {
        val url = "https://readwise.io/api/v3/update/$documentId/"
        return executeWithRetry(url) {
            patch(url) {
                authHeaders()
                setBody(ReadwiseDocUpdate(notes, tags, location))
            }
        }
    }

    // 3. 删除文档 (V3 API)
    suspend fun deleteDocument(documentId: String): HttpResponse {
        val url = "https://readwise.io/api/v3/delete/$documentId/"
        return executeWithRetry(url) {
            delete(url) {
                authHeaders()
            }
        }
    }

    // 4. 创建高亮 (V2 API)
    suspend fun createHighlight(
        text: String,
        title: String,
        sourceUrl: String,
        note: String? = null,
        location: Int = 0
    ): List<ReadwiseHighlightResponseItem> {
        val url = "https://readwise.io/api/v2/highlights/"
        val reqItem = ReadwiseHighlightRequestItem(
            text = text,
            title = title,
            source_url = sourceUrl,
            note = note,
            location = location
        )
        val response = executeWithRetry(url) {
            post(url) {
                authHeaders()
                setBody(ReadwiseHighlightRequest(listOf(reqItem)))
            }
        }
        return response.body()
    }

    // 5. 更新高亮 (V2 API)
    suspend fun patchHighlight(
        highlightId: String,
        note: String? = null
    ): HttpResponse {
        val url = "https://readwise.io/api/v2/highlights/$highlightId"
        return executeWithRetry(url) {
            patch(url) {
                authHeaders()
                setBody(ReadwiseHighlightPatchRequest(note = note))
            }
        }
    }

    // 6. 删除高亮 (V2 API)
    suspend fun deleteHighlight(highlightId: String): HttpResponse {
        val url = "https://readwise.io/api/v2/highlights/$highlightId"
        return executeWithRetry(url) {
            delete(url) {
                authHeaders()
            }
        }
    }

    // 7. 通过文本搜索并删除 V2 高亮
    suspend fun findAndDeleteHighlight(
        highlightText: String,
        sourceUrl: String
    ): Int {
        val cleanPrefix = highlightText.replace(Regex("!\\[[^\\]]*\\]\\([^)]+\\)"), "").trim()
        val textPrefix = if (cleanPrefix.length > 60) cleanPrefix.substring(0, 60) else cleanPrefix
        if (textPrefix.length < 10) return 0

        var deletedCount = 0
        var nextPage: String? = "https://readwise.io/api/v2/highlights/?page_size=1000"
        var pageCount = 0
        var targetBookId: Int? = null

        while (nextPage != null && pageCount < 5) {
            pageCount++
            val response = executeWithRetry(nextPage) {
                get(nextPage!!) {
                    authHeaders()
                }
            }
            val listData: ReadwiseHighlightListResponse = response.body()
            
            for (hl in listData.results) {
                val hlClean = hl.text.replace(Regex("!\\[[^\\]]*\\]\\([^)]+\\)"), "").trim()
                if (hlClean.startsWith(textPrefix) || textPrefix.startsWith(if (hlClean.length > 60) hlClean.substring(0, 60) else hlClean)) {
                    if (targetBookId == null) {
                        targetBookId = hl.book_id
                    }
                    if (hl.book_id != targetBookId) continue

                    try {
                        deleteHighlight(hl.id.toString())
                        deletedCount++
                    } catch (e: Exception) {
                        println("Failed to delete matching highlight ID=${hl.id}: ${e.message}")
                    }
                }
            }

            if (deletedCount > 0) break
            nextPage = listData.next
        }
        return deletedCount
    }

    // 8. 查找 V2 book_id
    suspend fun findV2BookId(sourceUrl: String): Int? {
        var nextPage: String? = "https://readwise.io/api/v2/books/?page_size=100"
        var pageCount = 0
        while (nextPage != null && pageCount < 10) {
            pageCount++
            val response = executeWithRetry(nextPage) {
                get(nextPage!!) { authHeaders() }
            }
            val data: ReadwiseBookListResponse = response.body()
            for (book in data.results) {
                if (book.source_url == sourceUrl) {
                    return book.id
                }
            }
            nextPage = data.next
        }
        return null
    }

    // 9. 同步 V2 文档标签
    suspend fun syncDocumentTagsV2(sourceUrl: String, tags: List<String>) {
        val bookId = findV2BookId(sourceUrl) ?: return
        val url = "https://readwise.io/api/v2/books/$bookId/tags/"

        // 获取现有 V2 标签
        val response = executeWithRetry(url) {
            get(url) { authHeaders() }
        }
        val existingTags: List<ReadwiseV2TagItem> = response.body()
        val existingNames = existingTags.map { it.name }.toSet()
        val targetNames = tags.toSet()

        // 删除多余标签
        for (tag in existingTags) {
            if (!targetNames.contains(tag.name)) {
                val deleteUrl = "https://readwise.io/api/v2/books/$bookId/tags/${tag.id}"
                try {
                    executeWithRetry(deleteUrl) {
                        delete(deleteUrl) { authHeaders() }
                    }
                } catch (e: Exception) {
                    println("Failed to delete tag ${tag.name}: ${e.message}")
                }
            }
        }

        // 添加缺少标签
        for (tagName in tags) {
            if (!existingNames.contains(tagName)) {
                try {
                    executeWithRetry(url) {
                        post(url) {
                            authHeaders()
                            setBody(ReadwiseV2TagRequest(name = tagName))
                        }
                    }
                } catch (e: Exception) {
                    println("Failed to add tag $tagName: ${e.message}")
                }
            }
        }
    }

    // 10. 验证 Token 是否有效 (v2 auth 接口)
    suspend fun validateToken(): Boolean {
        return try {
            val url = "https://readwise.io/api/v2/auth/"
            val response = client.get(url) {
                authHeaders()
            }
            response.status == HttpStatusCode.NoContent
        } catch (e: Exception) {
            false
        }
    }

    // 11. 获取所有 V2 高亮并支持进度和取消
    suspend fun fetchAllV2Highlights(
        updatedAfter: String? = null,
        onProgress: ((Int, Int) -> Unit)? = null,
        checkCancel: (() -> Boolean)? = null,
        onBatch: (suspend (List<ReadwiseExportBookItem>) -> Unit)? = null
    ): Int {
        var pageCursor: String? = null
        var fetchedCount = 0
        var totalBookCount = 0

        do {
            if (checkCancel != null && checkCancel()) {
                throw Exception("Sync cancelled by user")
            }

            val url = "https://readwise.io/api/v2/export/"
            val response = executeWithRetry(url) {
                get(url) {
                    authHeaders()
                    pageCursor?.let { parameter("pageCursor", it) }
                    updatedAfter?.let { parameter("updatedAfter", it) }
                }
            }

            val data: ReadwiseExportResponse = response.body()
            if (totalBookCount == 0) {
                totalBookCount = data.count
            }

            val results = data.results
            for (book in results) {
                fetchedCount += book.highlights.size
            }

            if (onBatch != null && results.isNotEmpty()) {
                onBatch(results)
            }

            pageCursor = data.nextPageCursor

            onProgress?.invoke(fetchedCount, totalBookCount)

        } while (pageCursor != null)

        return fetchedCount
    }

    // 12. 获取所有 V3 标签并支持进度和取消
    suspend fun fetchAllTags(
        onProgress: ((Int, Int) -> Unit)? = null,
        checkCancel: (() -> Boolean)? = null,
        onBatch: (suspend (List<ReadwiseTagItem>) -> Unit)? = null
    ): Int {
        var pageCursor: String? = null
        var fetchedCount = 0
        var totalCount = 0

        do {
            if (checkCancel != null && checkCancel()) {
                throw Exception("Sync cancelled by user")
            }

            val url = "https://readwise.io/api/v3/tags/"
            val response = executeWithRetry(url) {
                get(url) {
                    authHeaders()
                    pageCursor?.let { parameter("pageCursor", it) }
                }
            }

            val data: ReadwiseTagResponse = response.body()
            if (totalCount == 0) {
                totalCount = data.count ?: 0
            }

            val results = data.results
            fetchedCount += results.size

            if (onBatch != null && results.isNotEmpty()) {
                onBatch(results)
            }

            pageCursor = data.nextPageCursor

            onProgress?.invoke(fetchedCount, totalCount)

        } while (pageCursor != null)

        return fetchedCount
    }
}
