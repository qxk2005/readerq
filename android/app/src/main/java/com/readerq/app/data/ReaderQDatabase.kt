package com.readerq.app.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [DocumentEntity::class, HighlightEntity::class, SettingEntity::class],
    version = 1,
    exportSchema = false
)
abstract class ReaderQDatabase : RoomDatabase() {

    abstract fun documentDao(): DocumentDao
    abstract fun highlightDao(): HighlightDao
    abstract fun settingDao(): SettingDao

    companion object {
        @Volatile
        private var INSTANCE: ReaderQDatabase? = null

        fun getDatabase(context: Context): ReaderQDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    ReaderQDatabase::class.java,
                    "readerq_database"
                )
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
