package com.classtracker.nativeapp

import android.app.Application
import androidx.work.Configuration
import com.classtracker.core.sync.LedgrWorkerFactory
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class LedgrApplication : Application(), Configuration.Provider {
    @Inject
    lateinit var workerFactory: LedgrWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()
}
