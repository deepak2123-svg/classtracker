package com.classtracker.core.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ListenableWorker
import androidx.work.WorkerFactory
import androidx.work.WorkerParameters
import com.classtracker.core.model.AuthenticatedTeacher
import com.google.firebase.auth.FirebaseAuth
import javax.inject.Inject
import javax.inject.Singleton

class TeacherSyncWorker(
    appContext: Context,
    workerParameters: WorkerParameters,
    private val auth: FirebaseAuth,
    private val processor: TeacherSyncProcessor,
) : CoroutineWorker(appContext, workerParameters) {
    override suspend fun doWork(): Result {
        val uid = inputData.getString(TeacherUidKey) ?: return Result.failure()
        val user = auth.currentUser ?: return Result.success()
        if (user.uid != uid) return Result.success()

        val result = processor.process(
            uid = uid,
            teacher = AuthenticatedTeacher(
                uid = user.uid,
                displayName = user.displayName,
                email = user.email,
                photoUrl = user.photoUrl?.toString(),
            ),
        )
        return when (result) {
            TeacherSyncResult.Success -> Result.success()
            TeacherSyncResult.Retry -> Result.retry()
        }
    }

    companion object {
        const val TeacherUidKey = "teacher_uid"
    }
}

@Singleton
class LedgrWorkerFactory @Inject constructor(
    private val auth: FirebaseAuth,
    private val processor: TeacherSyncProcessor,
) : WorkerFactory() {
    override fun createWorker(
        appContext: Context,
        workerClassName: String,
        workerParameters: WorkerParameters,
    ): ListenableWorker? = when (workerClassName) {
        TeacherSyncWorker::class.java.name -> TeacherSyncWorker(
            appContext = appContext,
            workerParameters = workerParameters,
            auth = auth,
            processor = processor,
        )
        else -> null
    }
}
