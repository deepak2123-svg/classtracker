package com.classtracker.core.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

interface TeacherSyncScheduler {
    fun enqueue(uid: String)
}

@Singleton
class WorkManagerTeacherSyncScheduler @Inject constructor(
    @ApplicationContext context: Context,
) : TeacherSyncScheduler {
    private val workManager = WorkManager.getInstance(context)

    override fun enqueue(uid: String) {
        val request = OneTimeWorkRequestBuilder<TeacherSyncWorker>()
            .setInputData(
                Data.Builder()
                    .putString(TeacherSyncWorker.TeacherUidKey, uid)
                    .build(),
            )
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build(),
            )
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                15,
                TimeUnit.SECONDS,
            )
            .build()

        workManager.enqueueUniqueWork(
            "teacher-entry-sync-$uid",
            ExistingWorkPolicy.APPEND_OR_REPLACE,
            request,
        )
    }
}
