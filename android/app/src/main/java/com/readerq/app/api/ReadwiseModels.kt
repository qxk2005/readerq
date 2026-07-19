package com.readerq.app.api

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

@Serializable
data class ReadwiseDocResponse(
    val count: Int? = null,
    val results: List<ReadwiseDocItem> = emptyList(),
    val nextPageCursor: JsonElement? = null
) {
    val nextPageCursorString: String?
        get() = (nextPageCursor as? JsonPrimitive)?.contentOrNull
}

@Serializable
data class ReadwiseDocItem(
    val id: String = "",
    val url: String = "",
    val source_url: String? = null,
    val title: String = "",
    val author: String? = null,
    val source: String? = null,
    val category: String? = null,
    val location: String = "",
    val site_name: String? = null,
    val word_count: Int? = null,
    val reading_time: String? = null,
    val created_at: String? = null,
    val updated_at: String? = null,
    val published_date: JsonElement? = null,
    val summary: String? = null,
    val notes: String? = null,
    val image_url: String? = null,
    val reading_progress: Float = 0f,
    val html_content: String? = null,
    val tags: Map<String, ReadwiseTagItem> = emptyMap(),
    val saved_at: String? = null,
    val last_moved_at: String? = null,
    val parent_id: String? = null
) {
    val publishedDateString: String?
        get() {
            val content = (published_date as? JsonPrimitive)?.contentOrNull
            return if (content == "0" || content.isNullOrBlank()) null else content
        }
}

@Serializable
data class ReadwiseTagItem(
    val name: String,
    val type: String? = null,
    val created: Long? = null
)

@Serializable
data class ReadwiseDocUpdate(
    val notes: String? = null,
    val tags: List<String>? = null,
    val location: String? = null,
    val reading_progress: Float? = null
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

@Serializable
data class ReadwiseExportResponse(
    val count: Int,
    val nextPageCursor: JsonElement? = null,
    val results: List<ReadwiseExportBookItem> = emptyList()
) {
    val nextPageCursorString: String?
        get() = (nextPageCursor as? JsonPrimitive)?.contentOrNull
}

@Serializable
data class ReadwiseExportBookItem(
    val user_book_id: Int,
    val title: String,
    val source_url: String? = null,
    val readable_id: String? = null,
    val asin: String? = null,
    val external_id: String? = null,
    val highlights: List<ReadwiseExportHighlightItem> = emptyList()
)

@Serializable
data class ReadwiseExportHighlightItem(
    val id: Int,
    val text: String,
    val note: String? = null,
    val color: String? = null,
    val location: Int? = null,
    val highlighted_at: String? = null,
    val created_at: String? = null,
    val tags: List<ReadwiseExportTagItem> = emptyList()
)

@Serializable
data class ReadwiseExportTagItem(
    val id: Int,
    val name: String
)

@Serializable
data class ReadwiseTagResponse(
    val count: Int? = null,
    val results: List<ReadwiseTagItem> = emptyList(),
    val nextPageCursor: JsonElement? = null
) {
    val nextPageCursorString: String?
        get() = (nextPageCursor as? JsonPrimitive)?.contentOrNull
}

@Serializable
data class HighlightImage(
    val src: String,
    val alt: String
)

// --- Save Document API Models ---

@Serializable
data class ReadwiseSaveRequest(
    val url: String,
    val html: String? = null,
    val should_clean_html: Boolean? = null,
    val title: String? = null,
    val author: String? = null,
    val summary: String? = null,
    val published_date: String? = null,
    val image_url: String? = null,
    val location: String? = null,
    val category: String? = null,
    val tags: List<String>? = null,
    val notes: String? = null
)

@Serializable
data class ReadwiseSaveResponse(
    val id: String? = null,
    val url: String? = null,
    val error: String? = null
)

// --- Subtitle Models ---

data class SubtitleSegment(
    val index: Int,
    val startTime: Double, // 秒
    val endTime: Double,   // 秒
    val text: String
)
