package com.classtracker.core.sync

import com.classtracker.core.firebase.TeacherDataRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
abstract class SyncBindings {
    @Binds
    abstract fun bindTeacherSyncScheduler(
        scheduler: WorkManagerTeacherSyncScheduler,
    ): TeacherSyncScheduler

    @Binds
    abstract fun bindTeacherDataRepository(
        repository: OfflineTeacherDataRepository,
    ): TeacherDataRepository
}
