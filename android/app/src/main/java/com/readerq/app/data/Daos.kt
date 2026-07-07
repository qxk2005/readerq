package com.readerq.app.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface DocumentDao {
    @Query("SELECT * FROM documents WHERE location != 'trash' ORDER BY created_at DESC")
    fun getAllDocuments(): Flow<List<DocumentEntity>>

    @Query("SELECT * FROM documents WHERE location = :location ORDER BY CASE WHEN :location = 'archive' OR :location = 'trash' THEN coalesce(updated_at, created_at) ELSE created_at END DESC")
    fun getDocumentsByLocation(location: String): Flow<List<DocumentEntity>>

    @Query("SELECT * FROM documents WHERE location != 'trash' AND (title LIKE :query OR author LIKE :query OR summary LIKE :query) ORDER BY created_at DESC")
    fun searchAllDocuments(query: String): Flow<List<DocumentEntity>>

    @Query("SELECT * FROM documents WHERE location = :location AND (title LIKE :query OR author LIKE :query OR summary LIKE :query) ORDER BY CASE WHEN :location = 'archive' OR :location = 'trash' THEN coalesce(updated_at, created_at) ELSE created_at END DESC")
    fun searchDocumentsByLocation(location: String, query: String): Flow<List<DocumentEntity>>

    @Query("SELECT id FROM documents WHERE location = 'trash'")
    suspend fun getTrashDocumentIds(): List<String>

    @Query("SELECT * FROM documents WHERE id = :id LIMIT 1")
    suspend fun getDocumentById(id: String): DocumentEntity?

    @Query("SELECT * FROM documents WHERE id = :id LIMIT 1")
    fun getDocumentByIdFlow(id: String): Flow<DocumentEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDocument(document: DocumentEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(documents: List<DocumentEntity>)

    @Query("DELETE FROM documents WHERE id = :id")
    suspend fun deleteDocument(id: String)

    @Query("DELETE FROM documents")
    suspend fun deleteAll()

    @Query("SELECT COUNT(*) FROM documents")
    suspend fun getDocumentCount(): Int

    @Query("SELECT id FROM documents WHERE source_url = :url OR url = :url LIMIT 1")
    suspend fun findDocumentIdBySourceUrl(url: String): String?

    @Query("SELECT id FROM documents WHERE title = :title LIMIT 1")
    suspend fun findDocumentIdByTitle(title: String): String?

    @Query("SELECT * FROM documents WHERE id IN (SELECT DISTINCT document_id FROM highlights) ORDER BY updated_at DESC")
    fun getDocumentsWithHighlights(): Flow<List<DocumentEntity>>
}

@Dao
interface HighlightDao {
    @Query("SELECT * FROM highlights WHERE document_id = :documentId ORDER BY location ASC")
    fun getHighlightsForDocument(documentId: String): Flow<List<HighlightEntity>>

    @Query("SELECT * FROM highlights WHERE id = :id LIMIT 1")
    suspend fun getHighlightById(id: String): HighlightEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertHighlight(highlight: HighlightEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(highlights: List<HighlightEntity>)

    @Query("DELETE FROM highlights WHERE id = :id")
    suspend fun deleteHighlight(id: String)

    @Query("DELETE FROM highlights WHERE document_id = :documentId")
    suspend fun deleteHighlightsForDocument(documentId: String)

    @Query("DELETE FROM highlights")
    suspend fun deleteAll()
}

@Dao
interface SettingDao {
    @Query("SELECT value FROM settings WHERE key = :key LIMIT 1")
    suspend fun getSetting(key: String): String?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun setSetting(setting: SettingEntity)

    @Query("DELETE FROM settings WHERE key = :key")
    suspend fun removeSetting(key: String)
}
