package com.readerq.app

import android.app.Application
import com.readerq.app.data.ReaderQDatabase

class ReaderQApp : Application() {
    val database: ReaderQDatabase by lazy {
        ReaderQDatabase.getDatabase(this)
    }
}
