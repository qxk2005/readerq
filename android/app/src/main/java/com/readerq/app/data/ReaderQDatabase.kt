package com.readerq.app.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [DocumentEntity::class, HighlightEntity::class, SettingEntity::class],
    version = 4,
    exportSchema = false
)
abstract class ReaderQDatabase : RoomDatabase() {

    abstract fun documentDao(): DocumentDao
    abstract fun highlightDao(): HighlightDao
    abstract fun settingDao(): SettingDao

    companion object {
        @Volatile
        private var INSTANCE: ReaderQDatabase? = null

        val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                try {
                    db.execSQL("ALTER TABLE documents ADD COLUMN blog_content TEXT")
                } catch (e: Exception) {
                    // 表可能已经包含 blog_content 字段，忽略异常
                }
            }
        }

        fun getDatabase(context: Context): ReaderQDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    ReaderQDatabase::class.java,
                    "readerq_database"
                )
                .addMigrations(MIGRATION_3_4)
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
