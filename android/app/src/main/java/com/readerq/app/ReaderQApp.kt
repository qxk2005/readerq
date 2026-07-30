package com.readerq.app

import android.app.Application
import android.content.Context
import com.readerq.app.data.ReaderQDatabase

class ReaderQApp : Application() {
    val database: ReaderQDatabase by lazy {
        ReaderQDatabase.getDatabase(this)
    }

    override fun onCreate() {
        super.onCreate()
        appContext = applicationContext
    }

    companion object {
        var appContext: Context? = null
            private set
    }
}
