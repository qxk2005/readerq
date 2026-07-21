package com.readerq.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString

@Entity(tableName = "documents")
data class DocumentEntity(
    @PrimaryKey val id: String,
    val url: String,
    val source_url: String?,
    val title: String,
    val author: String?,
    val source: String?,
    val category: String?,
    val location: String, // e.g. new, archive, later, feed
    val site_name: String?,
    val word_count: Int?,
    val reading_time: String?,
    val created_at: String?,
    val updated_at: String?,
    val published_date: String?,
    val summary: String?,
    val notes: String?,
    val image_url: String?,
    val reading_progress: Float = 0f,
    val html_content: String?,
    val tags_json: String?, // JSON representation of tags Map
    val synced_at: String?
)

@Entity(tableName = "highlights")
data class HighlightEntity(
    @PrimaryKey val id: String,
    val document_id: String,
    val text: String,
    val note: String?,
    val color: String?, // e.g. yellow, green, blue, purple, red
    val location: Int,
    val readwise_highlight_id: String?,
    val tags_json: String?, // JSON representation of tags List/Map
    val created_at: String? = null // ISO 8601 timestamp of when highlight was created
)

@Entity(tableName = "settings")
data class SettingEntity(
    @PrimaryKey val key: String,
    val value: String
)
