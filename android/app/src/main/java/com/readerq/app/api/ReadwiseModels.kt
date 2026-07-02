package com.readerq.app.api

import kotlinx.serialization.Serializable

@Serializable
data class ReadwiseDocResponse(
    val count: Int? = null,
    val results: List<ReadwiseDocItem> = emptyList(),
    val nextPageCursor: String? = null
)

@Serializable
data class ReadwiseDocItem(
    val id: String,
    val url: String,
    val source_url: String? = null,
    val title: String,
    val author: String? = null,
    val source: String? = null,
    val category: String? = null,
    val location: String,
    val site_name: String? = null,
    val word_count: Int? = null,
    val reading_time: String? = null,
    val created_at: String? = null,
    val updated_at: String? = null,
    val published_date: String? = null,
    val summary: String? = null,
    val notes: String? = null,
    val image_url: String? = null,
    val reading_progress: Float = 0f,
    val html_content: String? = null,
    val tags: Map<String, ReadwiseTagItem> = emptyMap(),
    val saved_at: String? = null,
    val last_moved_at: String? = null
)

@Serializable
data class ReadwiseTagItem(
    val name: String,
    val type: String? = null,
    val created: Long? = null
)

@Serializable
data class ReadwiseDocUpdate(
    val notes: String? = null,
    val tags: List<String>? = null
)

@Serializable
data class ReadwiseHighlightRequestItem(
    val text: String,
    val note: String? = null,
    val title: String? = null,
    val author: String? = null,
    val source_url: String? = null,
    val location: Int? = null,
    val location_type: String? = "offset",
    val highlighted_at: String? = null
)

@Serializable
data class ReadwiseHighlightRequest(
    val highlights: List<ReadwiseHighlightRequestItem>
)

@Serializable
data class ReadwiseHighlightResponseItem(
    val id: Int, // book_id
    val modified_highlights: List<Int> = emptyList()
)

@Serializable
data class ReadwiseHighlightPatchRequest(
    val note: String? = null
)

@Serializable
data class ReadwiseHighlightListResponse(
    val count: Int,
    val results: List<ReadwiseHighlightListItem> = emptyList(),
    val next: String? = null
)

@Serializable
data class ReadwiseHighlightListItem(
    val id: Int,
    val book_id: Int,
    val text: String,
    val note: String? = null,
    val location: Int? = null
)

@Serializable
data class ReadwiseBookListResponse(
    val count: Int,
    val results: List<ReadwiseBookItem> = emptyList(),
    val next: String? = null
)

@Serializable
data class ReadwiseBookItem(
    val id: Int,
    val title: String,
    val source_url: String? = null,
    val tags: List<ReadwiseV2TagItem> = emptyList()
)

@Serializable
data class ReadwiseV2TagItem(
    val id: Int,
    val name: String,
    val user_book: Int? = null
)

@Serializable
data class ReadwiseV2TagRequest(
    val name: String
)
